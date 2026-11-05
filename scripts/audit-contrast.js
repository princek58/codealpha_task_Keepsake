const fs = require('fs');
const path = require('path');

const tokensFile = path.resolve(__dirname, '../client/css/tokens.css');
const tokensContent = fs.readFileSync(tokensFile, 'utf8');

// Parse color variables from tokens.css
const tokenMap = {};
const varRegex = /(--color-[a-z0-9-]+)\s*:\s*([^;]+);/g;
let m;
while ((m = varRegex.exec(tokensContent)) !== null) {
  tokenMap[m[1]] = m[2].trim();
}

function hexToRgb(hex) {
  hex = hex.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16)
  ];
}

function getLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function computeContrast(hex1, hex2) {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Define the design system's real contrast pairs
const PAIRS_TO_AUDIT = [
  { name: 'Ink on Paper', text: '--color-ink', bg: '--color-paper', target: 4.5 },
  { name: 'Ink on White', text: '--color-ink', bg: '--color-white', target: 4.5 },
  { name: 'Ink on Sand', text: '--color-ink', bg: '--color-sand', target: 4.5 },
  { name: 'Stone on Paper', text: '--color-stone', bg: '--color-paper', target: 4.5 },
  { name: 'Stone on White', text: '--color-stone', bg: '--color-white', target: 4.5 },
  { name: 'White on Terracotta', text: '--color-white', bg: '--color-terracotta', target: 4.5 },
  { name: 'White on Teal', text: '--color-white', bg: '--color-teal', target: 4.5 },
  { name: 'Ink on Sage', text: '--color-ink', bg: '--color-sage', target: 4.5 },
  { name: 'Ink on Mustard', text: '--color-ink', bg: '--color-mustard', target: 4.5 },
  { name: 'White on Charcoal', text: '--color-white', bg: '--color-charcoal', target: 4.5 },
  { name: 'Brick on White', text: '--color-brick', bg: '--color-white', target: 4.5 },
  { name: 'Brick on Paper', text: '--color-brick', bg: '--color-paper', target: 4.5 },
  { name: 'Stone on Sand (Border/Subtle)', text: '--color-stone', bg: '--color-sand', target: 3.0 }
];

console.log('\n=== WCAG Contrast Audit ===\n');
let failed = 0;

for (const pair of PAIRS_TO_AUDIT) {
  const textColor = tokenMap[pair.text];
  const bgColor = tokenMap[pair.bg];

  if (!textColor || !bgColor) {
    console.error(`Missing token for pair ${pair.name}: text=${pair.text}, bg=${pair.bg}`);
    failed++;
    continue;
  }

  // Handle hex colors
  if (textColor.startsWith('#') && bgColor.startsWith('#')) {
    const ratio = computeContrast(textColor, bgColor);
    const pass = ratio >= pair.target;
    const mark = pass ? '✓ PASS' : '✗ FAIL';
    console.log(
      `${mark}  ${pair.name.padEnd(30)} Ratio: ${ratio.toFixed(2)}:1  (Min: ${pair.target}:1)  [${textColor} on ${bgColor}]`
    );
    if (!pass) failed++;
  }
}

console.log('\n===========================\n');

if (failed > 0) {
  console.error(`Contrast audit FAILED with ${failed} failing pair(s).`);
  process.exit(1);
} else {
  console.log('✓ All pairs meet or exceed WCAG AA contrast standards.');
  process.exit(0);
}

