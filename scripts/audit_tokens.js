const fs = require('fs');
const path = require('path');

const cssDir = path.join(__dirname, '..', 'client', 'css');
const files = fs.readdirSync(cssDir).filter(f => f.endsWith('.css') && f !== 'tokens.css');
let hasHex = false;

for (const f of files) {
  const content = fs.readFileSync(path.join(cssDir, f), 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const stripped = line.replace(/\/\*.*?\*\//g, '');
    const matches = stripped.match(/#[0-9a-fA-F]{3,8}\b/g);
    if (matches) {
      console.error(`Hex found in client/css/${f}:${idx + 1} -> ${line.trim()}`);
      hasHex = true;
    }
  });
}

if (hasHex) {
  console.error('FAILED: Found hard-coded hex colors in client/css outside tokens.css');
  process.exit(1);
} else {
  console.log('SUCCESS: Token audit clean. No hard-coded hex colors found outside tokens.css.');
  process.exit(0);
}
