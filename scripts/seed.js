// Keepsake Seed Script — Demo Data Generator
// Seeds 8 rich personas with authentic Pexels stock photos and videos across 7 themes,
// populates realistic moments (collage, grid, carousel), albums with secret share link,
// 'On This Day' date-matched milestones, and full social graph interactions.

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

const DEMO_MEDIA_DIR = path.resolve(__dirname, '../demo-media');
const MANIFEST_PATH = path.join(DEMO_MEDIA_DIR, 'manifest.json');
const PHOTOS_DIR = path.join(DEMO_MEDIA_DIR, 'photos');
const VIDEOS_DIR = path.join(DEMO_MEDIA_DIR, 'videos');

// 8 Demo User Personas aligned with themes
const DEMO_PERSONAS = [
  {
    username: 'clara',
    displayName: 'Clara Dubois',
    bio: 'Alpine trails, morning mist over mountain valleys, and slow coastal train rides.',
    avatarPhoto: 'travel-01.jpg', // Mountain valley
    theme: 'travel'
  },
  {
    username: 'daisy',
    displayName: 'Daisy Miller',
    bio: 'Earthen cups of ginger chai, sourdough crusts, and warm rain against window panes.',
    avatarPhoto: 'home-02.jpg', // Steaming chai cups
    theme: 'home'
  },
  {
    username: 'leo',
    displayName: 'Leo Sterling',
    bio: 'Campfire embers under the stars, weekend road trips, and sunset bicycle rides.',
    avatarPhoto: 'friends-01.jpg', // Campfire night
    theme: 'friends'
  },
  {
    username: 'maya',
    displayName: 'Maya Lindqvist',
    bio: 'Life with golden retrievers and sunny windowsill cats. Keeping quiet paw prints.',
    avatarPhoto: 'pets-01.jpg', // Golden retriever in grass
    theme: 'pets'
  },
  {
    username: 'jasper',
    displayName: 'Jasper Reid',
    bio: 'Crispy street samosas, fresh morning spice markets, and hot tawa rotis.',
    avatarPhoto: 'food-01.jpg', // Samosas & chutney
    theme: 'food'
  },
  {
    username: 'elena',
    displayName: 'Elena Rostova',
    bio: 'Lotus raindrops during the monsoon, autumn forest paths, and starry skies.',
    avatarPhoto: 'nature-02.jpg', // Monsoon lotus rain
    theme: 'nature'
  },
  {
    username: 'kai',
    displayName: 'Kai Takahashi',
    bio: 'Analog mechanical cameras, terracotta pottery clay, and leather-bound notebooks.',
    avatarPhoto: 'hobbies-03.jpg', // Hands shaping clay
    theme: 'hobbies'
  },
  {
    username: 'nora',
    displayName: 'Nora Chen',
    bio: 'Watercolor studies, wildflower pressings, and finding calm in old bookshops.',
    avatarPhoto: 'hobbies-04.jpg', // Open book with tea
    theme: 'hobbies'
  }
];

// Helper to create small blurDataUrl from sharp buffer
async function createBlurDataUrl(buffer) {
  try {
    const small = await sharp(buffer)
      .resize(16, 16, { fit: 'inside' })
      .webp({ quality: 20 })
      .toBuffer();
    return `data:image/webp;base64,${small.toString('base64')}`;
  } catch {
    return 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAACwAQCdASoUABQAPpE+mkkkIqIhAAA/sWYA';
  }
}

