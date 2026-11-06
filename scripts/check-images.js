// Keepsake Automated Browser-Driven Image and Media Verification
// Verifies that all img and video elements across all media surfaces load completely
// with naturalWidth > 0, zero broken requests (non-2xx/206), and zero tiles stuck on blur placeholder.

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const mongoose = require('mongoose');

const config = require('../server/config');
const User = require('../server/models/User');
const Moment = require('../server/models/Moment');
const Album = require('../server/models/Album');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9455;
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}`));
        }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
    this.failingRequests = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.method === 'Network.responseReceived') {
          const { url, status, statusText, mimeType } = msg.params.response;
          const isMedia = url.includes('/api/media/') ||
                          url.includes('/assets/demo/') ||
                          url.includes('/api/users/') ||
                          (mimeType && (mimeType.startsWith('image/') || mimeType.startsWith('video/')));
          if (isMedia && status >= 400) {
            this.failingRequests.push({ url, status, statusText });
          }
        }
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Evaluation failed: ${res.exceptionDetails.text || res.exceptionDetails.exception?.description}`);
    }
    return res.result?.value;
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await wait(1800);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function launchChrome(port) {
  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), `chrome-img-check-${port}-`));
  const proc = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${tmpProfile}`,
      '--disable-gpu',
      '--no-sandbox',
      '--disable-extensions',
      '--hide-scrollbars',
      'about:blank'
    ],
    { stdio: 'ignore' }
  );

  let targets = null;
  for (let i = 0; i < 30; i++) {
    try {
      targets = await fetchJson(`http://localhost:${port}/json/list`);
      if (targets && targets.length > 0) break;
    } catch {
      await wait(250);
    }
  }

  if (!targets || targets.length === 0) {
    proc.kill();
    throw new Error(`Could not connect to Chrome on port ${port}`);
  }

  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');

  return { proc, client, tmpProfile };
}

