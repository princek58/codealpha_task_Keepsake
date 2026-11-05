const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9888;

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function verifyResponsive() {
  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-verify-'));
  const chromeProcess = spawn(
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

  await wait(1000);
  const targets = await fetchJson(`http://localhost:${PORT}/json/list`);
  const ws = new WebSocket(targets[0].webSocketDebuggerUrl);

  let id = 1;
  const callbacks = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg.result);
      callbacks.delete(msg.id);
    }
  };

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const msgId = id++;
      callbacks.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable');
  await send('Runtime.enable');

  const pages = [
    { url: 'http://localhost:5000/', name: 'Landing' },
    { url: 'http://localhost:5000/styleguide.html', name: 'Styleguide' },
    { url: 'http://localhost:5000/dev/playground.html', name: 'Playground' },
    { url: 'http://localhost:5000/404.html', name: '404 Page' }
  ];

  let anyFailures = false;

  for (const page of pages) {
    await send('Page.navigate', { url: page.url });
    await wait(1200);

    for (const w of [320, 375, 768, 1024, 1440, 1920]) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: 800,
        deviceScaleFactor: 1,
        mobile: w <= 768
      });
      await wait(100);

      const res = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const docWidth = document.documentElement.clientWidth;
            const scrollWidth = document.documentElement.scrollWidth;
            let overflowing = 0;
            for (const el of document.querySelectorAll('*')) {
              const r = el.getBoundingClientRect();
              if (r.right > docWidth + 1) overflowing++;
            }
            return { docWidth, scrollWidth, overflowing };
          })()
        `,
        returnByValue: true
      });

      const { docWidth, scrollWidth, overflowing } = res.result.value;
      if (overflowing > 0) {
        console.error(`[FAIL] ${page.name} at ${w}px has ${overflowing} overflowing elements! (scrollWidth: ${scrollWidth})`);
        anyFailures = true;
      } else {
        console.log(`[PASS] ${page.name} at ${w}px — perfectly contained (0 overflow)`);
      }
    }
  }

  ws.close();
  chromeProcess.kill();
  try {
    fs.rmSync(tmpProfile, { recursive: true, force: true });
  } catch (e) {}

  if (anyFailures) process.exit(1);
  console.log('\nAll pages passed responsive verification across all viewports!');
}

verifyResponsive().catch((e) => {
  console.error(e);
  process.exit(1);
});
