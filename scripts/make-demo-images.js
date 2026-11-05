const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const demoDir = path.resolve(__dirname, '../client/assets/demo');
fs.mkdirSync(demoDir, { recursive: true });

// Palette colors for SVGs
const PALETTE = {
  paper: '#F7F3EC',
  sand: '#EDE4D3',
  ink: '#1F2A37',
  stone: '#5F6B7A',
  terracotta: '#B4532A',
  teal: '#2F7F79',
  sage: '#A9B99B',
  mustard: '#E0A53B',
  slate: '#4C6A92',
  brick: '#B3261E'
};

const demos = [
  {
    name: 'demo-1',
    w: 1200,
    h: 800,
    title: 'Autumn Mist',
    svg: `
      <svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#EDE4D3"/>
            <stop offset="60%" stop-color="#A9B99B"/>
            <stop offset="100%" stop-color="#2F7F79"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="800" fill="url(#g1)"/>
        <circle cx="950" cy="220" r="140" fill="#E0A53B" opacity="0.85"/>
        <path d="M0 500 Q 350 420, 700 520 T 1200 480 L 1200 800 L 0 800 Z" fill="#2F7F79" opacity="0.9"/>
        <path d="M0 620 Q 400 560, 800 640 T 1200 590 L 1200 800 L 0 800 Z" fill="#1F2A37" opacity="0.95"/>
      </svg>`
  },
  {
    name: 'demo-2',
    w: 800,
    h: 1200,
    title: 'Terracotta Dunes',
    svg: `
      <svg width="800" height="1200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#F7F3EC"/>
            <stop offset="50%" stop-color="#EDE4D3"/>
            <stop offset="100%" stop-color="#B4532A"/>
          </linearGradient>
        </defs>
        <rect width="800" height="1200" fill="url(#g2)"/>
        <circle cx="400" cy="350" r="180" fill="#B4532A" opacity="0.7"/>
        <path d="M0 700 C 250 600, 550 800, 800 680 L 800 1200 L 0 1200 Z" fill="#843818"/>
        <path d="M0 880 C 300 780, 500 950, 800 850 L 800 1200 L 0 1200 Z" fill="#1F2A37"/>
      </svg>`
  },
  {
    name: 'demo-3',
    w: 1000,
    h: 1000,
    title: 'Quiet Lake',
    svg: `
      <svg width="1000" height="1000" xmlns="http://www.w3.org/2000/svg">
        <rect width="1000" height="1000" fill="#4C6A92"/>
        <circle cx="500" cy="400" r="220" fill="#EDE4D3" opacity="0.8"/>
        <polygon points="150,750 450,420 750,750" fill="#2F7F79" opacity="0.85"/>
        <polygon points="400,750 650,480 900,750" fill="#1F2A37" opacity="0.9"/>
        <rect y="720" width="1000" height="280" fill="#14171C"/>
      </svg>`
  },
  {
    name: 'demo-4',
    w: 1200,
    h: 675,
    title: 'Morning Sage',
    svg: `
      <svg width="1200" height="675" xmlns="http://www.w3.org/2000/svg">
        <rect width="1200" height="675" fill="#A9B99B"/>
        <ellipse cx="600" cy="337" rx="420" ry="240" fill="#EDE4D3" opacity="0.6"/>
        <circle cx="350" cy="280" r="120" fill="#2F7F79" opacity="0.8"/>
        <circle cx="850" cy="380" r="160" fill="#E0A53B" opacity="0.75"/>
      </svg>`
  },
  {
    name: 'demo-5',
    w: 900,
    h: 1200,
    title: 'Golden Hour',
    svg: `
      <svg width="900" height="1200" xmlns="http://www.w3.org/2000/svg">
        <rect width="900" height="1200" fill="#EDE4D3"/>
        <circle cx="450" cy="400" r="260" fill="#E0A53B"/>
        <path d="M0 650 Q 450 500, 900 650 L 900 1200 L 0 1200 Z" fill="#B4532A"/>
        <circle cx="450" cy="720" r="140" fill="#1F2A37"/>
      </svg>`
  },
  {
    name: 'demo-6',
    w: 1200,
    h: 900,
    title: 'Pine Forest',
    svg: `
      <svg width="1200" height="900" xmlns="http://www.w3.org/2000/svg">
        <rect width="1200" height="900" fill="#2F7F79"/>
        <circle cx="600" cy="350" r="200" fill="#EDE4D3" opacity="0.7"/>
        <polygon points="200,850 400,350 600,850" fill="#1F2A37"/>
        <polygon points="450,850 650,420 850,850" fill="#A9B99B" opacity="0.9"/>
        <polygon points="700,850 900,320 1100,850" fill="#14171C"/>
      </svg>`
  },
  {
    name: 'demo-7',
    w: 1000,
    h: 1000,
    title: 'Sand & Clay',
    svg: `
      <svg width="1000" height="1000" xmlns="http://www.w3.org/2000/svg">
        <rect width="1000" height="1000" fill="#F7F3EC"/>
        <rect x="200" y="200" width="600" height="600" rx="40" fill="#B4532A"/>
        <circle cx="500" cy="500" r="220" fill="#EDE4D3"/>
        <circle cx="500" cy="500" r="120" fill="#2F7F79"/>
      </svg>`
  },
  {
    name: 'demo-8',
    w: 1200,
    h: 800,
    title: 'Slate Coast',
    svg: `
      <svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
        <rect width="1200" height="800" fill="#4C6A92"/>
        <ellipse cx="600" cy="650" rx="700" ry="300" fill="#EDE4D3"/>
        <circle cx="300" cy="300" r="140" fill="#E0A53B" opacity="0.85"/>
        <path d="M700 300 L 900 650 L 500 650 Z" fill="#1F2A37"/>
      </svg>`
  },
  {
    name: 'demo-9',
    w: 800,
    h: 1200,
    title: 'Mustard Sun',
    svg: `
      <svg width="800" height="1200" xmlns="http://www.w3.org/2000/svg">
        <rect width="800" height="1200" fill="#E0A53B"/>
        <rect x="150" y="250" width="500" height="700" rx="30" fill="#1F2A37"/>
        <circle cx="400" cy="600" r="180" fill="#EDE4D3"/>
        <circle cx="400" cy="600" r="90" fill="#B4532A"/>
      </svg>`
  },
  {
    name: 'demo-10',
    w: 1200,
    h: 800,
    title: 'Botanical Harmony',
    svg: `
      <svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
        <rect width="1200" height="800" fill="#A9B99B"/>
        <path d="M200 400 C 400 200, 800 600, 1000 400" stroke="#1F2A37" stroke-width="40" fill="none" stroke-linecap="round"/>
        <circle cx="600" cy="400" r="120" fill="#B4532A"/>
        <circle cx="350" cy="300" r="60" fill="#E0A53B"/>
        <circle cx="850" cy="500" r="70" fill="#2F7F79"/>
      </svg>`
  },
  {
    name: 'demo-11',
    w: 1000,
    h: 1000,
    title: 'Stone Garden',
    svg: `
      <svg width="1000" height="1000" xmlns="http://www.w3.org/2000/svg">
        <rect width="1000" height="1000" fill="#5F6B7A"/>
        <circle cx="500" cy="500" r="300" fill="#EDE4D3"/>
        <circle cx="500" cy="500" r="200" fill="#F7F3EC"/>
        <ellipse cx="500" cy="500" rx="120" ry="80" fill="#1F2A37"/>
      </svg>`
  },
  {
    name: 'demo-12',
    w: 1200,
    h: 675,
    title: 'Horizon Glow',
    svg: `
      <svg width="1200" height="675" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="hglow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#E0A53B"/>
            <stop offset="50%" stop-color="#B4532A"/>
            <stop offset="100%" stop-color="#14171C"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="675" fill="url(#hglow)"/>
        <line x1="0" y1="420" x2="1200" y2="420" stroke="#EDE4D3" stroke-width="3"/>
        <circle cx="600" cy="420" r="90" fill="#FFFFFF" opacity="0.9"/>
      </svg>`
  }
];

