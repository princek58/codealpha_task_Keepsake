const fs = require('fs');
const path = require('path');

const clientDir = path.resolve(__dirname, '../client');

const IGNORED_FILES = [
  path.normalize(path.join(clientDir, 'css/tokens.css'))
];

const EXTENSIONS = ['.css', '.js', '.html'];

// Regular expressions to detect hard-coded colors
// Matches #hex, rgb(..), rgba(..), hsl(..), hsla(..)
const COLOR_REGEX = /(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\))/g;

// Safe patterns allowed in code (e.g. data URL headers, canvas contexts, regex)
const ALLOWED_PATTERNS = [
  /url\(['"]?data:image/i,
  /\/\*.*?\*\//,
  /base64/,
  /svg/i,
  /<meta name="theme-color"/i
];

function scanDirectory(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip assets/ (SVGs are handled separately)
      if (entry.name === 'assets') continue;
      scanDirectory(fullPath, fileList);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (EXTENSIONS.includes(ext) && !IGNORED_FILES.includes(path.normalize(fullPath))) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

const files = scanDirectory(clientDir);
let violations = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Skip empty lines or pure comments
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;

    let match;
    while ((match = COLOR_REGEX.exec(line)) !== null) {
      const matchedColor = match[1];

      // Exclude matches inside allowed patterns or inline base64
      let isAllowed = false;
      for (const pattern of ALLOWED_PATTERNS) {
        if (pattern.test(line)) {
          isAllowed = true;
          break;
        }
      }

      if (!isAllowed) {
        violations.push({
          file: path.relative(path.resolve(__dirname, '..'), file),
          line: idx + 1,
          color: matchedColor,
          snippet: trimmed
        });
      }
    }
  });
}

if (violations.length > 0) {
  console.error('\n=== Token Audit FAILED ===');
  console.error(`Found ${violations.length} hard-coded color(s) outside tokens.css:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} -> ${v.color}`);
    console.error(`    "${v.snippet}"\n`);
  }
  process.exit(1);
} else {
  console.log('✓ Token audit PASSED: Zero hard-coded colors found outside tokens.css');
  process.exit(0);
}

