// Keepsake Demo Bundle Builder
// Runs the seed pipeline against an in-memory database with deterministic ObjectIds,
// then exports the processed media and document collections into demo-bundle/ for instant zero-lag boot restore.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const config = require('../server/config');
const storage = require('../server/services/storage');
const User = require('../server/models/User');
const Media = require('../server/models/Media');
const Moment = require('../server/models/Moment');
const Album = require('../server/models/Album');
const Comment = require('../server/models/Comment');
const Notification = require('../server/models/Notification');
const { runSeed } = require('./seed');

const BUNDLE_DIR = path.resolve(__dirname, '../demo-bundle');
const BUNDLE_JSON_PATH = path.join(BUNDLE_DIR, 'bundle.json');
const BUNDLE_MEDIA_DIR = path.join(BUNDLE_DIR, 'media');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function getDirectorySizeBytes(dirPath) {
  let total = 0;
  if (!fs.existsSync(dirPath)) return 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += getDirectorySizeBytes(fullPath);
    } else {
      total += fs.statSync(fullPath).size;
    }
  }
  return total;
}

async function buildDemoBundle() {
  console.log('\n======================================================');
  console.log('       KEEPSAKE DEMO BUNDLE BUILDER                   ');
  console.log('======================================================\n');

  // Ensure demo-bundle directory exists and is clean
  if (fs.existsSync(BUNDLE_DIR)) {
    fs.rmSync(BUNDLE_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(BUNDLE_MEDIA_DIR, { recursive: true });

  // 1. Launch in-memory MongoDB
  console.log('1. Starting isolated in-memory MongoDB instance...');
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  // Point storage temporarily to a bundle-build directory inside tmp
  const buildStorageDir = path.resolve(__dirname, '../tmp/bundle-storage');
  if (fs.existsSync(buildStorageDir)) {
    fs.rmSync(buildStorageDir, { recursive: true, force: true });
  }
  fs.mkdirSync(buildStorageDir, { recursive: true });

  const originalStorageDir = config.storageDir;
  config.storageDir = buildStorageDir;

  await mongoose.connect(uri);
  console.log('  ✓ Connected to in-memory MongoDB');

  // 2. Run full seed (not SEED_TEST_SMALL)
  console.log('2. Running comprehensive demo seed with all 70 photos and 6 videos...');
  delete process.env.SEED_TEST_SMALL;
  await runSeed({ keepConnection: true });

  // 3. Export documents to bundle.json with On-This-Day date rules
  console.log('3. Exporting collections and tagging dynamic date rules...');
  const users = await User.find({}).lean();
  const media = await Media.find({}).lean();
  const moments = await Moment.find({}).lean();
  const albums = await Album.find({}).lean();
  const comments = await Comment.find({}).lean();
  const notifications = await Notification.find({}).lean();

  const now = new Date();
  const currentMonth = now.getUTCMonth();
  const currentDay = now.getUTCDate();

  // Tag dynamic date rules on Clara (moment 0), Daisy (moment 4), Leo (moment 7)
  for (let mIdx = 0; mIdx < moments.length; mIdx++) {
    const mom = moments[mIdx];
    if (mIdx === 0) {
      mom.dateRule = { type: 'on-this-day', yearsAgo: 1 };
    } else if (mIdx === 4) {
      mom.dateRule = { type: 'on-this-day', yearsAgo: 2 };
    } else if (mIdx === 7) {
      mom.dateRule = { type: 'on-this-day', yearsAgo: 1 };
    }
  }

  // Tag dateRule on matching media items for those moments
  for (const mom of moments) {
    if (mom.dateRule) {
      for (const medId of mom.media) {
        const targetMedia = media.find((m) => m._id.toString() === medId.toString());
        if (targetMedia) {
          targetMedia.dateRule = mom.dateRule;
        }
      }
    }
  }

  const bundleData = {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    users,
    media,
    moments,
    albums,
    comments,
    notifications
  };

  fs.writeFileSync(BUNDLE_JSON_PATH, JSON.stringify(bundleData, null, 2), 'utf8');
  console.log(`  ✓ bundle.json written (${(fs.statSync(BUNDLE_JSON_PATH).size / 1024).toFixed(1)} KB)`);

  // 4. Copy processed storage files into demo-bundle/media
  console.log('4. Copying processed media assets and avatars into demo-bundle/media...');
  let copiedFiles = 0;
  function copyFileRel(rel) {
    if (!rel) return;
    const src = path.join(storage.baseDir, rel);
    const dest = path.join(BUNDLE_MEDIA_DIR, rel);
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    copiedFiles++;
  }

  for (const u of users) {
    if (u.avatarPath) copyFileRel(u.avatarPath);
  }
  for (const m of media) {
    if (m.paths) {
      copyFileRel(m.paths.original);
      copyFileRel(m.paths.display);
      copyFileRel(m.paths.thumb);
      copyFileRel(m.paths.video);
      copyFileRel(m.paths.poster);
    }
  }
  console.log(`  ✓ Copied ${copiedFiles} media files to demo-bundle/media`);

  await mongoose.disconnect();
  await mongoServer.stop();

  const totalBundleBytes = getDirectorySizeBytes(BUNDLE_DIR);
  const totalBundleMb = (totalBundleBytes / (1024 * 1024)).toFixed(2);

  console.log('\n======================================================');
  console.log(`✓ DEMO BUNDLE CREATED SUCCESSFULLY!`);
  console.log(`  Location: demo-bundle/`);
  console.log(`  Total Bundle Size: ${totalBundleMb} MB (Cap: 45 MB)`);
  console.log(`  Users: ${users.length}, Media: ${media.length}, Moments: ${moments.length}, Albums: ${albums.length}`);
  console.log('======================================================\n');

  if (totalBundleBytes > 45 * 1024 * 1024) {
    console.error(`ERROR: Demo bundle size ${totalBundleMb} MB exceeds 45 MB cap!`);
    process.exit(1);
  }
}

if (require.main === module) {
  buildDemoBundle().catch((err) => {
    console.error('Failed to build demo bundle:', err);
    process.exit(1);
  });
}

module.exports = { buildDemoBundle };