async function generate() {
  const metadataList = [];

  for (const item of demos) {
    const svgBuf = Buffer.from(item.svg.trim());
    const webpPath = path.join(demoDir, `${item.name}.webp`);
    const jpgPath = path.join(demoDir, `${item.name}.jpg`);

    // Render WebP
    await sharp(svgBuf)
      .resize(item.w, item.h)
      .webp({ quality: 85 })
      .toFile(webpPath);

    // Render JPG
    await sharp(svgBuf)
      .resize(item.w, item.h)
      .jpeg({ quality: 85 })
      .toFile(jpgPath);

    // Generate tiny blur placeholder
    const blurData = await sharp(svgBuf)
      .resize(24, Math.round(24 * (item.h / item.w)))
      .webp({ quality: 20 })
      .toBuffer();
    const blurDataUrl = `data:image/webp;base64,${blurData.toString('base64')}`;

    metadataList.push({
      id: item.name,
      title: item.title,
      width: item.w,
      height: item.h,
      type: 'image',
      status: 'ready',
      urls: {
        display: `/assets/demo/${item.name}.webp`,
        thumb: `/assets/demo/${item.name}.webp`
      },
      blurDataUrl
    });

    console.log(`✓ Generated ${item.name} (${item.w}x${item.h})`);
  }

  // Save metadata JSON
  fs.writeFileSync(
    path.join(demoDir, 'metadata.json'),
    JSON.stringify(metadataList, null, 2)
  );
  console.log(`\n✓ All ${demos.length} demo images successfully generated!`);
}

generate().catch(console.error);

