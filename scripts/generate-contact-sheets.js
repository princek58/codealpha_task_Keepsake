// Keepsake Photo Editor Contact Sheet Generator
// Builds thumbnail contact sheets with ID overlays for each theme
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DEMO_MEDIA_DIR = path.resolve(__dirname, '../demo-media');
const MANIFEST_PATH = path.join(DEMO_MEDIA_DIR, 'manifest.json');
const OUT_DIR = path.resolve(__dirname, '../docs/contact-sheets');

async function buildContactSheets() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const photos = manifest.filter(m => m.type === 'image');

  const themes = ['travel', 'home', 'friends', 'pets', 'food', 'nature', 'hobbies'];

  for (const theme of themes) {
    const items = photos.filter(p => p.theme === theme);
    console.log(`Generating contact sheet for theme: ${theme} (${items.length} photos)...`);

    // Grid: 5 columns x 2 rows, each cell 300x220
    const cellW = 320;
    const cellH = 240;
    const cols = 5;
    const rows = 2;
    const sheetW = cols * cellW;
    const sheetH = rows * cellH;

    const composites = [];

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const left = col * cellW;
      const top = row * cellH;

      const photoPath = path.join(DEMO_MEDIA_DIR, 'photos', item.filename);

      // Resize photo to fit inside cell with label space
      const thumbBuf = await sharp(photoPath)
        .resize(cellW - 16, cellH - 40, { fit: 'cover' })
        .toBuffer();

      composites.push({
        input: thumbBuf,
        left: left + 8,
        top: top + 8
      });

      // Label overlay
      const labelSvg = `
        <svg width="${cellW - 16}" height="24">
          <rect width="100%" height="100%" fill="#1F2A37" rx="3"/>
          <text x="8" y="16" font-family="monospace" font-size="11" font-weight="bold" fill="#F7F3EC">
            ${item.id} - ${item.creatorName.slice(0, 22)}
          </text>
        </svg>
      `;
      composites.push({
        input: Buffer.from(labelSvg),
        left: left + 8,
        top: top + cellH - 28
      });
    }

    // Base background
    const sheetBuf = await sharp({
      create: {
        width: sheetW,
        height: sheetH,
        channels: 4,
        background: { r: 247, g: 243, b: 236, alpha: 1 } // --color-paper
      }
    })
      .composite(composites)
      .jpeg({ quality: 90 })
      .toBuffer();

    const outPath = path.join(OUT_DIR, `contact-sheet-${theme}.jpg`);
    fs.writeFileSync(outPath, sheetBuf);
    console.log(`  ✓ Saved: ${outPath}`);
  }

  console.log('\nContact sheets successfully generated for editorial review.');
}

buildContactSheets().catch(err => {
  console.error('Error generating contact sheets:', err);
  process.exit(1);
});