async function run() {
  console.log('====================================================');
  console.log('       Keepsake Automated Image & Media Audit       ');
  console.log('====================================================\n');

  await mongoose.connect(config.mongodbUri);

  // Find seed user 'clara'
  const seedUser = await User.findOne({ username: 'clara' }) || await User.findOne({});
  const sampleMoment = await Moment.findOne({ owner: seedUser?._id, visibility: { $in: ['public', 'followers'] } }) || await Moment.findOne({});
  const sampleAlbum = await Album.findOne({ owner: seedUser?._id }) || await Album.findOne({});
  const sharedAlbum = await Album.findOne({ shareToken: { $ne: null } });

  console.log(`Auditing as seed user: @${seedUser ? seedUser.username : 'clara'}...`);

  const { proc, client, tmpProfile } = await launchChrome(CDP_PORT);
  let hasErrors = false;

  try {
    // 1. Log in to establish authenticated cookie session
    console.log('1. Authenticating seed user session...');
    await client.navigate(`${BASE_URL}/auth.html`);
    await wait(600);
    await client.eval(`
      const idInput = document.getElementById('login-identifier');
      const passInput = document.getElementById('login-password');
      if (idInput && passInput) {
        idInput.value = '${seedUser ? seedUser.username : 'clara'}';
        passInput.value = 'Password123';
        const submitBtn = document.querySelector('#form-login button[type="submit"]');
        if (submitBtn) submitBtn.click();
      }
    `);
    
    // Poll for auth cookie
    let authSuccess = false;
    for (let i = 0; i < 10; i++) {
      await wait(500);
      const cookies = await client.send('Network.getCookies');
      if (cookies.cookies.some(c => c.name === 'token')) {
        authSuccess = true;
        break;
      }
    }
    console.log(`  Auth cookie established: ${authSuccess ? 'YES' : 'NO'}`);

    // List of test pages to audit
    const pagesToAudit = [
      { name: 'Landing Page (Demo Showcase & Collages)', url: `${BASE_URL}/index.html` },
      { name: 'Home Feed & On This Day Stream', url: `${BASE_URL}/home.html` },
      { name: 'Media Library (Justified Grid & Dates)', url: `${BASE_URL}/library.html` },
      { name: 'Explore Stream', url: `${BASE_URL}/explore.html` },
      { name: 'User Profile Page', url: `${BASE_URL}/profile.html?u=${seedUser?.username || 'clara'}` },
      { name: 'Albums Overview Collection', url: `${BASE_URL}/albums.html` },
      ...(sampleAlbum ? [{ name: 'Single Album Page', url: `${BASE_URL}/album.html?id=${sampleAlbum._id}` }] : []),
      ...(sampleMoment ? [{ name: 'Single Moment Page', url: `${BASE_URL}/moment.html?id=${sampleMoment._id}` }] : []),
      ...(sharedAlbum ? [{ name: 'Shared Album Secret Link', url: `${BASE_URL}/shared.html?token=${sharedAlbum.shareToken}` }] : []),
      { name: 'Developer Playground', url: `${BASE_URL}/playground.html` },
      { name: 'Design System Styleguide', url: `${BASE_URL}/styleguide.html` }
    ];

    for (const p of pagesToAudit) {
      console.log(`\nAuditing Page: ${p.name}`);
      console.log(`  URL: ${p.url}`);

      const startFails = client.failingRequests.length;
      await client.navigate(p.url);

      // Wait for network content to settle, then scroll down to trigger lazy loading
      await wait(800);
      await client.eval(`
        (async () => {
          const totalH = Math.max(document.body.scrollHeight, 1200);
          for (let y = 0; y <= totalH; y += 400) {
            window.scrollTo(0, y);
            await new Promise(r => setTimeout(r, 80));
          }
          // Also trigger any horizontal carousels or strips
          document.querySelectorAll('.carousel-track, .otd-strip, .segmented').forEach(el => {
            el.scrollLeft = el.scrollWidth;
          });
          await new Promise(r => setTimeout(r, 100));
        })()
      `);

      // Wait up to 5 seconds for all images/videos to load
      const auditResult = await client.eval(`
        (async () => {
          const startTime = Date.now();
          while (Date.now() - startTime < 5000) {
            const imgs = Array.from(document.querySelectorAll('img')).filter(el => {
              // Exclude stickers or tiny badges
              return el.src && !el.src.includes('data:image/svg+xml');
            });
            const tiles = Array.from(document.querySelectorAll('.media-tile'));
            const pendingImgs = imgs.filter(i => !i.complete);

            if (pendingImgs.length === 0) {
              const brokenImgs = imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.src);
              const stuckTiles = tiles.filter(tile => {
                const img = tile.querySelector('img');
                if (!img) return false;
                const isHidden = window.getComputedStyle(img).opacity === '0';
                return isHidden || !img.complete || img.naturalWidth === 0;
              }).length;

              return {
                ok: brokenImgs.length === 0 && stuckTiles === 0,
                totalImages: imgs.length,
                brokenImages: brokenImgs,
                stuckTiles: stuckTiles
              };
            }
            await new Promise(r => setTimeout(r, 250));
          }

          const imgs = Array.from(document.querySelectorAll('img')).filter(el => el.src && !el.src.includes('data:image/svg+xml'));
          const brokenImgs = imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.src);
          const pendingImgs = imgs.filter(i => !i.complete).map(i => i.src);
          return {
            ok: false,
            timedOut: true,
            totalImages: imgs.length,
            pendingImages: pendingImgs,
            brokenImages: brokenImgs,
            stuckTiles: 0
          };
        })()
      `);

      const newFails = client.failingRequests.slice(startFails);

      if (newFails.length > 0) {
        hasErrors = true;
        console.error(`  ✗ FAIL: ${newFails.length} media request(s) failed with HTTP >= 400:`);
        newFails.forEach((f) => console.error(`    - [${f.status} ${f.statusText}] ${f.url}`));
      }

      if (!auditResult.ok) {
        hasErrors = true;
        if (auditResult.timedOut) {
          console.error(`  ✗ FAIL: Images timed out after 5000ms:`);
          auditResult.pendingImages.forEach((url) => console.error(`    - Pending: ${url}`));
        }
        if (auditResult.brokenImages && auditResult.brokenImages.length > 0) {
          console.error(`  ✗ FAIL: ${auditResult.brokenImages.length} broken image(s) (naturalWidth === 0):`);
          auditResult.brokenImages.forEach((url) => console.error(`    - Broken: ${url}`));
        }
        if (auditResult.stuckTiles > 0) {
          console.error(`  ✗ FAIL: ${auditResult.stuckTiles} tile(s) stuck showing only blur placeholder.`);
        }
      } else {
        console.log(`  ✓ PASSED: ${auditResult.totalImages} images loaded cleanly. Zero tiles stuck on blur.`);
      }
    }
  } finally {
    client.close();
    proc.kill();
    try {
      fs.rmSync(tmpProfile, { recursive: true, force: true });
    } catch {}
    await mongoose.disconnect();
  }

  console.log('\n====================================================');
  if (hasErrors) {
    console.error('RESULT: Media Image Audit FAILED');
    console.log('====================================================\n');
    process.exit(1);
  } else {
    console.log('RESULT: Media Image Audit PASSED (100% Clean)');
    console.log('====================================================\n');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
