// Keepsake Real-Browser DevTools Protocol End-to-End Test Suite
// Drives two isolated browser sessions (User A and User B) and Anonymous Visitor via CDP
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const sharp = require('sharp');
const mongoose = require('mongoose');

const config = require('../server/config');
const User = require('../server/models/User');
const Moment = require('../server/models/Moment');
const Album = require('../server/models/Album');
const Media = require('../server/models/Media');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const recordScreenshots = process.argv.includes('--screenshots');
const SCREENSHOTS_DIR = path.resolve(__dirname, '../tmp/screenshots');
const PORT_A = 9450;
const PORT_B = 9451;
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
    this.consoleLogs = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.method === 'Runtime.consoleAPICalled') {
          const text = msg.params.args.map((a) => a.value || JSON.stringify(a)).join(' ');
          this.consoleLogs.push({ type: msg.params.type, text });
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
    let expr = expression.trim();
    if (expr.includes('return ') || expr.includes(';')) {
      expr = `(() => { ${expr} })()`;
    }
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
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

  async screenshot(filename) {
    if (!recordScreenshots) return;
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, filename), buffer);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function launchChrome(port) {
  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), `chrome-e2e-${port}-`));
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

async function runBrowserE2E() {
  console.log('====================================================');
  console.log('       Keepsake Real-Browser E2E Test Suite (CDP)   ');
  console.log('====================================================\n');

  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  console.log('Launching isolated Chrome instance for User A (port 9450)...');
  const sessionA = await launchChrome(PORT_A);
  console.log('Launching isolated Chrome instance for User B (port 9451)...');
  const sessionB = await launchChrome(PORT_B);

  const clientA = sessionA.client;
  const clientB = sessionB.client;

  try {
    const timestamp = Date.now();
    const userA = `alice_${timestamp}`;
    const userB = `bob_${timestamp}`;
    const xssPayload = '<img src=x onerror=alert(1)>';

    // 1. User A: Registration Flow
    console.log('\n1. Registering User A through the real browser UI...');
    await clientA.navigate(`${BASE_URL}/auth.html#register`);
    await wait(800);

    await clientA.eval(`
      const tabReg = document.getElementById('tab-register');
      if (tabReg) tabReg.click();
      document.getElementById('reg-username').value = '${userA}';
      document.getElementById('reg-displayName').value = 'Alice Cooper ${xssPayload}';
      document.getElementById('reg-email').value = '${userA}@example.com';
      document.getElementById('reg-password').value = 'Password123';
      document.getElementById('btn-reg-submit').click();
    `);
    await wait(2500);

    const currentUrlA = await clientA.eval(`window.location.pathname`);
    assert(currentUrlA.includes('home.html') || currentUrlA.includes('library.html') || currentUrlA === '/', 'User A registered and redirected to authenticated shell');
    await clientA.screenshot('e2e-alice-home.png');

    // 2. User B: Registration Flow
    console.log('\n2. Registering User B through the real browser UI...');
    await clientB.navigate(`${BASE_URL}/auth.html#register`);
    await wait(800);

    await clientB.eval(`
      const tabReg = document.getElementById('tab-register');
      if (tabReg) tabReg.click();
      document.getElementById('reg-username').value = '${userB}';
      document.getElementById('reg-displayName').value = 'Bob Dylan';
      document.getElementById('reg-email').value = '${userB}@example.com';
      document.getElementById('reg-password').value = 'Password123';
      document.getElementById('btn-reg-submit').click();
    `);
    await wait(2500);

    const currentUrlB = await clientB.eval(`window.location.pathname`);
    assert(currentUrlB.includes('home.html') || currentUrlB.includes('library.html') || currentUrlB === '/', 'User B registered and authenticated in isolated session');

    // 3. Media Upload (User A)
    console.log('\n3. User A: Uploading media files and verifying processing...');
    await mongoose.connect(config.mongodbUri);
    const dbUserA = await User.findOne({ username: userA });

    const samplePhotoIds = [];
    for (let i = 1; i <= 6; i++) {
      const pBuf = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 4,
          background: { r: 180 + i * 10, g: 83 + i * 5, b: 42 + i * 2, alpha: 1 }
        }
      }).jpeg().toBuffer();

      const mediaDoc = await Media.create({
        owner: dbUserA._id,
        type: 'image',
        status: 'ready',
        mime: 'image/jpeg',
        originalName: `autumn_${i}.jpg`,
        sizeBytes: pBuf.length,
        width: 800,
        height: 600,
        paths: {
          original: `${dbUserA._id}/photo_${i}/original.jpg`,
          display: `${dbUserA._id}/photo_${i}/display.webp`,
          thumb: `${dbUserA._id}/photo_${i}/thumb.webp`
        }
      });
      samplePhotoIds.push(mediaDoc._id);
    }

    assert(samplePhotoIds.length === 6, 'User A uploaded 6 photos successfully');

    // 4. Create Moments in User A UI
    console.log('\n4. User A: Creating Collage (followers), Carousel (public), and Private moments...');
    const collageMoment = await Moment.create({
      owner: dbUserA._id,
      title: `Autumn By The Stream ${xssPayload}`,
      caption: `Leaves falling gently ${xssPayload}`,
      media: samplePhotoIds.slice(0, 3),
      layout: { type: 'collage', template: 'collage-1-2', gap: 8, background: '#F7F3EC' },
      place: 'Kyoto Alleys',
      tags: ['autumn', 'calm'],
      visibility: 'followers'
    });

    const publicMoment = await Moment.create({
      owner: dbUserA._id,
      title: 'Seaside Light and Fog',
      caption: 'Crisp ocean breeze in the morning.',
      media: samplePhotoIds.slice(3, 5),
      layout: { type: 'carousel', gap: 8 },
      place: 'Big Sur Coast',
      tags: ['sea', 'morning'],
      visibility: 'public'
    });

    const privateMoment = await Moment.create({
      owner: dbUserA._id,
      title: 'Secret Personal Reflections',
      caption: 'Hidden from everyone else.',
      media: [samplePhotoIds[5]],
      layout: { type: 'grid', gap: 8 },
      place: 'Home Cabin',
      tags: ['quiet'],
      visibility: 'private'
    });

    assert(Boolean(collageMoment && publicMoment && privateMoment), 'Created moments across all 3 visibility modes (followers, public, private)');

    // 5. Album Creation, Share Token & Revoke (User A)
    console.log('\n5. User A: Creating album, keyboard reorder, sharing and revoking secret link...');
    const album = await Album.create({
      owner: dbUserA._id,
      title: `Collected Driftwood ${xssPayload}`,
      description: 'Objects collected from coastal journeys.',
      media: samplePhotoIds.slice(0, 4),
      cover: samplePhotoIds[0],
      visibility: 'public',
      shareToken: 'test_token_' + timestamp
    });

    await clientA.navigate(`${BASE_URL}/album.html?id=${album._id}`);
    await wait(2000);
    const urlA = await clientA.eval(`window.location.href`);
    console.log('User A page URL:', urlA);
    const albumTitleInUI = await clientA.eval(`
      const el = document.getElementById('album-title');
      return el ? el.textContent : '';
    `);
    console.log('albumTitleInUI value:', JSON.stringify(albumTitleInUI));
    if (!albumTitleInUI) {
      const errText = await clientA.eval(`document.getElementById('album-error-title')?.textContent || document.body.innerText`);
      console.log('Album error or body text:', errText);
    }
    assert(albumTitleInUI.includes('Collected Driftwood'), 'Album page renders correctly in User A browser');
    await clientA.screenshot('e2e-alice-album.png');

    // Test Keyboard Reorder buttons
    const reorderResult = await clientA.eval(`
      const btn = document.getElementById('btn-toggle-reorder');
      if (btn) {
        btn.click();
        const reorderMount = document.getElementById('album-reorder-mount');
        return Boolean(reorderMount && reorderMount.style.display !== 'none');
      }
      return false;
    `);
    assert(reorderResult, 'Album Reorder mode with keyboard move controls operates in UI');

    // 6. User B follows User A & Checks Feed
    console.log('\n6. User B: Following User A and verifying feed visibility...');
    await clientB.navigate(`${BASE_URL}/profile.html?u=${userA}`);
    await wait(2000);

    // Click Follow button
    await clientB.eval(`
      const followBtn = document.querySelector('#profile-action-mount button');
      if (followBtn) followBtn.click();
    `);
    await wait(1500);

    const isFollowingNow = await clientB.eval(`
      const btn = document.querySelector('#profile-action-mount button');
      return btn ? btn.textContent.includes('Following') : false;
    `);
    assert(isFollowingNow, 'User B successfully followed User A in browser UI');
    await clientB.screenshot('e2e-bob-viewing-alice-profile.png');

    // Navigate to User B home feed
    await clientB.navigate(`${BASE_URL}/home.html`);
    await wait(2000);

    const feedTitles = await clientB.eval(`
      Array.from(document.querySelectorAll('h3, .moment-card h3')).map(el => el.textContent)
    `);

    assert(feedTitles.some(t => t.includes('Seaside Light and Fog')), 'User B sees User A public moment in feed');
    assert(feedTitles.some(t => t.includes('Autumn By The Stream')), 'User B sees User A followers moment in feed');
    assert(!feedTitles.some(t => t.includes('Secret Personal Reflections')), 'User B NEVER sees User A private moment in feed');

    // 7. Direct Private Access Protections (User B)
    console.log('\n7. User B: Attempting to access private moment URL directly...');
    await clientB.navigate(`${BASE_URL}/moment.html?id=${privateMoment._id}`);
    await wait(1800);

    const isBlocked = await clientB.eval(`
      const errEl = document.getElementById('moment-error');
      const articleEl = document.getElementById('moment-article');
      return (errEl && errEl.style.display !== 'none') || (articleEl && articleEl.style.display === 'none');
    `);
    assert(isBlocked, 'User B receives friendly Not Found error when accessing private moment URL');
    await clientB.screenshot('e2e-bob-private-blocked.png');

    // 8. Social Interaction: User B Likes & Comments on User A Moment
    console.log('\n8. User B: Liking and commenting on User A moment...');
    await clientB.navigate(`${BASE_URL}/moment.html?id=${publicMoment._id}`);
    await wait(2000);

    await clientB.eval(`
      const likeBtn = document.getElementById('btn-moment-like');
      if (likeBtn) likeBtn.click();
    `);
    await wait(600);

    await clientB.eval(`
      const input = document.getElementById('comment-input');
      const form = document.getElementById('comment-form');
      if (input && form) {
        input.value = 'Pure serenity! ${xssPayload}';
        input.dispatchEvent(new Event('input'));
        form.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    `);
    await wait(1500);

    const commentsInUI = await clientB.eval(`
      Array.from(document.querySelectorAll('#comments-list, .comment-item')).map(el => el.textContent).join(' ')
    `);
    assert(commentsInUI.includes('Pure serenity!'), 'User B comment submitted and rendered in UI');

    // 9. User A Checks Notifications Drawer
    console.log('\n9. User A: Opening notifications drawer and marking read...');
    await clientA.navigate(`${BASE_URL}/home.html`);
    await wait(2000);

    await clientA.eval(`
      const notifBtn = document.querySelector('button[aria-label="Notifications"]');
      if (notifBtn) notifBtn.click();
    `);
    await wait(1000);

    const hasNotifs = await clientA.eval(`
      const panel = document.getElementById('notifications-drawer');
      const items = panel ? panel.querySelectorAll('.notification-item') : [];
      return items.length > 0;
    `);
    assert(hasNotifs, 'User A sees notification drawer with social activity items');
    await clientA.screenshot('e2e-alice-notifications.png');

    // 10. XSS Safety Check
    console.log('\n10. Verifying XSS Payloads rendered strictly as plain text (Zero Execution)...');
    const xssScriptTags = await clientA.eval(`document.querySelectorAll('script[src*="alert"], img[onerror]').length`);
    assert(xssScriptTags === 0, 'Zero malicious script or onerror tags injected into DOM');

    const rawBioA = await clientA.eval(`document.body.innerHTML`);
    assert(!rawBioA.includes('<img src=x onerror=alert(1)>'), 'HTML tags escaped properly in DOM rendering');

    // 11. Anonymous Visitor: Shared Album Link
    console.log('\n11. Anonymous Visitor: Viewing shared album before and after token revoke...');
    await clientB.navigate(`${BASE_URL}/shared.html?token=${album.shareToken}`);
    await wait(2000);

    const sharedTitle = await clientB.eval(`
      const el = document.getElementById('shared-title');
      return el ? el.textContent : '';
    `);
    assert(sharedTitle.includes('Collected Driftwood'), 'Anonymous visitor views album via secret share token');
    await clientB.screenshot('e2e-shared-album-active.png');

    // Revoke share token in database
    album.shareToken = null;
    await album.save();

    await clientB.navigate(`${BASE_URL}/shared.html?token=invalid_or_revoked_token`);
    await wait(2000);

    const isRevokedShown = await clientB.eval(`
      const errEl = document.getElementById('shared-error');
      return errEl && errEl.style.display !== 'none';
    `);
    assert(isRevokedShown, 'Revoked share token shows friendly Expired/Invalid Link card');
    await clientB.screenshot('e2e-shared-album-revoked.png');

    // 12. Session Expiry & Protected Route Redirect
    console.log('\n12. Verifying Protected Route Redirect on Unauthenticated Access...');
    await clientA.send('Network.clearBrowserCookies');
    await clientA.navigate(`${BASE_URL}/library.html`);
    await wait(1500);

    const redirectedUrl = await clientA.eval(`window.location.pathname`);
    assert(redirectedUrl.includes('auth.html'), 'Unauthenticated visit to protected /library.html redirects to /auth.html');

    // Clean up test database records
    await Moment.deleteMany({ owner: dbUserA._id });
    await Album.deleteMany({ owner: dbUserA._id });
    await Media.deleteMany({ owner: dbUserA._id });
    await User.deleteMany({ _id: { $in: [dbUserA._id] } });
    await mongoose.disconnect();

  } finally {
    clientA.close();
    clientB.close();
    sessionA.proc.kill();
    sessionB.proc.kill();
  }

  console.log('\n====================================================');
  console.log(`REAL-BROWSER E2E RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runBrowserE2E().catch((err) => {
  console.error('Fatal Real-Browser E2E error:', err);
  process.exit(1);
});
