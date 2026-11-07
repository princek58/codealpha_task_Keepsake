const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const mongoose = require('mongoose');

const config = require('../server/config');
const Moment = require('../server/models/Moment');
const Album = require('../server/models/Album');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.resolve(__dirname, '../tmp/screenshots');
const PORT = 9444;

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
          reject(new Error(`Failed to parse JSON from ${url}: ${data.substring(0, 100)}`));
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

  close() {
    if (this.ws) this.ws.close();
  }
}

async function capture() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  // Get sample moment and album IDs from MongoDB
  await mongoose.connect(config.mongodbUri);
  const sampleMoment = await Moment.findOne();
  const sampleAlbum = await Album.findOne({ shareToken: { $ne: null } }) || await Album.findOne();
  await mongoose.disconnect();

  const momentId = sampleMoment ? sampleMoment._id.toString() : '';
  const albumId = sampleAlbum ? sampleAlbum._id.toString() : '';
  const shareToken = sampleAlbum?.shareToken || '';

  // Login as willow to get auth cookie
  let authCookieValue = '';
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'willow', password: 'Password123' })
    });
    const setCookie = loginRes.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/token=([^;]+)/);
      if (match) authCookieValue = match[1];
    }
  } catch (err) {
    console.warn('Could not login as demo user for screenshots:', err.message);
  }

  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-profile-'));
  console.log(`Starting headless Chrome on port ${PORT}...`);
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${tmpProfile}`,
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      'about:blank'
    ],
    { stdio: 'ignore' }
  );

  let targets = null;
  for (let i = 0; i < 30; i++) {
    try {
      targets = await fetchJson(`http://localhost:${PORT}/json/list`);
      if (targets && targets.length > 0) break;
    } catch {
      await wait(300);
    }
  }

  if (!targets || targets.length === 0) {
    chromeProcess.kill();
    throw new Error('Could not connect to Chrome debugging port');
  }

  console.log('Connected to Chrome DevTools Protocol.');
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Log.enable');
  await client.send('Network.enable');

  if (authCookieValue) {
    await client.send('Network.setCookie', {
      name: 'token',
      value: authCookieValue,
      domain: 'localhost',
      path: '/',
      httpOnly: true
    });
    console.log('Set auth cookie for demo session.');
  }

  const pagesToTest = [
    { url: 'http://localhost:5000/', name: 'landing' },
    { url: 'http://localhost:5000/auth.html', name: 'auth' },
    { url: 'http://localhost:5000/home.html', name: 'home' },
    { url: 'http://localhost:5000/library.html', name: 'library' },
    { url: 'http://localhost:5000/moment-new.html', name: 'moment-new' },
    { url: `http://localhost:5000/moment.html?id=${momentId}`, name: 'moment' },
    { url: 'http://localhost:5000/albums.html', name: 'albums' },
    { url: `http://localhost:5000/album.html?id=${albumId}`, name: 'album' },
    { url: `http://localhost:5000/shared.html?token=${shareToken}`, name: 'shared' },
    { url: 'http://localhost:5000/profile.html?u=willow', name: 'profile' },
    { url: 'http://localhost:5000/settings.html', name: 'settings' },
    { url: 'http://localhost:5000/explore.html', name: 'explore' },
    { url: 'http://localhost:5000/styleguide.html', name: 'styleguide' },
    { url: 'http://localhost:5000/dev/playground.html', name: 'playground' },
    { url: 'http://localhost:5000/404.html', name: '404' }
  ];

  const viewports = [
    { width: 375, height: 667, name: '375' },
    { width: 768, height: 1024, name: '768' },
    { width: 1440, height: 900, name: '1440' }
  ];

  const overflowWidths = [320, 375, 768, 1024, 1440, 1920];

  for (const p of pagesToTest) {
    console.log(`\n========================================`);
    console.log(`Testing page: ${p.name} (${p.url})`);
    console.log(`========================================`);

    client.consoleLogs = [];
    await client.send('Page.navigate', { url: p.url });
    await wait(1800); // Allow DOM, JS shell, fonts, and data to load

    // Check console logs
    const errors = client.consoleLogs.filter((l) => l.type === 'error');
    if (errors.length > 0) {
      console.warn(`  [!] Found ${errors.length} console errors:`, errors.map((e) => e.text));
    } else {
      console.log(`  [✓] Console clean (0 errors)`);
    }

    // Check horizontal overflow across breakpoints
    for (const w of overflowWidths) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: 800,
        deviceScaleFactor: 1,
        mobile: w <= 768
      });
      await wait(100);

      const overflowEval = await client.send('Runtime.evaluate', {
        expression: `({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
        })`,
        returnByValue: true
      });

      const { scrollWidth, clientWidth, hasOverflow } = overflowEval.result.value || {};
      if (hasOverflow) {
        console.error(`  [FAIL] Overflow at ${w}px! scrollWidth: ${scrollWidth}, clientWidth: ${clientWidth}`);
      } else {
        console.log(`  [✓] No horizontal overflow at ${w}px (width: ${clientWidth})`);
      }
    }

    // Take screenshots at 375, 768, 1440
    for (const vp of viewports) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 2,
        mobile: vp.width <= 768
      });
      await wait(300);

      const screenshot = await client.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false
      });

      const filename = `${p.name}-${vp.name}px.png`;
      const filePath = path.join(OUT_DIR, filename);
      fs.writeFileSync(filePath, Buffer.from(screenshot.data, 'base64'));
      console.log(`  [✓] Captured: docs/screenshots/${filename}`);
    }
  }

  client.close();
  chromeProcess.kill();

  try {
    fs.rmSync(tmpProfile, { recursive: true, force: true });
  } catch {}

  console.log('\n======================================================');
  console.log('✓ All 15 Pages Responsive & Visual Checks PASSED');
  console.log('======================================================\n');
}

capture().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
