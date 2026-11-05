// Keepsake Seed Script — Demo Data Generator
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const config = require('../server/config');
const storage = require('../server/services/storage');
const User = require('../server/models/User');
const Media = require('../server/models/Media');
const Moment = require('../server/models/Moment');
const Album = require('../server/models/Album');
const Comment = require('../server/models/Comment');
const Notification = require('../server/models/Notification');

// Guard against production
if (config.env === 'production' && !process.argv.includes('--force')) {
  console.error('ERROR: Cannot run seed script in production without --force flag.');
  process.exit(1);
}

const DEMO_PASSWORD = 'Password123';
const DEMO_USERS = [
  { username: 'willow', displayName: 'Willow Vance', bio: 'Film photography, quiet mornings, ceramic cups and seaside air.', color: '#2F7F79' },
  { username: 'jasper', displayName: 'Jasper Reid', bio: 'Documenting rainy afternoons, vintage books, and wooden cabins.', color: '#B4532A' },
  { username: 'elena', displayName: 'Elena Rostova', bio: 'Architectural shadows, tea ceremonies, and film rolls from Kyoto.', color: '#A9B99B' },
  { username: 'kai', displayName: 'Kai Takahashi', bio: 'Analog snapshots, train journeys across Hokkaido, and espresso.', color: '#4C6A92' },
  { username: 'maya', displayName: 'Maya Lindqvist', bio: 'Nordic landscapes, sourdough baking, and soft wool blankets.', color: '#E0A53B' },
  { username: 'sorin', displayName: 'Sorin Balea', bio: 'Carpentry, pine forests in Transylvania, and slow woodworking.', color: '#5F6B7A' },
  { username: 'nora', displayName: 'Nora Chen', bio: 'Botanical gardens, watercolor sketches, and Sunday markets.', color: '#2F7F79' },
  { username: 'clara', displayName: 'Clara Dubois', bio: 'Boulangeries, morning walks by the Seine, and linen journals.', color: '#B4532A' }
];

const PALETTE = [
  { bg: '#F7F3EC', fg: '#B4532A', name: 'Terracotta Paper' },
  { bg: '#FAF8F5', fg: '#2F7F79', name: 'Teal Mist' },
  { bg: '#EDE4D3', fg: '#5F6B7A', name: 'Sand Stone' },
  { bg: '#F2EDE4', fg: '#A9B99B', name: 'Sage Linen' },
  { bg: '#F5EFEB', fg: '#E0A53B', name: 'Mustard Grain' },
  { bg: '#EAE6DF', fg: '#4C6A92', name: 'Slate Harbor' }
];

const PLACES = [
  'Kyoto, Japan',
  'Big Sur, California',
  'Edinburgh Old Town, Scotland',
  'Cornwall Coast, England',
  'Lake Bled, Slovenia',
  'Stockholm Archipelago, Sweden',
  'Bergen, Norway',
  'Giverny, France',
  'Cinque Terre, Italy',
  'Kamakura, Japan'
];

const CAPTIONS = [
  'Morning light finding its way across the wooden table.',
  'A slow walk through the old pine grove after the rain.',
  'Steaming tea on a crisp November morning.',
  'The silent beauty of ancient stone alleys at dawn.',
  'Collecting smooth driftwood along the shoreline.',
  'Finding quiet moments between long train rides.',
  'Warm shadows stretching across the linen curtains.',
  'Rain tapping gently against the greenhouse glass.',
  'A quiet corner of the bookstore with coffee.',
  'Sunlight filtering through the autumn foliage.'
];

const TAG_POOL = ['film', 'morning', 'autumn', 'coffee', 'fog', 'sea', 'books', 'travel', 'calm', 'nature'];

