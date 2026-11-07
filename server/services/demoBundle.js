const fs = require('fs');
const path = require('path');
const config = require('../config');
const User = require('../models/User');
const Media = require('../models/Media');
const Moment = require('../models/Moment');
const Album = require('../models/Album');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');

const DEMO_BUNDLE_DIR = path.resolve(__dirname, '../../demo-bundle');
const BUNDLE_JSON_PATH = path.join(DEMO_BUNDLE_DIR, 'bundle.json');
const BUNDLE_MEDIA_DIR = path.join(DEMO_BUNDLE_DIR, 'media');

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
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

async function restoreDemoBundle({ force = false } = {}) {
  if (config.isProduction && !config.demoMode && !force) {
    throw new Error('Refusing to restore demo bundle in production: DEMO_MODE must be true');
  }

  if (!config.demoMode && !force) {
    return { restored: false, reason: 'demo_mode_disabled' };
  }

  if (!fs.existsSync(BUNDLE_JSON_PATH)) {
    console.warn(`[DemoBundle] bundle.json not found at ${BUNDLE_JSON_PATH}. Run "npm run build-demo-bundle" first.`);
    return { restored: false, reason: 'bundle_file_missing' };
  }

  const bundleRaw = fs.readFileSync(BUNDLE_JSON_PATH, 'utf8');
  const bundle = JSON.parse(bundleRaw);

  const now = new Date();
  const currentMonth = now.getUTCMonth();
  const currentDay = now.getUTCDate();

  // 1. Copy media files to STORAGE_DIR
  if (fs.existsSync(BUNDLE_MEDIA_DIR)) {
    copyDirRecursive(BUNDLE_MEDIA_DIR, config.storageDir);
  }

  // 2. Upsert Users
  if (Array.isArray(bundle.users)) {
    for (const u of bundle.users) {
      await User.updateOne({ _id: u._id }, { $set: u }, { upsert: true });
    }
  }

  // 3. Upsert Media
  if (Array.isArray(bundle.media)) {
    for (const m of bundle.media) {
      let takenAt = m.takenAt ? new Date(m.takenAt) : now;
      if (m.dateRule && m.dateRule.type === 'on-this-day') {
        const targetYear = now.getUTCFullYear() - (m.dateRule.yearsAgo || 1);
        takenAt = new Date(Date.UTC(targetYear, currentMonth, currentDay, 10, 0, 0));
      }
      const mediaData = { ...m, takenAt };
      delete mediaData.dateRule;

      await Media.updateOne({ _id: m._id }, { $set: mediaData }, { upsert: true });
    }
  }

  // 4. Upsert Moments
  if (Array.isArray(bundle.moments)) {
    for (const mom of bundle.moments) {
      let takenOn = mom.takenOn ? new Date(mom.takenOn) : now;
      if (mom.dateRule && mom.dateRule.type === 'on-this-day') {
        const targetYear = now.getUTCFullYear() - (mom.dateRule.yearsAgo || 1);
        takenOn = new Date(Date.UTC(targetYear, currentMonth, currentDay, 12, 0, 0));
      }
      const momentData = { ...mom, takenOn };
      delete momentData.dateRule;

      await Moment.updateOne({ _id: mom._id }, { $set: momentData }, { upsert: true });
    }
  }

  // 5. Upsert Albums
  if (Array.isArray(bundle.albums)) {
    for (const a of bundle.albums) {
      await Album.updateOne({ _id: a._id }, { $set: a }, { upsert: true });
    }
  }

  // 6. Upsert Comments
  if (Array.isArray(bundle.comments)) {
    for (const c of bundle.comments) {
      await Comment.updateOne({ _id: c._id }, { $set: c }, { upsert: true });
    }
  }

  // 7. Upsert Notifications
  if (Array.isArray(bundle.notifications)) {
    for (const n of bundle.notifications) {
      await Notification.updateOne({ _id: n._id }, { $set: n }, { upsert: true });
    }
  }

  // 8. Update storage used for demo users
  if (Array.isArray(bundle.users)) {
    for (const u of bundle.users) {
      const userMedia = await Media.find({ owner: u._id });
      const totalBytes = userMedia.reduce((sum, item) => sum + (item.sizeBytes || 0), 0);
      await User.findByIdAndUpdate(u._id, { storageUsedBytes: totalBytes });
    }
  }

  console.log(`[DemoBundle] Demo data restored successfully (${bundle.users?.length || 0} users, ${bundle.moments?.length || 0} moments, ${bundle.albums?.length || 0} albums).`);
  return {
    restored: true,
    users: bundle.users?.length || 0,
    moments: bundle.moments?.length || 0,
    albums: bundle.albums?.length || 0
  };
}

module.exports = {
  restoreDemoBundle,
  DEMO_BUNDLE_DIR,
  BUNDLE_JSON_PATH,
  BUNDLE_MEDIA_DIR
};
