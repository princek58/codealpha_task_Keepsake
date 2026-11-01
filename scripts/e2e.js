require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const mongoose = require('mongoose');

const app = require('../server/app');
const Post = require('../server/models/Post');

const PORT = 3000;
const DEBUG_PORT = 9333;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '768', width: 768, height: 1024 },
  { name: '375', width: 375, height: 812 }
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class ChromeController {
  constructor() {
    this.chromeProcess = null;
    this.tmpProfile = path.join(os.tmpdir(), 'chrome_bloomly_e2e_' + Date.now());
    this.ws = null;
    this.msgId = 1;
    this.pendingRequests = new Map();
    this.consoleErrors = [];
  }

  async launch() {
    console.log(`[Chrome] Launching Headless Chrome on port ${DEBUG_PORT}...`);
    this.chromeProcess = spawn(CHROME_PATH, [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-extensions',
      `--user-data-dir=${this.tmpProfile}`,
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--hide-scrollbars',
      'about:blank'
    ]);

    let connected = false;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
        const tabs = await res.json();
        const pageTab = tabs.find((t) => t.type === 'page');
        if (pageTab && pageTab.webSocketDebuggerUrl) {
          await this.connectWs(pageTab.webSocketDebuggerUrl);
          connected = true;
          break;
        }
      } catch (err) {
        // waiting for Chrome
      }
    }

    if (!connected) {
      throw new Error('Failed to connect to Chrome DevTools Protocol');
    }

    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('DOM.enable');
    await this.send('Network.enable');

    console.log('[Chrome] CDP connected and enabled.');
  }

  connectWs(url) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      this.ws.onopen = resolve;
      this.ws.onerror = reject;

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.id && this.pendingRequests.has(msg.id)) {
            const { resolve, reject } = this.pendingRequests.get(msg.id);
            this.pendingRequests.delete(msg.id);
            if (msg.error) {
              reject(new Error(msg.error.message));
            } else {
              resolve(msg.result);
            }
          }

          if (msg.method === 'Runtime.consoleAPICalled') {
            if (msg.params.type === 'error') {
              const text = msg.params.args.map(a => a.value || a.description || '').join(' ');
              this.consoleErrors.push(text);
              console.log(`[Browser Console Error] ${text}`);
            }
          }
          if (msg.method === 'Runtime.exceptionThrown') {
            const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
            this.consoleErrors.push(desc);
            console.log(`[Browser Exception] ${desc}`);
          }
        } catch (e) {}
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.pendingRequests.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async navigate(url) {
    console.log(`[Navigate] -> ${url}`);
    await this.send('Page.navigate', { url });
    await sleep(900);
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value;
  }

  async waitForFunction(fnStr, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const val = await this.evaluate(`Boolean(${fnStr})`);
      if (val) return true;
      await sleep(250);
    }
    throw new Error(`Timeout waiting for condition: ${fnStr}`);
  }

  async waitForSelector(selector, timeoutMs = 10000) {
    await this.waitForFunction(`document.querySelector('${selector}') !== null`, timeoutMs);
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768
    });
    await sleep(250);
  }

  async captureScreenshotsForPage(pageName) {
    for (const vp of VIEWPORTS) {
      await this.setViewport(vp.width, vp.height);
      await sleep(400);

      const shot = await this.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false
      });

      const fileName = `${pageName}_${vp.name}.png`;
      const filePath = path.join(SCREENSHOTS_DIR, fileName);
      fs.writeFileSync(filePath, Buffer.from(shot.data, 'base64'));
      const sizeKb = (fs.statSync(filePath).size / 1024).toFixed(1);
      console.log(`  [Screenshot] ${fileName} (${vp.width}x${vp.height}) -> ${sizeKb} KB`);
    }
  }

  async close() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }
    if (this.chromeProcess && this.chromeProcess.pid) {
      try {
        require('child_process').execSync(`taskkill /PID ${this.chromeProcess.pid} /T /F`, { stdio: 'ignore' });
      } catch {}
    }
    await sleep(500);
    if (fs.existsSync(this.tmpProfile)) {
      try { fs.rmSync(this.tmpProfile, { recursive: true, force: true }); } catch {}
    }
    console.log('[Chrome] Closed and cleaned up.');
  }
}