// Generate an avatar SVG and convert to WebP
async function generateAvatarBuffer(name, color) {
  const initial = (name || 'K').charAt(0).toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <rect width="256" height="256" fill="${color}"/>
      <circle cx="128" cy="128" r="96" fill="#FFFFFF" fill-opacity="0.2"/>
      <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, serif" font-size="104" font-weight="600" fill="#FFFFFF">
        ${initial}
      </text>
    </svg>
  `;
  return sharp(Buffer.from(svg)).webp({ quality: 90 }).toBuffer();
}

// Generate aesthetic photo WebP
async function generatePhotoBuffer(width, height, colorPair, title, subtitle) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <radialGradient id="grad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stop-color="${colorPair.bg}" stop-opacity="0.95"/>
          <stop offset="100%" stop-color="${colorPair.fg}" stop-opacity="0.25"/>
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="${colorPair.bg}"/>
      <rect width="${width}" height="${height}" fill="url(#grad)"/>
      <circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) * 0.28}" fill="${colorPair.fg}" fill-opacity="0.15"/>
      <circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) * 0.16}" fill="${colorPair.fg}" fill-opacity="0.3"/>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, serif" font-size="${Math.max(18, Math.round(width * 0.04))}" font-weight="600" fill="#1F2A37">
        ${title}
      </text>
      <text x="50%" y="58%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="${Math.max(12, Math.round(width * 0.024))}" fill="#5F6B7A">
        ${subtitle}
      </text>
    </svg>
  `;

  return sharp(Buffer.from(svg)).webp({ quality: 85 }).toBuffer();
}

async function findSampleVideoBuffer() {
  const storageDir = path.resolve(config.storageDir);
  try {
    const files = fs.readdirSync(storageDir, { recursive: true });
    for (const f of files) {
      if (typeof f === 'string' && f.endsWith('.mp4')) {
        const full = path.join(storageDir, f);
        if (fs.existsSync(full)) {
          return fs.readFileSync(full);
        }
      }
    }
  } catch {
    // fallback if no storage mp4
  }
  return null;
}

