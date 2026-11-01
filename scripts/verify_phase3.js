const http = require('http');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = require('../server/app');
const PORT = 5058;

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function runCommandAsync(command) {
  return new Promise((resolve, reject) => {
    exec(command, { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }
      resolve({ stdout, stderr });
    });
  });
}

function fetchRoute(routePath) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}${routePath}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, contentType: res.headers['content-type'], body: data }));
    }).on('error', reject);
  });
}

async function run() {
  console.log('--- Starting verification server on port ' + PORT + ' ---');
  const server = app.listen(PORT);

  const tmpProfile = path.join(os.tmpdir(), 'chrome_bloomly_profile_' + Date.now());

  try {
    const routesToCheck = [
      '/',
      '/index.html',
      '/styleguide.html',
      '/auth.html',
      '/feed.html',
      '/explore.html',
      '/profile.html',
      '/post.html',
      '/css/tokens.css',
      '/css/base.css',
      '/css/components.css',
      '/css/pages.css',
      '/js/api.js',
      '/js/ui.js',
      '/js/stickers.js',
      '/js/animations.js',
      '/js/landing.js',
      '/favicon.svg',
      '/assets/stickers/logo.svg',
      '/assets/stickers/heart.svg',
      '/assets/stickers/flower.svg',
      '/assets/stickers/sprout.svg'
    ];

    console.log('\n--- Checking static asset delivery ---');
    for (const r of routesToCheck) {
      const res = await fetchRoute(r);
      if (res.status === 200) {
        console.log(`[OK 200] ${r}`);
      } else {
        throw new Error(`Failed route ${r}: status ${res.status}`);
      }
    }

    console.log('\n--- Capturing responsive screenshots with Headless Chrome (Async) ---');
    const viewports = [
      { name: 'desktop_1440', width: 1440, height: 900 },
      { name: 'tablet_768', width: 768, height: 1024 },
      { name: 'mobile_375', width: 375, height: 812 }
    ];

    const pagesToCapture = [
      { url: `http://localhost:${PORT}/index.html`, prefix: 'landing' },
      { url: `http://localhost:${PORT}/styleguide.html`, prefix: 'styleguide' }
    ];

    for (const page of pagesToCapture) {
      for (const vp of viewports) {
        const outName = `${page.prefix}_${vp.name}.png`;
        const outPath = path.join(SCREENSHOT_DIR, outName);
        const cmd = `"${CHROME_PATH}" --headless --no-sandbox --disable-gpu --user-data-dir="${tmpProfile}" --hide-scrollbars --window-size=${vp.width},${vp.height} --screenshot="${outPath}" "${page.url}"`;
        await runCommandAsync(cmd);
        const sz = fs.statSync(outPath).size;
        console.log(`[Captured] ${outName} (${vp.width}x${vp.height}) -> ${sz} bytes`);
      }
    }

    console.log('\n--- Testing rendered DOM on landing page ---');
    const landingDomCmd = `"${CHROME_PATH}" --headless --no-sandbox --disable-gpu --user-data-dir="${tmpProfile}" --dump-dom "http://localhost:${PORT}/index.html"`;
    const { stdout: domOutput } = await runCommandAsync(landingDomCmd);
    if (domOutput.includes('Where little moments') && domOutput.includes('hero-flower')) {
      console.log('[OK] Landing DOM rendered completely with hero flower and headings');
    } else {
      throw new Error('Landing DOM missing critical elements');
    }

    console.log('\n--- Testing rendered DOM on styleguide page ---');
    const sgDomCmd = `"${CHROME_PATH}" --headless --no-sandbox --disable-gpu --user-data-dir="${tmpProfile}" --dump-dom "http://localhost:${PORT}/styleguide.html"`;
    const { stdout: sgDomOutput } = await runCommandAsync(sgDomCmd);
    if (sgDomOutput.includes('Bloomly Styleguide') && sgDomOutput.includes('tokens.css')) {
      console.log('[OK] Styleguide DOM rendered completely with tokens and components');
    } else {
      throw new Error('Styleguide DOM missing critical elements');
    }

    console.log('\n=== ALL PHASE 3 CHECKS PASSED WITH ZERO FAILURES! ===');
  } finally {
    server.close();
    if (fs.existsSync(tmpProfile)) {
      try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch {}
    }
  }
}

run().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
