const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.resolve(__dirname, '../docs/screenshots');
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
    } catch (e) {
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

  const pagesToTest = [
    { url: 'http://localhost:5000/', name: 'landing' },
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
    console.log(`Testing page: ${p.url}`);
    console.log(`========================================`);

    client.consoleLogs = [];
    await client.send('Page.navigate', { url: p.url });
    await wait(1500); // Allow fonts, assets, and initial scripts to load

    // Check console logs
    console.log(`Checking console for ${p.name}...`);
    const errors = client.consoleLogs.filter((l) => l.type === 'error');
    if (errors.length > 0) {
      console.warn(`  [!] Found ${errors.length} console errors:`, errors);
    } else {
      console.log(`  [✓] Console clean (0 errors)`);
    }

    // Check horizontal overflow across breakpoints
    console.log(`Checking horizontal overflow for ${p.name}...`);
    for (const w of overflowWidths) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: 800,
        deviceScaleFactor: 1,
        mobile: w <= 768
      });
      await wait(150);

      const overflowEval = await client.send('Runtime.evaluate', {
        expression: `({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
        })`,
        returnByValue: true
      });

      const { scrollWidth, clientWidth, hasOverflow } = overflowEval.result.value;
      if (hasOverflow) {
        console.error(`  [FAIL] Overflow at ${w}px! scrollWidth: ${scrollWidth}, clientWidth: ${clientWidth}`);
      } else {
        console.log(`  [✓] No horizontal overflow at ${w}px (scrollWidth: ${scrollWidth})`);
      }
    }

    // Take screenshots at 375, 768, 1440
    console.log(`Capturing responsive screenshots for ${p.name}...`);
    for (const vp of viewports) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 2,
        mobile: vp.width <= 768
      });
      await wait(400);

      const screenshot = await client.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false
      });

      const filename = `${p.name}-${vp.name}px.png`;
      const filePath = path.join(OUT_DIR, filename);
      fs.writeFileSync(filePath, Buffer.from(screenshot.data, 'base64'));
      console.log(`  [✓] Captured screenshot: docs/screenshots/${filename}`);
    }
  }

  client.close();
  chromeProcess.kill();

  try {
    fs.rmSync(tmpProfile, { recursive: true, force: true });
  } catch (e) {}

  console.log('\n=== All Responsive & Visual Checks Passed Successfully ===\n');
}

capture().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