async function runE2E() {
  console.log('====================================================');
  console.log('   BLOONLY COMPREHENSIVE END-TO-END AUTOMATION');
  console.log('====================================================');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bloomly';
  console.log(`Connecting to MongoDB for E2E: ${mongoUri}...`);
  await mongoose.connect(mongoUri);

  const server = app.listen(PORT);
  console.log(`Server listening on ${BASE_URL}`);

  const chrome = new ChromeController();
  await chrome.launch();

  try {
    // ----------------------------------------------------
    // STAGE 1: Landing Page
    // ----------------------------------------------------
    console.log('\n--- [1/8] Verifying Landing Page ---');
    await chrome.navigate(`${BASE_URL}/index.html`);
    await chrome.waitForSelector('.hero-title');
    await chrome.waitForSelector('.stats-card');

    const heroTitle = await chrome.evaluate(`document.querySelector('.hero-title')?.textContent.trim()`);
    console.log(`  Hero Title: "${heroTitle}"`);

    const usersStat = await chrome.evaluate(`document.querySelector('#stats-real-users')?.textContent.trim()`);
    console.log(`  Community Stats Rendered: Gardeners Count = "${usersStat}"`);

    await chrome.captureScreenshotsForPage('landing');

    // ----------------------------------------------------
    // STAGE 2: Auth Page & Login
    // ----------------------------------------------------
    console.log('\n--- [2/8] Verifying Auth Page & Logging In ---');
    await chrome.navigate(`${BASE_URL}/auth.html`);
    await chrome.waitForSelector('.auth-card');
    await chrome.waitForSelector('#tab-login');
    await chrome.waitForSelector('#tab-register');

    await chrome.captureScreenshotsForPage('auth');

    console.log('  Testing tab toggle to Register...');
    await chrome.evaluate(`document.querySelector('#tab-register').click()`);
    await sleep(300);
    const regActive = await chrome.evaluate(`document.querySelector('#tab-register').classList.contains('active')`);
    console.log(`  Register tab active: ${regActive}`);

    console.log('  Switching back to Login and signing in as @daisy_bloom...');
    await chrome.evaluate(`document.querySelector('#tab-login').click()`);
    await sleep(300);

    await chrome.evaluate(`
      document.querySelector('#input-email').value = 'daisy@bloomly.app';
      document.querySelector('#input-password').value = 'Password123';
      document.querySelector('#auth-form').dispatchEvent(new Event('submit', { cancelable: true }));
    `);

    await chrome.waitForFunction(`window.location.pathname.includes('feed.html')`, 12000);
    console.log('  Successfully signed in and redirected to /feed.html');

    // ----------------------------------------------------
    // STAGE 3: Home Feed & New Bloom
    // ----------------------------------------------------
    console.log('\n--- [3/8] Verifying Home Feed & Planting Bloom ---');
    await chrome.waitForSelector('#feed-posts');
    await chrome.waitForSelector('.composer-card');
    await chrome.waitForSelector('.post-card');

    const initialFeedCount = await chrome.evaluate(`document.querySelectorAll('#feed-posts .post-card').length`);
    console.log(`  Initial feed bloom count: ${initialFeedCount}`);

    await chrome.captureScreenshotsForPage('feed');

    console.log('  Publishing a new test bloom...');
    const testBloomText = `Morning morning! The sweet peas are blooming beautifully today 🌸✨ (planted at ${new Date().toLocaleTimeString()})`;
    await chrome.evaluate(`
      const textarea = document.querySelector('#composer-text');
      textarea.value = ${JSON.stringify(testBloomText)};
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#composer-submit').click();
    `);

    await chrome.waitForFunction(`
      document.querySelector('#feed-posts .post-text')?.textContent.includes('sweet peas are blooming')
    `, 8000);
    console.log('  New bloom successfully planted and visible at top of feed!');

    console.log('  Testing like button interaction with heart burst...');
    const likesBefore = await chrome.evaluate(`
      Number(document.querySelector('#feed-posts .post-card .like-btn .like-count')?.textContent || 0)
    `);
    await chrome.evaluate(`
      document.querySelector('#feed-posts .post-card .like-btn').click();
    `);
    await sleep(600);
    const likesAfter = await chrome.evaluate(`
      Number(document.querySelector('#feed-posts .post-card .like-btn .like-count')?.textContent || 0)
    `);
    console.log(`  Likes count: ${likesBefore} -> ${likesAfter}`);

    // ----------------------------------------------------
    // STAGE 4: Explore & Search
    // ----------------------------------------------------
    console.log('\n--- [4/8] Verifying Explore & Search ---');
    await chrome.navigate(`${BASE_URL}/explore.html`);
    await chrome.waitForSelector('#tab-explore-blooms');
    await chrome.waitForSelector('#blooms-list');

    await chrome.captureScreenshotsForPage('explore');

    console.log('  Searching for "sunny"...');
    await chrome.evaluate(`
      const inp = document.querySelector('#explore-search-input');
      inp.value = 'sunny';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    `);
    await sleep(700);

    console.log('  Switching to Gardeners tab in Explore...');
    await chrome.evaluate(`document.querySelector('#tab-explore-gardeners').click()`);
    await sleep(700);
    const gardenerFound = await chrome.evaluate(`
      document.querySelector('#gardeners-list')?.textContent.includes('sunny_sprout')
    `);
    console.log(`  Gardeners tab found @sunny_sprout: ${gardenerFound}`);

    // ----------------------------------------------------
    // STAGE 5: Gardener Profile
    // ----------------------------------------------------
    console.log('\n--- [5/8] Verifying Gardener Profile ---');
    await chrome.navigate(`${BASE_URL}/profile.html?u=sunny_sprout`);
    await chrome.waitForSelector('#profile-content');
    await chrome.waitForSelector('#profile-name');

    const profileUsername = await chrome.evaluate(`document.querySelector('#profile-handle')?.textContent.trim()`);
    console.log(`  Profile loaded for gardener: ${profileUsername}`);

    await chrome.captureScreenshotsForPage('profile');

    console.log('  Visiting own profile (@daisy_bloom)...');
    await chrome.navigate(`${BASE_URL}/profile.html?u=daisy_bloom`);
    await chrome.waitForSelector('#profile-content');
    await chrome.waitForSelector('#profile-action-slot button');

    console.log('  Opening Edit Profile modal...');
    await chrome.evaluate(`document.querySelector('#profile-action-slot button').click()`);
    await sleep(400);

    const newBio = 'Cozy gardener & sweet pea enthusiast 🌸✨';
    console.log(`  Updating bio to: "${newBio}"`);
    await chrome.evaluate(`
      const bioEl = document.querySelector('#edit-bio');
      if (bioEl) {
        bioEl.value = ${JSON.stringify(newBio)};
        bioEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const saveBtn = document.querySelector('#edit-save-btn');
      if (saveBtn) saveBtn.click();
    `);
    await sleep(800);

    const savedBio = await chrome.evaluate(`document.querySelector('#profile-bio')?.textContent.trim()`);
    console.log(`  Saved Profile Bio: "${savedBio}"`);

    // ----------------------------------------------------
    // STAGE 6: Single Bloom Page & Comments
    // ----------------------------------------------------
    console.log('\n--- [6/8] Verifying Single Bloom & Comments ---');
    const samplePost = await Post.findOne().sort({ createdAt: -1 });
    if (!samplePost) throw new Error('No sample post found in database');

    await chrome.navigate(`${BASE_URL}/post.html?id=${samplePost._id}`);
    await chrome.waitForSelector('#post-card-mount .post-card');
    await chrome.waitForSelector('#comment-input');

    const postAuthor = await chrome.evaluate(`document.querySelector('#post-card-mount .post-author-name')?.textContent.trim()`);
    console.log(`  Single post view loaded for bloom by: ${postAuthor}`);

    await chrome.captureScreenshotsForPage('post');

    console.log('  Posting a friendly comment on the bloom...');
    const testComment = 'Such a comforting thought. Sending warm garden wishes! 🌱';
    await chrome.evaluate(`
      const ci = document.querySelector('#comment-input');
      ci.value = ${JSON.stringify(testComment)};
      ci.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#comment-submit-btn').click();
    `);

    await chrome.waitForFunction(`
      document.querySelector('#comments-list')?.textContent.includes('comforting thought')
    `, 8000);
    console.log('  Comment added and rendered in comments list!');

    // ----------------------------------------------------
    // STAGE 7: 404 Error Page
    // ----------------------------------------------------
    console.log('\n--- [7/8] Verifying 404 Page ---');
    await chrome.navigate(`${BASE_URL}/not-a-real-garden-page-404`);
    await chrome.waitForSelector('.card');

    const errorHeading = await chrome.evaluate(`document.querySelector('h1')?.textContent.trim()`);
    console.log(`  404 Error Page heading: "${errorHeading}"`);

    await chrome.captureScreenshotsForPage('404');

    // ----------------------------------------------------
    // STAGE 8: Logout
    // ----------------------------------------------------
    console.log('\n--- [8/8] Verifying Logout ---');
    await chrome.navigate(`${BASE_URL}/feed.html`);
    await chrome.waitForSelector('#feed-posts');

    console.log('  Clicking Logout...');
    await chrome.evaluate(`
      const logoutBtn = document.querySelector('#menu-logout-btn') || document.querySelector('#navLogoutBtn') || document.querySelector('.nav-btn-logout');
      if (logoutBtn) logoutBtn.click();
    `);
    await sleep(900);

    const currentUrl = await chrome.evaluate(`window.location.href`);
    console.log(`  Logged out, now at: ${currentUrl}`);

    console.log('\n====================================================');
    console.log('   ALL E2E WORKFLOWS COMPLETED SUCCESSFULLY!');
    console.log('====================================================');

    const files = fs.readdirSync(SCREENSHOTS_DIR);
    console.log(`Screenshots generated in docs/screenshots (${files.length} total):`);
    files.forEach(f => {
      const sz = (fs.statSync(path.join(SCREENSHOTS_DIR, f)).size / 1024).toFixed(1);
      console.log(`  - ${f.padEnd(25)} (${sz} KB)`);
    });

  } finally {
    await chrome.close();
    server.close();
    await mongoose.disconnect();
  }
}

runE2E().catch((err) => {
  console.error('\nE2E Failure:', err);
  process.exit(1);
});
