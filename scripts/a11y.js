// Keepsake WCAG 2.1 AA Accessibility Audit via axe-core and Chrome DevTools Protocol
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const config = require('../server/config');
const User = require('../server/models/User');
const Moment = require('../server/models/Moment');
const Album = require('../server/models/Album');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const AXE_SRC = fs.readFileSync(path.resolve(__dirname, '../node_modules/axe-core/axe.min.js'), 'utf8');
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const PORT = 9455;

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
    await wait(2000);
  }

  async runAxe() {
    // Inject axe script
    await this.send('Runtime.evaluate', {
      expression: AXE_SRC,
      returnByValue: false
    });

    // Run axe against WCAG 2.1 AA
    const results = await this.eval(`
      return new Promise((resolve) => {
        window.axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
          }
        }).then(resolve).catch(err => resolve({ error: err.message, violations: [] }));
      });
    `);

    return results;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function launchChrome(port) {
  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), `chrome-a11y-${port}-`));
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

async function runA11yAudit() {
  console.log('====================================================');
  console.log('       Keepsake WCAG 2.1 AA Accessibility Audit     ');
  console.log('====================================================\n');

  await mongoose.connect(config.mongodbUri);

  // Find or create test user for authenticated audit
  let auditUser = await User.findOne({ username: 'a11y_auditor' });
  if (!auditUser) {
    auditUser = await User.create({
      username: 'a11y_auditor',
      email: 'a11y@example.com',
      passwordHash: 'dummyhash',
      displayName: 'A11y Auditor'
    });
  }

  const Media = require('../server/models/Media');

  let sampleAlbum = await Album.findOne({ visibility: 'public', shareToken: { $ne: null } });
  let sampleMoment = await Moment.findOne({ visibility: 'public' });

  if (!sampleMoment) {
    const sampleMedia = await Media.create({
      owner: auditUser._id,
      type: 'image',
      status: 'ready',
      mime: 'image/jpeg',
      originalName: 'a11y_test.jpg',
      sizeBytes: 1024,
      width: 800,
      height: 600,
      paths: {
        original: `${auditUser._id}/a11y/original.jpg`,
        display: `${auditUser._id}/a11y/display.webp`,
        thumb: `${auditUser._id}/a11y/thumb.webp`
      }
    });

    sampleMoment = await Moment.create({
      owner: auditUser._id,
      title: 'Morning Shadows',
      caption: 'Testing accessible landmarks and tags',
      media: [sampleMedia._id],
      visibility: 'public'
    });
  }

  if (!sampleAlbum) {
    sampleAlbum = await Album.create({
      owner: auditUser._id,
      title: 'Auditing Architecture',
      description: 'Album for accessibility audit verification',
      visibility: 'public',
      shareToken: 'a11y_token_share'
    });
  }

  const token = jwt.sign({ id: auditUser._id }, config.jwtSecret, { expiresIn: '1d' });

  const session = await launchChrome(PORT);
  const client = session.client;

  let totalViolations = 0;
  let pagesAudited = 0;

  try {
    // Set authentication cookie
    await client.send('Network.setCookie', {
      name: 'token',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax'
    });

    const testTargets = [
      { name: 'Landing Page', url: `${BASE_URL}/landing.html` },
      { name: 'Auth Page (Login)', url: `${BASE_URL}/auth.html#login` },
      { name: 'Auth Page (Register)', url: `${BASE_URL}/auth.html#register` },
      { name: 'Home Feed Page', url: `${BASE_URL}/home.html` },
      { name: 'Media Library Page', url: `${BASE_URL}/library.html` },
      { name: 'Create Moment Page', url: `${BASE_URL}/moment-new.html` },
      { name: 'Single Moment Page', url: `${BASE_URL}/moment.html?id=${sampleMoment._id}` },
      { name: 'Albums Overview Page', url: `${BASE_URL}/albums.html` },
      { name: 'Single Album Page', url: `${BASE_URL}/album.html?id=${sampleAlbum._id}` },
      { name: 'Explore Stream Page', url: `${BASE_URL}/explore.html` },
      { name: 'Profile Page', url: `${BASE_URL}/profile.html?u=${auditUser.username}` },
      { name: 'Settings Page', url: `${BASE_URL}/settings.html` },
      { name: 'Shared Album View (Anonymous)', url: `${BASE_URL}/shared.html?token=${sampleAlbum.shareToken}` }
    ];

    for (const target of testTargets) {
      pagesAudited++;
      console.log(`Auditing: ${target.name}...`);
      await client.navigate(target.url);
      await wait(1000);

      const results = await client.runAxe();
      const violations = results.violations || [];

      if (violations.length === 0) {
        console.log(`  ✓ 0 violations found`);
      } else {
        totalViolations += violations.length;
        console.error(`  ✗ ${violations.length} violations in ${target.name}:`);
        violations.forEach((v) => {
          console.error(`    - [${v.id}] ${v.help} (${v.impact})`);
          console.error(`      Help URL: ${v.helpUrl}`);
          v.nodes.slice(0, 3).forEach((n) => {
            console.error(`      Target: ${n.target.join(' ')}`);
          });
        });
      }
    }

    // Interactive States:
    console.log('\nAuditing Interactive State: Notifications Drawer...');
    await client.navigate(`${BASE_URL}/home.html`);
    await wait(1000);
    await client.eval(`
      const btn = document.querySelector('button[aria-label="Notifications"]');
      if (btn) btn.click();
    `);
    await wait(800);
    const drawerRes = await client.runAxe();
    const drawerViolations = drawerRes.violations || [];
    pagesAudited++;
    if (drawerViolations.length === 0) {
      console.log('  ✓ 0 violations in Notifications Drawer');
    } else {
      totalViolations += drawerViolations.length;
      console.error(`  ✗ ${drawerViolations.length} violations in Notifications Drawer:`);
      drawerViolations.forEach((v) => {
        console.error(`    - [${v.id}] ${v.help} (${v.impact})`);
      });
    }

    console.log('\nAuditing Interactive State: Create Album Modal...');
    await client.navigate(`${BASE_URL}/albums.html`);
    await wait(1000);
    await client.eval(`
      const btn = document.getElementById('btn-new-album');
      if (btn) btn.click();
    `);
    await wait(800);
    const modalRes = await client.runAxe();
    const modalViolations = modalRes.violations || [];
    pagesAudited++;
    if (modalViolations.length === 0) {
      console.log('  ✓ 0 violations in Create Album Modal');
    } else {
      totalViolations += modalViolations.length;
      console.error(`  ✗ ${modalViolations.length} violations in Create Album Modal:`);
      modalViolations.forEach((v) => {
        console.error(`    - [${v.id}] ${v.help} (${v.impact})`);
      });
    }

    console.log('\nAuditing Interactive State: Lightbox...');
    await client.navigate(`${BASE_URL}/shared.html?token=${sampleAlbum.shareToken}`);
    await wait(1000);
    await client.eval(`
      const tile = document.querySelector('.gallery-tile, .card');
      if (tile) tile.click();
    `);
    await wait(800);
    const lightboxRes = await client.runAxe();
    const lightboxViolations = lightboxRes.violations || [];
    pagesAudited++;
    if (lightboxViolations.length === 0) {
      console.log('  ✓ 0 violations in Lightbox');
    } else {
      totalViolations += lightboxViolations.length;
      console.error(`  ✗ ${lightboxViolations.length} violations in Lightbox:`);
      lightboxViolations.forEach((v) => {
        console.error(`    - [${v.id}] ${v.help} (${v.impact})`);
      });
    }

  } finally {
    client.close();
    session.proc.kill();
    await User.deleteMany({ username: 'a11y_auditor' });
    await Album.deleteMany({ title: 'Auditing Architecture' });
    await Moment.deleteMany({ title: 'Morning Shadows' });
    await mongoose.disconnect();
  }

  console.log('\n====================================================');
  console.log(`ACCESSIBILITY AUDIT SUMMARY:`);
  console.log(`Total Targets Audited: ${pagesAudited}`);
  console.log(`Total Violations:      ${totalViolations}`);
  console.log('====================================================\n');

  if (totalViolations > 0) {
    process.exit(1);
  }
}

runA11yAudit().catch((err) => {
  console.error('Fatal A11y Audit error:', err);
  process.exit(1);
});
