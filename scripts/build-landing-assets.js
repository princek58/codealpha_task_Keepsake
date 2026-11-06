const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DEMO_MEDIA_DIR = path.join(__dirname, '../demo-media');
const ASSETS_DEMO_DIR = path.join(__dirname, '../client/assets/demo');

const ASSET_SPECS = [
  {
    id: 'hero',
    sourcePhoto: 'travel-01.jpg',
    baseName: 'hero',
    maxWidth: 1200,
    quality: 82,
    maxSizeBytes: 150 * 1024,
    title: 'Sunlight Over Mountain Valley',
    alt: 'Warm golden sunlight breaking across rugged mountain valley peaks',
    photographer: 'Eberhard Grossgasteiger',
    photographerUrl: 'https://www.pexels.com/@eberhardgross',
    pexelsUrl: 'https://www.pexels.com/photo/1287145/',
    license: 'Pexels License',
    type: 'image'
  },
  {
    id: 'showcase-travel',
    sourcePhoto: 'travel-02.jpg',
    baseName: 'showcase-travel',
    maxWidth: 800,
    quality: 80,
    maxSizeBytes: 90 * 1024,
    title: 'Golden Shoreline Waves',
    alt: 'Golden sunset waves washing over the warm ocean shoreline',
    photographer: 'Asad Photo Maldives',
    photographerUrl: 'https://www.pexels.com/@asadphotography',
    pexelsUrl: 'https://www.pexels.com/photo/1450360/',
    license: 'Pexels License',
    type: 'image'
  },
  {
    id: 'showcase-home',
    sourcePhoto: 'home-01.jpg',
    baseName: 'showcase-home',
    maxWidth: 800,
    quality: 80,
    maxSizeBytes: 90 * 1024,
    title: 'Morning Sun in Living Room',
    alt: 'Warm morning sun streaming through sheer linen curtains onto wooden floor',
    photographer: 'Rachel Claire',
    photographerUrl: 'https://www.pexels.com/@rachel-claire',
    pexelsUrl: 'https://www.pexels.com/photo/4846461/',
    license: 'Pexels License',
    type: 'image'
  },
  {
    id: 'showcase-friends',
    sourcePhoto: 'friends-01.jpg',
    baseName: 'showcase-friends',
    maxWidth: 800,
    quality: 80,
    maxSizeBytes: 90 * 1024,
    title: 'Campfire Under the Stars',
    alt: 'Friends laughing together around a warm summer campfire',
    photographer: 'Taryn Elliott',
    photographerUrl: 'https://www.pexels.com/@taryn-elliott',
    pexelsUrl: 'https://www.pexels.com/photo/4397840/',
    license: 'Pexels License',
    type: 'image'
  },
  {
    id: 'showcase-pets',
    sourcePhoto: 'pets-01.jpg',
    baseName: 'showcase-pets',
    maxWidth: 800,
    quality: 80,
    maxSizeBytes: 90 * 1024,
    title: 'Golden Retriever Afternoon',
    alt: 'Golden retriever resting chin peacefully on wooden porch floor',
    photographer: 'Blue Bird',
    photographerUrl: 'https://www.pexels.com/@blue-bird',
    pexelsUrl: 'https://www.pexels.com/photo/7210748/',
    license: 'Pexels License',
    type: 'image'
  },
  {
    id: 'showcase-food',
    sourcePhoto: 'food-01.jpg',
    baseName: 'showcase-food',
    maxWidth: 800,
    quality: 80,
    maxSizeBytes: 90 * 1024,
    title: 'Artisanal Sourdough Bread',
    alt: 'Fresh artisanal sourdough bread and butter on rustic wooden board',
    photographer: 'Rachel Claire',
    photographerUrl: 'https://www.pexels.com/@rachel-claire',
    pexelsUrl: 'https://www.pexels.com/photo/4993081/',
    license: 'Pexels License',
    type: 'image'
  },
  {
    id: 'showcase-nature',
    sourcePhoto: 'nature-01.jpg',
    baseName: 'showcase-nature',
    maxWidth: 800,
    quality: 80,
    maxSizeBytes: 90 * 1024,
    title: 'Fog Rolling Over Jagged Peaks',
    alt: 'Dramatic fog rolling peacefully over jagged mountain peaks',
    photographer: 'Eberhard Grossgasteiger',
    photographerUrl: 'https://www.pexels.com/@eberhardgross',
    pexelsUrl: 'https://www.pexels.com/photo/1287142/',
    license: 'Pexels License',
    type: 'image'
  },
  {
    id: 'showcase-hobbies',
    sourcePhoto: 'hobbies-01.jpg',
    baseName: 'showcase-hobbies',
    maxWidth: 800,
    quality: 80,
    maxSizeBytes: 90 * 1024,
    title: 'Shaping Clay on Wheel',
    alt: 'Hands shaping moist earthen clay on an old potter wheel',
    photographer: 'Roman Odintsov',
    photographerUrl: 'https://www.pexels.com/@roman-odintsov',
    pexelsUrl: 'https://www.pexels.com/photo/4982737/',
    license: 'Pexels License',
    type: 'image'
  },
  {
    id: 'demo-moment-1',
    sourcePhoto: 'travel-04.jpg',
    baseName: 'demo-moment-1',
    maxWidth: 800,
    quality: 80,
    maxSizeBytes: 90 * 1024,
    title: 'Quiet Old Town Alley',
    alt: 'Quiet cobblestone alleyway in the historic old quarter',
    photographer: 'Daria Shevtsova',
    photographerUrl: 'https://www.pexels.com/@daria',
    pexelsUrl: 'https://www.pexels.com/photo/2440021/',
    license: 'Pexels License',
    type: 'image'
  },
  {
    id: 'demo-moment-2',
    sourcePhoto: 'home-03.jpg',
    baseName: 'demo-moment-2',
    maxWidth: 800,
    quality: 80,
    maxSizeBytes: 90 * 1024,
    title: 'Cozy Reading Corner',
    alt: 'Cozy reading corner with vintage armchair and warm throw blanket',
    photographer: 'Rachel Claire',
    photographerUrl: 'https://www.pexels.com/@rachel-claire',
    pexelsUrl: 'https://www.pexels.com/photo/4846455/',
    license: 'Pexels License',
    type: 'image'
  },
  {
    id: 'demo-moment-3',
    sourcePhoto: 'nature-05.jpg',
    baseName: 'demo-moment-3',
    maxWidth: 800,
    quality: 80,
    maxSizeBytes: 90 * 1024,
    title: 'Sunbeams in the Woods',
    alt: 'Sunbeams filtering through mossy green forest canopy',
    photographer: 'Valiphotos',
    photographerUrl: 'https://www.pexels.com/@valiphotos',
    pexelsUrl: 'https://www.pexels.com/photo/589840/',
    license: 'Pexels License',
    type: 'image'
  },
  {
    id: 'demo-moment-4',
    sourcePhoto: 'food-03.jpg',
    baseName: 'demo-moment-4',
    maxWidth: 800,
    quality: 80,
    maxSizeBytes: 90 * 1024,
    title: 'Morning Pour-Over Coffee',
    alt: 'Steaming morning pour-over coffee with ceramic mug on table',
    photographer: 'Daria Shevtsova',
    photographerUrl: 'https://www.pexels.com/@daria',
    pexelsUrl: 'https://www.pexels.com/photo/1566837/',
    license: 'Pexels License',
    type: 'image'
  },
  {
    id: 'demo-moment-5',
    sourcePhoto: 'pets-03.jpg',
    baseName: 'demo-moment-5',
    maxWidth: 800,
    quality: 80,
    maxSizeBytes: 90 * 1024,
    title: 'Cat Sleeping in Sunspot',
    alt: 'Cat sleeping curled up peacefully in a warm sunspot on the rug',
    photographer: 'Sam Lion',
    photographerUrl: 'https://www.pexels.com/@sam-lion',
    pexelsUrl: 'https://www.pexels.com/photo/5731874/',
    license: 'Pexels License',
    type: 'image'
  },
  {
    id: 'demo-moment-6',
    sourcePhoto: 'hobbies-03.jpg',
    baseName: 'demo-moment-6',
    maxWidth: 800,
    quality: 80,
    maxSizeBytes: 90 * 1024,
    title: 'Ceramic Mugs on Shelf',
    alt: 'Handcrafted ceramic mugs drying on studio wooden shelves',
    photographer: 'Anastasia Shuraeva',
    photographerUrl: 'https://www.pexels.com/@anastasia-shuraeva',
    pexelsUrl: 'https://www.pexels.com/photo/3965545/',
    license: 'Pexels License',
    type: 'image'
  },
  {
    id: 'avatar-1',
    sourcePhoto: 'nature-06.jpg',
    baseName: 'avatar-1',
    maxWidth: 256,
    quality: 80,
    maxSizeBytes: 40 * 1024,
    title: 'Pine Cones Botanical',
    alt: 'Rustic pine cones botanical detail',
    photographer: 'Eberhard Grossgasteiger',
    photographerUrl: 'https://www.pexels.com/@eberhardgross',
    pexelsUrl: 'https://www.pexels.com/photo/1366919/',
    license: 'Pexels License',
    type: 'image'
  },
  {
    id: 'avatar-2',
    sourcePhoto: 'hobbies-04.jpg',
    baseName: 'avatar-2',
    maxWidth: 256,
    quality: 80,
    maxSizeBytes: 40 * 1024,
    title: 'Ceramic Glaze Texture',
    alt: 'Softly textured ceramic bowl detail',
    photographer: 'Roman Odintsov',
    photographerUrl: 'https://www.pexels.com/@roman-odintsov',
    pexelsUrl: 'https://www.pexels.com/photo/4982738/',
    license: 'Pexels License',
    type: 'image'
  }
];