// Fallback abstract SVG avatar generator if demo-media is missing
async function generateFallbackAvatar(name) {
  const initial = (name || 'K').charAt(0).toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <rect width="256" height="256" fill="#B4532A"/>
      <circle cx="128" cy="128" r="96" fill="#FFFFFF" fill-opacity="0.2"/>
      <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, serif" font-size="104" font-weight="600" fill="#FFFFFF">
        ${initial}
      </text>
    </svg>
  `;
  return sharp(Buffer.from(svg)).webp({ quality: 90 }).toBuffer();
}

async function runSeed(options = {}) {
  if (mongoose.connection.readyState !== 1) {
    const mongoUri = options.mongodbUri || config.mongodbUri;
    console.log('Connecting to database:', mongoUri);
    await mongoose.connect(mongoUri);
  }

  const hasDemoMedia = fs.existsSync(MANIFEST_PATH) && fs.existsSync(PHOTOS_DIR);
  if (!hasDemoMedia) {
    console.warn('\n[WARN] demo-media directory not found! Falling back to procedural fixtures.\n');
  }

  let demoManifest = [];
  if (hasDemoMedia) {
    try {
      demoManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    } catch {
      demoManifest = [];
    }
  }

  console.log('Clearing previous demo seed data...');
  const existingUsers = await User.find({ username: { $in: DEMO_PERSONAS.map((u) => u.username) } });
  const userIds = existingUsers.map((u) => u._id);

  if (userIds.length > 0) {
    await Media.deleteMany({ owner: { $in: userIds } });
    await Moment.deleteMany({ owner: { $in: userIds } });
    await Album.deleteMany({ owner: { $in: userIds } });
    await Comment.deleteMany({ author: { $in: userIds } });
    await Notification.deleteMany({ $or: [{ to: { $in: userIds } }, { from: { $in: userIds } }] });
    await User.deleteMany({ _id: { $in: userIds } });

    // Clean user storage physical dirs
    for (const id of userIds) {
      try {
        await storage.remove(id.toString());
      } catch {}
    }
  }

  console.log('Creating 8 demo users with non-person real avatars...');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const createdUsers = [];

  for (const persona of DEMO_PERSONAS) {
    const userDoc = new User({
      username: persona.username,
      displayName: persona.displayName,
      email: `${persona.username}@example.com`,
      passwordHash,
      bio: persona.bio,
      storageQuotaBytes: config.userQuotaBytes,
      storageUsedBytes: 0,
      following: [],
      followers: []
    });

    // Create square crop avatar from real stock photo
    let avatarBuf;
    const avatarPhotoPath = path.join(PHOTOS_DIR, persona.avatarPhoto);
    if (hasDemoMedia && fs.existsSync(avatarPhotoPath)) {
      avatarBuf = await sharp(avatarPhotoPath)
        .resize(256, 256, { fit: 'cover', position: 'center' })
        .webp({ quality: 90 })
        .toBuffer();
    } else {
      avatarBuf = await generateFallbackAvatar(persona.displayName);
    }

    const avatarRelPath = `avatars/${userDoc._id}_${Date.now()}.webp`;
    await storage.writeBuffer(avatarRelPath, avatarBuf);
    userDoc.avatarPath = avatarRelPath;

    await userDoc.save();
    createdUsers.push(userDoc);
  }

  // Build social graph (follow connections)
  console.log('Building social graph...');
  for (let i = 0; i < createdUsers.length; i++) {
    const user = createdUsers[i];
    // Each user follows 3 to 4 peers
    for (let j = 1; j <= 3; j++) {
      const target = createdUsers[(i + j) % createdUsers.length];
      if (!user.following.includes(target._id)) {
        user.following.push(target._id);
        target.followers.push(user._id);
      }
    }
    await user.save();
  }

  // Distribute demo media items to users
  console.log('Distributing photos and videos to users and processing variants...');
  const allMediaByUser = new Map();
  const allCreatedMedia = [];

  const now = new Date();
  const oneYearAgoToday = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 10, 30);
  const twoYearsAgoToday = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate(), 15, 0);

  const photosInManifest = demoManifest.filter((m) => m.type === 'image');
  const videosInManifest = demoManifest.filter((m) => m.type === 'video');

  for (let uIdx = 0; uIdx < createdUsers.length; uIdx++) {
    const user = createdUsers[uIdx];
    const persona = DEMO_PERSONAS[uIdx];
    const userMediaList = [];

    // Assign ~9 photos per user (matching their primary theme plus related themes)
    const primaryPhotos = photosInManifest.filter((p) => p.theme === persona.theme);
    const otherPhotos = photosInManifest.filter((p) => p.theme !== persona.theme);
    const assignedPhotos = [
      ...primaryPhotos.slice(0, 7),
      ...otherPhotos.slice(uIdx * 2, uIdx * 2 + 2)
    ];

    for (let pIdx = 0; pIdx < assignedPhotos.length; pIdx++) {
      const pItem = assignedPhotos[pIdx];
      const mediaId = new mongoose.Types.ObjectId();
      const photoSrcPath = path.join(PHOTOS_DIR, pItem.filename);

      if (!fs.existsSync(photoSrcPath)) continue;

      // 1. Process variants using Sharp
      const origBuf = fs.readFileSync(photoSrcPath);
      const displayBuf = await sharp(origBuf)
        .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      const thumbBuf = await sharp(origBuf)
        .resize(400, 400, { fit: 'cover' })
        .webp({ quality: 80 })
        .toBuffer();
      const blurDataUrl = await createBlurDataUrl(thumbBuf);

      const origRel = `${user._id}/${mediaId}/original.jpg`;
      const dispRel = `${user._id}/${mediaId}/display.webp`;
      const thmRel = `${user._id}/${mediaId}/thumb.webp`;

      await storage.writeBuffer(origRel, origBuf);
      await storage.writeBuffer(dispRel, displayBuf);
      await storage.writeBuffer(thmRel, thumbBuf);

      const sizeBytes = origBuf.length + displayBuf.length + thumbBuf.length;

      // Ensure 'On This Day' matches for Clara, Daisy, and Leo
      let takenAt;
      if (uIdx === 0 && pIdx === 0) {
        takenAt = oneYearAgoToday;
      } else if (uIdx === 1 && pIdx === 0) {
        takenAt = twoYearsAgoToday;
      } else if (uIdx === 2 && pIdx === 0) {
        takenAt = oneYearAgoToday;
      } else {
        const daysAgo = (uIdx * 15 + pIdx * 12) % 600;
        takenAt = new Date(now.getTime() - daysAgo * 86400000);
      }

      const mediaDoc = await Media.create({
        _id: mediaId,
        owner: user._id,
        type: 'image',
        status: 'ready',
        originalName: pItem.filename,
        mime: 'image/jpeg',
        sizeBytes,
        width: pItem.width,
        height: pItem.height,
        takenAt,
        caption: pItem.caption,
        place: pItem.albumGroup,
        blurDataUrl,
        paths: {
          original: origRel,
          display: dispRel,
          thumb: thmRel,
          video: null,
          poster: null
        }
      });

      userMediaList.push(mediaDoc);
      allCreatedMedia.push(mediaDoc);
      await User.findByIdAndUpdate(user._id, { $inc: { storageUsedBytes: sizeBytes } });
    }

    // Assign 1 real video to users 0 through 5
    if (uIdx < videosInManifest.length) {
      const vItem = videosInManifest[uIdx];
      const vSrcPath = path.join(VIDEOS_DIR, vItem.filename);

      if (fs.existsSync(vSrcPath)) {
        const vMediaId = new mongoose.Types.ObjectId();
        const vBuf = fs.readFileSync(vSrcPath);

        // Generate poster frame from video thumbnail
        const posterBuf = await sharp({
          create: {
            width: 640,
            height: 360,
            channels: 4,
            background: { r: 31, g: 42, b: 55, alpha: 1 }
          }
        }).jpeg().toBuffer();

        const thumbBuf = await sharp(posterBuf)
          .resize(400, 225, { fit: 'cover' })
          .webp({ quality: 80 })
          .toBuffer();
        const blurDataUrl = await createBlurDataUrl(thumbBuf);

        const vOrigRel = `${user._id}/${vMediaId}/original.mp4`;
        const vVidRel = `${user._id}/${vMediaId}/video.mp4`;
        const vPosterRel = `${user._id}/${vMediaId}/poster.jpg`;
        const vThmRel = `${user._id}/${vMediaId}/thumb.webp`;

        await storage.writeBuffer(vOrigRel, vBuf);
        await storage.writeBuffer(vVidRel, vBuf);
        await storage.writeBuffer(vPosterRel, posterBuf);
        await storage.writeBuffer(vThmRel, thumbBuf);

        const vSizeBytes = vBuf.length * 2 + posterBuf.length + thumbBuf.length;

        const vidDoc = await Media.create({
          _id: vMediaId,
          owner: user._id,
          type: 'video',
          status: 'ready',
          originalName: vItem.filename,
          mime: 'video/mp4',
          sizeBytes: vSizeBytes,
          width: 640,
          height: 360,
          durationSec: vItem.durationSec || 8,
          takenAt: new Date(now.getTime() - (uIdx + 1) * 7 * 86400000),
          caption: vItem.caption,
          place: vItem.albumGroup,
          blurDataUrl,
          paths: {
            original: vOrigRel,
            display: null,
            thumb: vThmRel,
            video: vVidRel,
            poster: vPosterRel
          }
        });

        userMediaList.push(vidDoc);
        allCreatedMedia.push(vidDoc);
        await User.findByIdAndUpdate(user._id, { $inc: { storageUsedBytes: vSizeBytes } });
      }
    }

    allMediaByUser.set(user.username, userMediaList);
  }

  // Create 28 Moments across Collage, Grid, and Carousel layouts
  console.log('Creating 28 moments with collage, grid, and carousel layouts...');
  const createdMoments = [];

  const MOMENT_SPECS = [
    // Clara (Travel)
    { userIdx: 0, title: 'Sunrise Over the Himalayan Valley', layout: { type: 'collage', template: 'collage-1-2' }, count: 3, place: 'Himalayas, India', vis: 'public', tags: ['travel', 'mountains', 'sunrise'] },
    { userIdx: 0, title: 'Winter Afternoon in Old Town', layout: { type: 'grid', gap: 8 }, count: 2, place: 'Edinburgh, Scotland', vis: 'public', tags: ['travel', 'walking'] },
    { userIdx: 0, title: 'Mountain Train Through Foggy Hills', layout: { type: 'carousel', gap: 8 }, count: 4, place: 'Himachal Pradesh, India', vis: 'followers', tags: ['train', 'fog'] },
    { userIdx: 0, title: 'Private Personal Reflections', layout: { type: 'grid', gap: 8 }, count: 2, place: 'Home Balcony', vis: 'private', tags: ['quiet'] },

    // Daisy (Home)
    { userIdx: 1, title: 'Diwali Lights & Evening Courtyard', layout: { type: 'collage', template: 'collage-2-1' }, count: 3, place: 'New Delhi, India', vis: 'public', tags: ['home', 'festival', 'lights'] },
    { userIdx: 1, title: 'Weekend Sourdough & Fresh Loaves', layout: { type: 'grid', gap: 8 }, count: 3, place: 'Home Kitchen', vis: 'public', tags: ['baking', 'bread'] },
    { userIdx: 1, title: 'Rainy Afternoon by the Window', layout: { type: 'carousel', gap: 8 }, count: 4, place: 'Living Room', vis: 'followers', tags: ['rain', 'calm'] },

    // Leo (Friends)
    { userIdx: 2, title: 'Campfire Songs Under the Pines', layout: { type: 'collage', template: 'collage-2x2' }, count: 4, place: 'Big Sur, California', vis: 'public', tags: ['friends', 'campfire', 'night'] },
    { userIdx: 2, title: 'Sunset Bicycle Ride Along the Ridge', layout: { type: 'grid', gap: 8 }, count: 3, place: 'Cornwall, England', vis: 'public', tags: ['bicycles', 'friends'] },
    { userIdx: 2, title: 'Weekend Road Trip Packed and Ready', layout: { type: 'carousel', gap: 8 }, count: 3, place: 'Highway Stop', vis: 'followers', tags: ['roadtrip'] },

    // Maya (Pets)
    { userIdx: 3, title: 'Sunny Backyard Afternoon with Golden', layout: { type: 'collage', template: 'collage-1-2' }, count: 3, place: 'Sunny Garden', vis: 'public', tags: ['pets', 'dogs', 'summer'] },
    { userIdx: 3, title: 'Sleepy Cat Sunbeam Chronicles', layout: { type: 'grid', gap: 8 }, count: 3, place: 'Living Room Rug', vis: 'public', tags: ['pets', 'cats'] },
    { userIdx: 3, title: 'Two Pups Playing on the Grass', layout: { type: 'carousel', gap: 8 }, count: 3, place: 'Park Meadow', vis: 'followers', tags: ['pets'] },

    // Jasper (Food)
    { userIdx: 4, title: 'Street Food Trail: Samosas and Chai', layout: { type: 'collage', template: 'collage-mosaic' }, count: 4, place: 'Old Delhi Market', vis: 'public', tags: ['streetfood', 'spices'] },
    { userIdx: 4, title: 'Morning Produce Market Discovery', layout: { type: 'grid', gap: 8 }, count: 3, place: 'Farmers Market', vis: 'public', tags: ['market', 'fresh'] },
    { userIdx: 4, title: 'Sunday Pancake Breakfast Stack', layout: { type: 'carousel', gap: 8 }, count: 3, place: 'Dining Corner', vis: 'followers', tags: ['food', 'breakfast'] },

    // Elena (Nature)
    { userIdx: 5, title: 'Monsoon Rain Drops on Lotus Pond', layout: { type: 'collage', template: 'collage-1-2' }, count: 3, place: 'Botanical Garden', vis: 'public', tags: ['nature', 'monsoon', 'rain'] },
    { userIdx: 5, title: 'Autumn Amber Foliage in the Woods', layout: { type: 'grid', gap: 8 }, count: 3, place: 'Forest Trail', vis: 'public', tags: ['autumn', 'leaves'] },
    { userIdx: 5, title: 'Milky Way Over the Ancient Pines', layout: { type: 'carousel', gap: 8 }, count: 3, place: 'High Pass', vis: 'public', tags: ['stars', 'night'] },

    // Kai (Hobbies)
    { userIdx: 6, title: 'Shaping Wet Terracotta on the Wheel', layout: { type: 'collage', template: 'collage-2-1' }, count: 3, place: 'Clay Studio', vis: 'public', tags: ['pottery', 'crafts'] },
    { userIdx: 6, title: 'Analog 35mm Mechanical Camera Days', layout: { type: 'grid', gap: 8 }, count: 3, place: 'Work Desk', vis: 'public', tags: ['film', 'photography'] },
    { userIdx: 6, title: 'Vintage Vinyl Spinning on Turntable', layout: { type: 'carousel', gap: 8 }, count: 3, place: 'Living Room', vis: 'followers', tags: ['music', 'records'] },
    { userIdx: 6, title: 'Private Journal Entries and Sketches', layout: { type: 'grid', gap: 8 }, count: 2, place: 'Personal Desk', vis: 'private', tags: ['journal'] },

    // Nora (Hobbies & Books)
    { userIdx: 7, title: 'Wildflower Pressing and Old Books', layout: { type: 'collage', template: 'collage-2x2' }, count: 4, place: 'Library Corner', vis: 'public', tags: ['books', 'botanical'] },
    { userIdx: 7, title: 'Watercolor Pigments and Studies', layout: { type: 'grid', gap: 8 }, count: 3, place: 'Studio Easel', vis: 'public', tags: ['painting', 'art'] },
    { userIdx: 7, title: 'Herb Seedlings and Garden Trowel', layout: { type: 'carousel', gap: 8 }, count: 3, place: 'Balcony Garden', vis: 'followers', tags: ['gardening'] },
    { userIdx: 0, title: 'Coastal Waves Rolling at Dusk', layout: { type: 'grid', gap: 8 }, count: 3, place: 'Goa Coast, India', vis: 'public', tags: ['sea', 'sunset'] },
    { userIdx: 1, title: 'Steaming Chai by the Old Fireplace', layout: { type: 'grid', gap: 8 }, count: 2, place: 'Cottage Hearth', vis: 'public', tags: ['chai', 'winter'] }
  ];

  for (let mIdx = 0; mIdx < MOMENT_SPECS.length; mIdx++) {
    const spec = MOMENT_SPECS[mIdx];
    const user = createdUsers[spec.userIdx];
    const uMedia = allMediaByUser.get(user.username) || [];

    const sliceStart = (mIdx * 2) % Math.max(1, uMedia.length - spec.count);
    const chosenMedia = uMedia.slice(sliceStart, sliceStart + spec.count);
    if (chosenMedia.length === 0) continue;

    // Moments for Clara, Daisy, and Leo fall on today's month and day for On This Day
    let takenOn = chosenMedia[0].takenAt;
    if (mIdx === 0) takenOn = oneYearAgoToday;
    if (mIdx === 4) takenOn = twoYearsAgoToday;
    if (mIdx === 7) takenOn = oneYearAgoToday;

    const moment = await Moment.create({
      owner: user._id,
      media: chosenMedia.map((m) => m._id),
      title: spec.title,
      caption: `Preserving a serene memory: ${spec.title}. Moments like this remind us to slow down and cherish the light.`,
      layout: {
        type: spec.layout.type,
        template: spec.layout.template || spec.layout.type,
        gap: spec.layout.gap || 8,
        background: '#EDE4D3'
      },
      takenOn,
      place: spec.place,
      tags: spec.tags,
      visibility: spec.vis,
      likes: [],
      likesCount: 0,
      commentsCount: 0
    });

    createdMoments.push(moment);
  }

  // Social Engagement: Likes, Friendly Comments, Notifications
  console.log('Seeding social likes, comments, and notifications...');
  const FRIENDLY_COMMENTS = [
    'The golden light in this is simply stunning.',
    'Such a calm, gentle atmosphere. Love this so much!',
    'This brings back wonderful memories of traveling there.',
    'What a beautiful perspective. The colors are so cozy.',
    'Pure peace. Thank you for sharing this memory.'
  ];

  for (let mIdx = 0; mIdx < createdMoments.length; mIdx++) {
    const m = createdMoments[mIdx];

    // 2-3 Likes
    const numLikes = (mIdx % 3) + 2;
    for (let l = 0; l < numLikes; l++) {
      const liker = createdUsers[(mIdx + l + 1) % createdUsers.length];
      if (!m.likes.includes(liker._id)) {
        m.likes.push(liker._id);
      }
    }
    m.likesCount = m.likes.length;

    // 2 Comments
    const cUser1 = createdUsers[(mIdx + 2) % createdUsers.length];
    await Comment.create({
      moment: m._id,
      author: cUser1._id,
      text: FRIENDLY_COMMENTS[mIdx % FRIENDLY_COMMENTS.length]
    });

    const cUser2 = createdUsers[(mIdx + 3) % createdUsers.length];
    await Comment.create({
      moment: m._id,
      author: cUser2._id,
      text: FRIENDLY_COMMENTS[(mIdx + 1) % FRIENDLY_COMMENTS.length]
    });
    m.commentsCount = 2;

    await m.save();

    // Create notifications for moment owner
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
    if (!cUser1._id.equals(m.owner)) {
      await Notification.create({
        to: m.owner,
        from: cUser1._id,
        type: 'comment',
        moment: m._id
      });
    }
  }

  // Create 10 Curated Albums (Cover assigned, 8 to 25 items, one with active secret share link)
  console.log('Creating 10 curated albums with real covers and secret share link...');
  const ALBUM_SPECS = [
    { title: 'Himalaya Trek', desc: 'Winding hill roads, deep pine valleys, and mountain dawns.', userIdx: 0, vis: 'public', share: false },
    { title: 'Goa, Winter 2024', desc: 'Golden sands, gentle surf, and sunset walks along the coast.', userIdx: 0, vis: 'public', share: true }, // ACTIVE SHARE TOKEN
    { title: 'Diwali at Home', desc: 'Clay diyas, brass lanterns, and warm family laughter.', userIdx: 1, vis: 'public', share: false },
    { title: 'Morning Tea & Sourdough', desc: 'Fresh crusty artisan loaves and steaming ginger chai.', userIdx: 1, vis: 'followers', share: false },
    { title: 'College Days & Road Trips', desc: 'Campfires under the stars and vintage bicycle journeys.', userIdx: 2, vis: 'public', share: false },
    { title: 'Pets Corner', desc: 'Golden retrievers in the meadow and sunbeam naps.', userIdx: 3, vis: 'public', share: false },
    { title: 'Street Food Diaries', desc: 'Crispy samosas, vibrant spice carts, and tawa rotis.', userIdx: 4, vis: 'public', share: false },
    { title: 'Monsoon Garden & Rain', desc: 'Raindrops on broad lotus leaves and cool forest streams.', userIdx: 5, vis: 'public', share: false },
    { title: 'Studio Pottery & Clay', desc: 'Centering terracotta on the wheel and studio shelves.', userIdx: 6, vis: 'private', share: false },
    { title: 'Botanical Notes & Books', desc: 'Pressed wildflowers, hardbound books, and watercolor tones.', userIdx: 7, vis: 'followers', share: false }
  ];

  for (let aIdx = 0; aIdx < ALBUM_SPECS.length; aIdx++) {
    const aSpec = ALBUM_SPECS[aIdx];
    const user = createdUsers[aSpec.userIdx];
    const uMedia = allMediaByUser.get(user.username) || [];
    const albumItems = uMedia.slice(0, Math.min(uMedia.length, 10));

    const shareToken = aSpec.share ? 'c8f16d46ca25ab19b0161b12' : null;

    await Album.create({
      owner: user._id,
      title: aSpec.title,
      description: aSpec.desc,
      visibility: aSpec.vis,
      media: albumItems.map((m) => m._id),
      cover: albumItems[0]?._id || null,
      shareToken
    });
  }

  console.log('\n======================================================');
  console.log('✓ SEEDING COMPLETED WITH REAL DEMO MEDIA!');
  console.log('======================================================');
  console.log(`Created ${createdUsers.length} users, ${createdMoments.length} moments, and 10 albums.`);
  console.log('\nDemo User Accounts (Password: Password123 for all):');
  createdUsers.forEach((u) => {
    console.log(`  - @${u.username.padEnd(12)} (${u.displayName})`);
  });
  console.log('\nActive Public Shared Album URL:');
  const sharedAlbum = await Album.findOne({ shareToken: 'c8f16d46ca25ab19b0161b12' });
  if (sharedAlbum) {
    console.log(`  http://localhost:5000/shared.html?token=${sharedAlbum.shareToken}`);
  }
  console.log('======================================================\n');

  if (!options.keepConnection) {
    await mongoose.disconnect();
  }
}

module.exports = { runSeed, DEMO_USERS: DEMO_PERSONAS, DEMO_PASSWORD };

if (require.main === module) {
  runSeed().catch((err) => {
    console.error('Seed script error:', err);
    process.exit(1);
  });
}
