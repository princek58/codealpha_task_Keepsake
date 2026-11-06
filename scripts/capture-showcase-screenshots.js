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
const PORT = 9893;
const SCREENSHOTS_DIR = path.join(__dirname, '../docs/screenshots');

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
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
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
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
    return res.result?.value;
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await wait(1500);
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }
  }
}

async function capture() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  await mongoose.connect(config.mongodbUri);
  const sampleMoment = await Moment.findOne({ 'layout.type': 'collage' }) || await Moment.findOne({});
  const sampleAlbum = await Album.findOne({ 'media.0': { $exists: true } }) || await Album.findOne({});
  await mongoose.disconnect();

  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-ss-'));
  const proc = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${tmpProfile}`,
      '--disable-gpu',
      '--no-sandbox',
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
      await wait(250);
    }
  }

  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');

  const takeScreenshot = async (filename, width, height, isMobile = false) => {
    await client.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: isMobile
    });
    await wait(300);

    await client.eval(`
      (async () => {
        document.querySelectorAll('img').forEach(img => { img.loading = 'eager'; });
        window.scrollTo(0, 300);
        await new Promise(r => setTimeout(r, 100));
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 100));
      })()
    `);
    await wait(400);

    const res = await client.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    const outPath = path.join(SCREENSHOTS_DIR, filename);
    fs.writeFileSync(outPath, buf);
    console.log(`Saved screenshot: ${filename} (${width}x${height}, ${(buf.length / 1024).toFixed(1)} KB)`);
  };

  try {
    // 1. Landing Desktop (1440x900)
    await client.navigate('http://localhost:5000/index.html');
    await takeScreenshot('landing-desktop.png', 1440, 900);
    await takeScreenshot('landing-1440px.png', 1440, 900);

    // 2. Landing Mobile (375x812)
    await client.navigate('http://localhost:5000/index.html');
    await takeScreenshot('landing-mobile.png', 375, 812, true);
    await takeScreenshot('landing-375px.png', 375, 812, true);

    // 3. Login as clara
    await client.navigate('http://localhost:5000/auth.html');
    await client.eval(`
      (async () => {
        const idInput = document.getElementById('login-identifier');
        const passInput = document.getElementById('login-password');
        const submitBtn = document.querySelector('#login-form button[type="submit"]') || document.querySelector('button[type="submit"]');
        if (idInput && passInput) {
          idInput.value = 'clara';
          passInput.value = 'password123';
          idInput.dispatchEvent(new Event('input', { bubbles: true }));
          passInput.dispatchEvent(new Event('input', { bubbles: true }));
          if (submitBtn) submitBtn.click();
        }
      })()
    `);
    await wait(1800);

    // 4. Feed Desktop (1440x900)
    await client.navigate('http://localhost:5000/home.html');
    await takeScreenshot('feed-desktop.png', 1440, 900);
    await takeScreenshot('home-1440px.png', 1440, 900);

    // 5. Moment Collage (1440x900)
    if (sampleMoment) {
      await client.navigate(`http://localhost:5000/moment.html?id=${sampleMoment._id}`);
      await takeScreenshot('moment-collage.png', 1440, 900);
      await takeScreenshot('moment-1440px.png', 1440, 900);
    }

    // 6. Album Desktop (1440x900)
    if (sampleAlbum) {
      await client.navigate(`http://localhost:5000/album.html?id=${sampleAlbum._id}`);
      await takeScreenshot('album-desktop.png', 1440, 900);
      await takeScreenshot('album-1440px.png', 1440, 900);
    }

    // 7. Lightbox Desktop (1440x900)
    await client.navigate('http://localhost:5000/index.html');
    await client.eval(`
      (() => {
        const p = document.getElementById('polaroid-btn-1');
        if (p) p.click();
      })()
    `);
    await wait(600);
    await takeScreenshot('lightbox-desktop.png', 1440, 900);

    console.log('All showcase screenshots captured successfully!');
  } finally {
    client.close();
    proc.kill();
    try {
      fs.rmSync(tmpProfile, { recursive: true, force: true });
    } catch {}
  }
}

capture().catch((err) => {
  console.error('Failed to capture screenshots:', err);
  process.exit(1);
});