async function runSeed() {
  console.log('Connecting to database:', config.mongodbUri);
  await mongoose.connect(config.mongodbUri);

  console.log('Clearing previous demo seed data...');
  const existingUsers = await User.find({ username: { $in: DEMO_USERS.map((u) => u.username) } });
  const userIds = existingUsers.map((u) => u._id);

  if (userIds.length > 0) {
    await Media.deleteMany({ owner: { $in: userIds } });
    await Moment.deleteMany({ author: { $in: userIds } });
    await Album.deleteMany({ owner: { $in: userIds } });
    await Comment.deleteMany({ author: { $in: userIds } });
    await Notification.deleteMany({ $or: [{ to: { $in: userIds } }, { from: { $in: userIds } }] });
    await User.deleteMany({ _id: { $in: userIds } });

    // Clean user storage dirs
    for (const id of userIds) {
      try {
        await storage.remove(id.toString());
      } catch {}
    }
  }

  console.log('Creating demo users...');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const createdUsers = [];

  for (const u of DEMO_USERS) {
    const userDoc = new User({
      username: u.username,
      displayName: u.displayName,
      email: `${u.username}@example.com`,
      passwordHash,
      bio: u.bio,
      storageQuotaBytes: config.userQuotaBytes,
      storageUsedBytes: 0,
      following: [],
      followers: []
    });

    // Generate avatar
    const avatarBuf = await generateAvatarBuffer(u.displayName, u.color);
    const avatarRelPath = `avatars/${userDoc._id}_${Date.now()}.webp`;
    await storage.writeBuffer(avatarRelPath, avatarBuf);
    userDoc.avatarPath = avatarRelPath;

    await userDoc.save();
    createdUsers.push(userDoc);
  }

  // Follow network
  console.log('Building social graph...');
  for (let i = 0; i < createdUsers.length; i++) {
    const user = createdUsers[i];
    // Follow next 3 users
    for (let j = 1; j <= 3; j++) {
      const target = createdUsers[(i + j) % createdUsers.length];
      user.following.push(target._id);
      target.followers.push(user._id);
    }
    await user.save();
  }

  // Generate Media library items for each user
  console.log('Generating photos and media library for each user...');
  const sampleVideoBuf = await findSampleVideoBuffer();
  const allMediaByUser = new Map();

  const aspectRatios = [
    { w: 800, h: 800, name: '1:1' },
    { w: 800, h: 600, name: '4:3' },
    { w: 960, h: 540, name: '16:9' },
    { w: 600, h: 800, name: '3:4' }
  ];

  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());

  // Pre-generate base image buffers for each aspect ratio & palette combination
  const imageBufferCache = new Map();
  for (let a = 0; a < aspectRatios.length; a++) {
    const ar = aspectRatios[a];
    for (let p = 0; p < PALETTE.length; p++) {
      const colorPair = PALETTE[p];
      const key = `${ar.name}_${p}`;
      const disp = await generatePhotoBuffer(ar.w, ar.h, colorPair, colorPair.name, 'Keepsake Memory');
      const thm = await sharp(disp).resize(400, 400, { fit: 'inside' }).webp({ quality: 75 }).toBuffer();
      imageBufferCache.set(key, { disp, thm });
    }
  }

  for (let uIdx = 0; uIdx < createdUsers.length; uIdx++) {
    const user = createdUsers[uIdx];
    const userMediaList = [];
    const mediaCount = 18; // 18 photos per user

    for (let mIdx = 0; mIdx < mediaCount; mIdx++) {
      const mediaId = new mongoose.Types.ObjectId();
      const ar = aspectRatios[mIdx % aspectRatios.length];
      const pIdx = (uIdx + mIdx) % PALETTE.length;
      const place = PLACES[(uIdx * 2 + mIdx) % PLACES.length];
      const caption = CAPTIONS[(uIdx + mIdx) % CAPTIONS.length];

      // Taken date: mix of today, on-this-day, and past months
      let takenAt;
      if (mIdx === 0) {
        takenAt = oneYearAgo; // Exactly 1 year ago for On This Day
      } else if (mIdx === 1) {
        takenAt = twoYearsAgo; // Exactly 2 years ago for On This Day
      } else if (mIdx < 4) {
        takenAt = new Date(now.getTime() - mIdx * 86400000 * 2); // recent days
      } else {
        takenAt = new Date(now.getTime() - mIdx * 86400000 * 18); // past months
      }

      const cached = imageBufferCache.get(`${ar.name}_${pIdx}`);
      const displayBuf = cached.disp;
      const thumbBuf = cached.thm;

      const origRel = `${user._id}/${mediaId}/original.webp`;
      const dispRel = `${user._id}/${mediaId}/display.webp`;
      const thmRel = `${user._id}/${mediaId}/thumb.webp`;

      await storage.writeBuffer(origRel, displayBuf);
      await storage.writeBuffer(dispRel, displayBuf);
      await storage.writeBuffer(thmRel, thumbBuf);

      const sizeBytes = displayBuf.length * 2 + thumbBuf.length;

      const mediaDoc = await Media.create({
        _id: mediaId,
        owner: user._id,
        type: 'image',
        status: 'ready',
        originalName: `photo_${mIdx + 1}.webp`,
        mime: 'image/webp',
        sizeBytes,
        width: ar.w,
        height: ar.h,
        takenAt,
        caption,
        place,
        blurDataUrl: 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAACwAQCdASoUABQAPpE+mkkkIqIhAAA/sWYA',
        paths: {
          original: origRel,
          display: dispRel,
          thumb: thmRel,
          video: null,
          poster: null
        }
      });

      userMediaList.push(mediaDoc);
      await User.findByIdAndUpdate(user._id, { $inc: { storageUsedBytes: sizeBytes } });
    }

    // Add 1 sample video for the first 3 users
    if (uIdx < 3 && sampleVideoBuf) {
      const vMediaId = new mongoose.Types.ObjectId();
      const vOrig = `${user._id}/${vMediaId}/original.mp4`;
      const vVideo = `${user._id}/${vMediaId}/video.mp4`;
      const vPoster = `${user._id}/${vMediaId}/poster.webp`;
      const vThumb = `${user._id}/${vMediaId}/thumb.webp`;

      const posterBuf = await generatePhotoBuffer(800, 450, PALETTE[uIdx], 'Coastal Waves', 'Video Clip');
      const thumbBuf = await sharp(posterBuf).resize(400, 225).webp().toBuffer();

      await storage.writeBuffer(vOrig, sampleVideoBuf);
      await storage.writeBuffer(vVideo, sampleVideoBuf);
      await storage.writeBuffer(vPoster, posterBuf);
      await storage.writeBuffer(vThumb, thumbBuf);

      const vSizeBytes = sampleVideoBuf.length * 2 + posterBuf.length;

      const vidDoc = await Media.create({
        _id: vMediaId,
        owner: user._id,
        type: 'video',
        status: 'ready',
        originalName: 'clip.mp4',
        mime: 'video/mp4',
        sizeBytes: vSizeBytes,
        width: 800,
        height: 450,
        durationSec: 5,
        takenAt: new Date(now.getTime() - 86400000 * 5),
        caption: 'Gentle waves rolling in at dusk.',
        place: 'Cornwall Coast, England',
        paths: {
          original: vOrig,
          display: null,
          thumb: vThumb,
          video: vVideo,
          poster: vPoster
        }
      });

      userMediaList.push(vidDoc);
      await User.findByIdAndUpdate(user._id, { $inc: { storageUsedBytes: vSizeBytes } });
    }

    allMediaByUser.set(user.username, userMediaList);
  }

  // Create Moments (~25 moments)
  console.log('Creating moments with collage, grid, and carousel layouts...');
  const createdMoments = [];

  const momentConfigs = [
    { title: 'Golden Hour by the Canal', layout: { type: 'collage', template: 'collage-1-2', gap: 8 }, count: 3, place: 'Kyoto, Japan', vis: 'public', tags: ['autumn', 'film', 'travel'] },
    { title: 'A Day at the Coast', layout: { type: 'collage', template: 'collage-2-1', gap: 8 }, count: 3, place: 'Cornwall Coast, England', vis: 'public', tags: ['sea', 'calm'] },
    { title: 'Fog Rolling Through the Pines', layout: { type: 'grid', gap: 12 }, count: 4, place: 'Big Sur, California', vis: 'public', tags: ['fog', 'nature'] },
    { title: 'Ceramic Studio & Tea', layout: { type: 'carousel', gap: 8 }, count: 5, place: 'Edinburgh Old Town, Scotland', vis: 'followers', tags: ['coffee', 'morning'] },
    { title: 'Reflections on Lake Bled', layout: { type: 'collage', template: 'collage-2x2', gap: 8 }, count: 4, place: 'Lake Bled, Slovenia', vis: 'public', tags: ['travel', 'nature'] },
    { title: 'Morning Light in the Kitchen', layout: { type: 'grid', gap: 8 }, count: 2, place: 'Bergen, Norway', vis: 'public', tags: ['morning', 'calm'] },
    { title: 'Autumn Leafpress Notebook', layout: { type: 'collage', template: 'collage-mosaic', gap: 8 }, count: 4, place: 'Stockholm, Sweden', vis: 'public', tags: ['autumn', 'books'] },
    { title: 'Quiet Stroll through Kamakura', layout: { type: 'grid', gap: 12 }, count: 3, place: 'Kamakura, Japan', vis: 'public', tags: ['travel', 'calm'] }
  ];

  for (let i = 0; i < createdUsers.length; i++) {
    const user = createdUsers[i];
    const uMedia = allMediaByUser.get(user.username) || [];

    for (let cIdx = 0; cIdx < 3; cIdx++) {
      const cfg = momentConfigs[(i * 3 + cIdx) % momentConfigs.length];
      const sliceStart = (cIdx * 4) % Math.max(1, uMedia.length - cfg.count);
      const chosenMedia = uMedia.slice(sliceStart, sliceStart + cfg.count);
      if (chosenMedia.length === 0) continue;

      // Make first moment for willow exactly 1 year ago so it shows in On This Day!
      let takenOn = chosenMedia[0].takenAt || new Date();
      if (user.username === 'willow' && cIdx === 0) {
        takenOn = oneYearAgo;
      }

      const moment = await Moment.create({
        owner: user._id,
        media: chosenMedia.map((m) => m._id),
        title: `${cfg.title} ${i > 3 ? 'II' : ''}`.trim(),
        caption: `Preserving a serene moment from our journey. ${CAPTIONS[(i + cIdx) % CAPTIONS.length]}`,
        layout: {
          type: cfg.layout.type,
          template: cfg.layout.template || cfg.layout.type,
          gap: cfg.layout.gap || 8,
          background: '#EDE4D3'
        },
        takenOn,
        place: cfg.place,
        tags: cfg.tags,
        visibility: cfg.vis,
        likes: [],
        likesCount: 0,
        commentsCount: 0
      });

      createdMoments.push(moment);
    }
  }

  // Social: Likes, Comments, Notifications
  console.log('Seeding likes, comments, and notifications...');
  for (let mIdx = 0; mIdx < createdMoments.length; mIdx++) {
    const m = createdMoments[mIdx];
    // Add 2-4 likes
    const numLikes = (mIdx % 4) + 1;
    for (let l = 0; l < numLikes; l++) {
      const liker = createdUsers[(mIdx + l + 1) % createdUsers.length];
      if (!m.likes.includes(liker._id)) {
        m.likes.push(liker._id);
      }
    }
    m.likesCount = m.likes.length;

    // Add 1-2 comments
    const commenter1 = createdUsers[(mIdx + 2) % createdUsers.length];
    const c1 = await Comment.create({
      moment: m._id,
      author: commenter1._id,
      text: 'Such a peaceful atmosphere, love the color tones here.'
    });

    m.commentsCount = 1;

    if (mIdx % 2 === 0) {
      const commenter2 = createdUsers[(mIdx + 3) % createdUsers.length];
      await Comment.create({
        moment: m._id,
        author: commenter2._id,
        text: 'This brings back wonderful memories of traveling there.'
      });
      m.commentsCount = 2;
    }

    await m.save();

    // Create notifications for the moment author
    if (m.likes.length > 0) {
      const liker = createdUsers.find((u) => u._id.equals(m.likes[0]));
      if (liker && !liker._id.equals(m.owner)) {
        await Notification.create({
          to: m.owner,
          from: liker._id,
          type: 'like',
          moment: m._id
        });
      }
    }
  }

  // Create Albums (~10 albums)
  console.log('Creating curated albums with share tokens...');
  const albumNames = [
    { title: 'Kyoto Memories', desc: 'Ancient shrines, moss gardens, and cedar wood.', vis: 'public' },
    { title: 'Northern Coastlines', desc: 'Granite cliffs and salt breeze across the north.', vis: 'public' },
    { title: 'Ceramics & Still Life', desc: 'Clay, glazes, and morning kettle steam.', vis: 'followers' },
    { title: 'Autumn in the Highlands', desc: 'Golden heather, misty glens, and warm fires.', vis: 'public' },
    { title: 'Quiet Architecture', desc: 'Geometric arches, light corridors, and shadows.', vis: 'private' },
    { title: 'Coffee & Notebooks', desc: 'Sketches, notes, and fountain pens from cafes.', vis: 'followers' },
    { title: 'Forest Wanderings', desc: 'Ferns, morning moss, and tall pines.', vis: 'public' },
    { title: 'Subtle Details', desc: 'Small moments that made the journey memorable.', vis: 'public' },
    { title: 'Scandinavian Winter', desc: 'Snow on timber houses and frozen lakes.', vis: 'public' },
    { title: 'Sunday Baking', desc: 'Flour on the counter and sourdough loaves.', vis: 'private' }
  ];

  for (let aIdx = 0; aIdx < albumNames.length; aIdx++) {
    const user = createdUsers[aIdx % createdUsers.length];
    const uMedia = allMediaByUser.get(user.username) || [];
    const mediaSlice = uMedia.slice(0, 6);

    const aData = albumNames[aIdx];
    const shareToken = aIdx === 0 || aIdx === 1 ? crypto.randomBytes(12).toString('hex') : null;

    await Album.create({
      owner: user._id,
      title: aData.title,
      description: aData.desc,
      visibility: aData.vis,
      media: mediaSlice.map((m) => m._id),
      cover: mediaSlice[0]?._id || null,
      shareToken
    });
  }

  console.log('\n======================================================');
  console.log('✓ SEEDING COMPLETED SUCCESSFULLY!');
  console.log('======================================================');
  console.log(`Created ${createdUsers.length} users, ${createdMoments.length} moments, and 10 albums.`);
  console.log('\nDemo User Accounts (Password: Password123 for all):');
  createdUsers.forEach((u) => {
    console.log(`  - @${u.username.padEnd(12)} (${u.displayName})`);
  });
  console.log('\nActive Public Shared Album URL:');
  const sharedAlbum = await Album.findOne({ shareToken: { $ne: null } });
  if (sharedAlbum) {
    console.log(`  http://localhost:5000/shared.html?token=${sharedAlbum.shareToken}`);
  }
  console.log('======================================================\n');

  await mongoose.disconnect();
}

runSeed().catch((err) => {
  console.error('Seed script error:', err);
  process.exit(1);
});