async function encodeUnderLimit(srcBuf, targetWidth, format, initialQuality, maxSizeBytes) {
  let quality = initialQuality;
  let buf;
  while (quality >= 30) {
    let pipeline = sharp(srcBuf).resize({ width: targetWidth, withoutEnlargement: true });
    if (format === 'webp') {
      pipeline = pipeline.webp({ quality });
    } else {
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
    }
    buf = await pipeline.toBuffer();
    if (buf.length <= maxSizeBytes || quality <= 35) {
      break;
    }
    quality -= 5;
  }
  return buf;
}

async function buildLandingAssets() {
  if (!fs.existsSync(ASSETS_DEMO_DIR)) {
    fs.mkdirSync(ASSETS_DEMO_DIR, { recursive: true });
  }

  // Clean existing demo assets in client/assets/demo
  const existingFiles = fs.readdirSync(ASSETS_DEMO_DIR);
  for (const file of existingFiles) {
    fs.unlinkSync(path.join(ASSETS_DEMO_DIR, file));
  }

  const metadataList = [];

  for (const spec of ASSET_SPECS) {
    const srcPath = path.join(DEMO_MEDIA_DIR, 'photos', spec.sourcePhoto);
    if (!fs.existsSync(srcPath)) {
      throw new Error(`Source photo not found: ${srcPath}`);
    }

    const srcBuf = fs.readFileSync(srcPath);
    const meta = await sharp(srcBuf).metadata();
    const targetWidth = Math.min(meta.width || spec.maxWidth, spec.maxWidth);

    // Encode WebP under size limit
    const webpBuf = await encodeUnderLimit(srcBuf, targetWidth, 'webp', spec.quality, spec.maxSizeBytes);
    const webpPath = path.join(ASSETS_DEMO_DIR, `${spec.baseName}.webp`);
    fs.writeFileSync(webpPath, webpBuf);

    // Encode JPEG under size limit
    const jpgBuf = await encodeUnderLimit(srcBuf, targetWidth, 'jpeg', spec.quality, spec.maxSizeBytes);
    const jpgPath = path.join(ASSETS_DEMO_DIR, `${spec.baseName}.jpg`);
    fs.writeFileSync(jpgPath, jpgBuf);

    // Generate Tiny Blur Data URL (16px)
    const blurBuf = await sharp(srcBuf)
      .resize(16, Math.max(1, Math.round(16 * ((meta.height || 1000) / (meta.width || 1000)))), { fit: 'fill' })
      .webp({ quality: 20 })
      .toBuffer();
    const blurDataUrl = `data:image/webp;base64,${blurBuf.toString('base64')}`;

    const outMeta = await sharp(webpBuf).metadata();

    metadataList.push({
      id: spec.id,
      title: spec.title,
      alt: spec.alt,
      width: outMeta.width,
      height: outMeta.height,
      type: 'image',
      status: 'ready',
      urls: {
        display: `/assets/demo/${spec.baseName}.webp`,
        thumb: `/assets/demo/${spec.baseName}.webp`
      },
      blurDataUrl,
      photographer: spec.photographer,
      photographerUrl: spec.photographerUrl,
      pexelsUrl: spec.pexelsUrl,
      license: spec.license
    });
  }

  // Copy video (<3 MB)
  const videoSrc = path.join(DEMO_MEDIA_DIR, 'videos', 'video-ocean-waves.mp4');
  const videoDest = path.join(ASSETS_DEMO_DIR, 'showcase-video.mp4');
  if (fs.existsSync(videoSrc)) {
    fs.copyFileSync(videoSrc, videoDest);
  }

  // Generate video poster frame
  const posterPhotoSrc = path.join(DEMO_MEDIA_DIR, 'photos', 'travel-02.jpg');
  const posterDest = path.join(ASSETS_DEMO_DIR, 'showcase-video-poster.jpg');
  if (fs.existsSync(posterPhotoSrc)) {
    const posterBuf = await sharp(fs.readFileSync(posterPhotoSrc))
      .resize({ width: 640, height: 360, fit: 'cover' })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    fs.writeFileSync(posterDest, posterBuf);
  }

  // Add video entry to metadata
  metadataList.push({
    id: 'showcase-video',
    title: 'Golden Ocean Waves',
    alt: 'Gentle golden hour waves washing over smooth sandy beach',
    width: 640,
    height: 360,
    type: 'video',
    status: 'ready',
    urls: {
      display: '/assets/demo/showcase-video.mp4',
      thumb: '/assets/demo/showcase-video-poster.jpg',
      poster: '/assets/demo/showcase-video-poster.jpg'
    },
    photographer: 'Tom Fisk',
    photographerUrl: 'https://www.pexels.com/@tomfisk',
    pexelsUrl: 'https://www.pexels.com/video/854697/',
    license: 'Pexels License'
  });

  // Save metadata.json
  const metadataPath = path.join(ASSETS_DEMO_DIR, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadataList, null, 2), 'utf8');

  // Verify total directory size
  let totalBytes = 0;
  const files = fs.readdirSync(ASSETS_DEMO_DIR);
  for (const f of files) {
    totalBytes += fs.statSync(path.join(ASSETS_DEMO_DIR, f)).size;
  }
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
  console.log(`Landing assets built successfully: ${files.length} files, ${totalMB} MB total.`);
}

if (require.main === module) {
  buildLandingAssets().catch((err) => {
    console.error('Failed to build landing assets:', err);
    process.exit(1);
  });
}

module.exports = { buildLandingAssets };
