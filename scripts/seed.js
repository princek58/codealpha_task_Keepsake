require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const User = require('../server/models/User');
const Post = require('../server/models/Post');
const Comment = require('../server/models/Comment');
const Notification = require('../server/models/Notification');

const DEMO_PASSWORD = 'Password123';
const DEMO_USERNAMES = [
  'daisy_bloom',
  'sunny_sprout',
  'lavender_sky',
  'rose_petal',
  'starry_moth',
  'cherry_blossom',
  'gentle_blob',
  'fern_green'
];

const uploadsDir = path.join(__dirname, '../server/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Generate sample pastel image files in uploads for blooms
function generateSampleImages() {
  const images = [];
  const svgSamples = [
    {
      name: 'seed_garden_window.svg',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
        <rect width="800" height="600" fill="#FFF8F3"/>
        <circle cx="400" cy="300" r="220" fill="#CDEFE2" opacity="0.6"/>
        <circle cx="400" cy="240" r="120" fill="#FFF0B3" stroke="#4A2C4F" stroke-width="8"/>
        <path d="M400 360 L400 480" stroke="#4A2C4F" stroke-width="12" stroke-linecap="round"/>
        <path d="M400 420 Q350 400 330 420 Q350 450 400 440" fill="#CDEFE2" stroke="#4A2C4F" stroke-width="8"/>
        <path d="M400 400 Q450 380 470 400 Q450 430 400 420" fill="#CDEFE2" stroke="#4A2C4F" stroke-width="8"/>
      </svg>`
    },
    {
      name: 'seed_tea_table.svg',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
        <rect width="800" height="600" fill="#FFF8F3"/>
        <circle cx="400" cy="300" r="240" fill="#FFCDB2" opacity="0.5"/>
        <rect x="280" y="260" width="240" height="160" rx="30" fill="#FFFFFF" stroke="#4A2C4F" stroke-width="8"/>
        <path d="M520 300 Q570 340 520 380" fill="none" stroke="#4A2C4F" stroke-width="8" stroke-linecap="round"/>
        <ellipse cx="400" cy="260" rx="120" ry="24" fill="#FFB3C7" stroke="#4A2C4F" stroke-width="6"/>
      </svg>`
    },
    {
      name: 'seed_sweet_peas.svg',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
        <rect width="800" height="600" fill="#FFF8F3"/>
        <circle cx="400" cy="300" r="220" fill="#D9C8FF" opacity="0.5"/>
        <circle cx="340" cy="260" r="60" fill="#FFB3C7" stroke="#4A2C4F" stroke-width="7"/>
        <circle cx="460" cy="260" r="60" fill="#FF6F91" stroke="#4A2C4F" stroke-width="7"/>
        <circle cx="400" cy="340" r="60" fill="#FFF0B3" stroke="#4A2C4F" stroke-width="7"/>
      </svg>`
    }
  ];

  svgSamples.forEach((item) => {
    const fullPath = path.join(uploadsDir, item.name);
    fs.writeFileSync(fullPath, item.svg);
    images.push(`/uploads/${item.name}`);
  });

  return images;
}

async function seed() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bloomly';
  console.log(`Connecting to MongoDB at ${mongoUri}...`);

  await mongoose.connect(mongoUri);
  console.log('Connected to database.');

  // 1. Clean previous demo seed data
  console.log('Clearing previous demo records...');
  const existingDemoUsers = await User.find({ username: { $in: DEMO_USERNAMES } });
  const demoUserIds = existingDemoUsers.map(u => u._id);

  if (demoUserIds.length > 0) {
    await Post.deleteMany({ author: { $in: demoUserIds } });
    await Comment.deleteMany({ author: { $in: demoUserIds } });
    await Notification.deleteMany({ $or: [{ to: { $in: demoUserIds } }, { from: { $in: demoUserIds } }] });
    await User.deleteMany({ _id: { $in: demoUserIds } });
  }

  // 2. Hash password
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const sampleImages = generateSampleImages();

  // 3. Create ~8 gardeners
  console.log('Creating demo gardeners...');
  const gardenersData = [
    {
      username: 'daisy_bloom',
      email: 'daisy@bloomly.app',
      displayName: 'Daisy',
      bio: 'Planting quiet moments and afternoon chamomile tea 🌼',
      moodSticker: 'flower'
    },
    {
      username: 'sunny_sprout',
      email: 'sunny@bloomly.app',
      displayName: 'Sunny',
      bio: 'Small daily joys, windowsill basil, and gentle sunbeams ☀️🌱',
      moodSticker: 'sprout'
    },
    {
      username: 'lavender_sky',
      email: 'lavender@bloomly.app',
      displayName: 'Lavender',
      bio: 'Soft clouds, rainy books, and sleepy evening poetry ☁️💜',
      moodSticker: 'cloud'
    },
    {
      username: 'rose_petal',
      email: 'rose@bloomly.app',
      displayName: 'Rose',
      bio: 'Curating memories of wild garden roses and cozy bakeries 🌹🍰',
      moodSticker: 'heart'
    },
    {
      username: 'starry_moth',
      email: 'orion@bloomly.app',
      displayName: 'Orion',
      bio: 'Stargazing from the balcony and nocturnal tea walks ✨🌙',
      moodSticker: 'star'
    },
    {
      username: 'cherry_blossom',
      email: 'sakura@bloomly.app',
      displayName: 'Sakura',
      bio: 'Pink blossoms in the gentle spring breeze 🌸🍒',
      moodSticker: 'cherry'
    },
    {
      username: 'gentle_blob',
      email: 'mochi@bloomly.app',
      displayName: 'Mochi',
      bio: 'Soft round thoughts, warm blankets, and peaceful naps 🍮',
      moodSticker: 'smiley_blob'
    },
    {
      username: 'fern_green',
      email: 'fern@bloomly.app',
      displayName: 'Fern',
      bio: 'Collecting vintage botanicals and forest moss 🌿🪴',
      moodSticker: 'plant'
    }
  ];

  const createdUsers = [];
  for (const g of gardenersData) {
    const user = await User.create({
      ...g,
      passwordHash
    });
    createdUsers.push(user);
  }

  // 4. Create follow relationships
  console.log('Establishing garden connections (follows)...');
  // Daisy connects with Sunny, Lavender, Rose, Sakura
  createdUsers[0].following.push(createdUsers[1]._id, createdUsers[2]._id, createdUsers[3]._id, createdUsers[5]._id);
  // Sunny connects with Daisy, Rose, Fern, Mochi
  createdUsers[1].following.push(createdUsers[0]._id, createdUsers[3]._id, createdUsers[7]._id, createdUsers[6]._id);
  // Lavender connects with Daisy, Orion, Sakura
  createdUsers[2].following.push(createdUsers[0]._id, createdUsers[4]._id, createdUsers[5]._id);
  // Rose connects with Daisy, Sunny, Mochi
  createdUsers[3].following.push(createdUsers[0]._id, createdUsers[1]._id, createdUsers[6]._id);
  // Orion connects with Lavender, Sakura, Fern
  createdUsers[4].following.push(createdUsers[2]._id, createdUsers[5]._id, createdUsers[7]._id);
  // Sakura connects with Daisy, Lavender, Rose
  createdUsers[5].following.push(createdUsers[0]._id, createdUsers[2]._id, createdUsers[3]._id);
  // Mochi connects with Daisy, Sunny, Fern
  createdUsers[6].following.push(createdUsers[0]._id, createdUsers[1]._id, createdUsers[7]._id);
  // Fern connects with Daisy, Sunny, Orion
  createdUsers[7].following.push(createdUsers[0]._id, createdUsers[1]._id, createdUsers[4]._id);

  // Update followers arrays
  for (const u of createdUsers) {
    for (const followedId of u.following) {
      const followedUser = createdUsers.find(x => x._id.equals(followedId));
      if (followedUser && !followedUser.followers.some(id => id.equals(u._id))) {
        followedUser.followers.push(u._id);
      }
    }
  }

  // Save all users with updated counts
  for (const u of createdUsers) {
    await u.save();
  }

  // 5. Create ~25 cozy bloom posts
  console.log('Planting ~25 moments (blooms)...');
  const postTexts = [
    { u: 0, text: 'Morning tea by the garden window with sweet peas in bloom 🌱☕️', img: sampleImages[2] },
    { u: 1, text: 'The basil seeds sprouted this morning! Tiny green wonders on the kitchen sill.', img: null },
    { u: 2, text: 'A gentle drizzle outside. Curling up with an old notebook and hot lavender brew.', img: sampleImages[1] },
    { u: 3, text: 'Baked fresh cinnamon scones with strawberry jam. Wishing everyone a sweet afternoon.', img: null },
    { u: 4, text: 'Clear skies tonight. Spotting Jupiter and quiet city lights from my porch.', img: null },
    { u: 5, text: 'First cherry blossom petals drifting past the studio door. Spring is whispering.', img: sampleImages[0] },
    { u: 6, text: 'Reminder to drink some water, relax your shoulders, and breathe deeply today.', img: null },
    { u: 7, text: 'Repotted my favorite maidenhair fern in fresh earth. Gardening is therapy.', img: null },
    { u: 0, text: 'Sunlight filtering through the curtains like honey. Happy quiet Sunday.', img: null },
    { u: 1, text: 'Found a baby ladybug resting on a sweet pea leaf. Nature is so gentle.', img: null },
    { u: 2, text: 'Listening to classical piano while watching the rain patter against the glass pane.', img: null },
    { u: 3, text: 'Rosemary and thyme drying upside down in the kitchen corner. Smells wonderful.', img: null },
    { u: 4, text: 'Midnight sketches and quiet thoughts. The world is peaceful when asleep.', img: null },
    { u: 5, text: 'Watercolor painting little wildflowers all afternoon. Hands full of soft pastel colors.', img: sampleImages[1] },
    { u: 6, text: 'Warm vanilla oat latte and a thick fluffy cardigan. Peak cozy season.', img: null },
    { u: 7, text: 'Walking in the pine forest after morning fog. The air smells like fresh rain.', img: null },
    { u: 0, text: 'Gave a sprig of garden lavender to my neighbor today. Little kindnesses bloom big.', img: null },
    { u: 1, text: 'Sunset turned the entire sky into peach and strawberry cream.', img: null },
    { u: 2, text: 'Reading old letters tucked inside vintage books. Time moves in gentle circles.', img: null },
    { u: 3, text: 'Pressed a wild buttercup inside my journal pages.', img: null },
    { u: 4, text: 'The moon is a delicate silver crescent tonight.', img: null },
    { u: 5, text: 'Brewed a pot of white peach tea for the afternoon garden break.', img: sampleImages[2] },
    { u: 6, text: 'Slow days are not wasted days. Rest is productive.', img: null },
    { u: 7, text: 'Spotted a little brown sparrow taking a bath in the bird fountain!', img: null },
    { u: 0, text: 'Thank you all for sharing such peaceful moments in this quiet garden.', img: null }
  ];

  const createdPosts = [];
  for (let i = 0; i < postTexts.length; i++) {
    const item = postTexts[i];
    const author = createdUsers[item.u];

    // Stagger dates slightly over the last few days
    const postDate = new Date(Date.now() - (postTexts.length - i) * 3600000 * 3);

    const post = await Post.create({
      author: author._id,
      text: item.text,
      image: item.img || '',
      likes: [],
      commentsCount: 0,
      createdAt: postDate
    });

    author.postsCount = (author.postsCount || 0) + 1;
    await author.save();
    createdPosts.push(post);
  }

  // 6. Add Likes, Comments, and Notifications
  console.log('Sprinkling hearts and sweet comments...');
  const commentsPool = [
    'This made my morning so much brighter!',
    'What a peaceful moment to share 🌱',
    'Saving this cozy inspiration for later.',
    'Such lovely words. Thank you for planting this!',
    'The colors are wonderful ✨',
    'Sending warm thoughts from my corner of the garden!'
  ];

  for (let i = 0; i < createdPosts.length; i++) {
    const post = createdPosts[i];
    // Pick 2-4 random likers
    const likers = createdUsers.filter((u, idx) => idx !== (i % createdUsers.length) && (idx + i) % 2 === 0);
    for (const liker of likers) {
      post.likes.push(liker._id);

      // Create notification
      await Notification.create({
        to: post.author,
        from: liker._id,
        type: 'like',
        postId: post._id,
        postPreview: post.text ? post.text.slice(0, 40) : '',
        read: i < 15,
        createdAt: new Date(post.createdAt.getTime() + 600000)
      });
    }

    // Add 1-2 comments on some posts
    if (i % 2 === 0) {
      const commenter = createdUsers[(i + 1) % createdUsers.length];
      const commentText = commentsPool[i % commentsPool.length];

      const comment = await Comment.create({
        post: post._id,
        author: commenter._id,
        text: commentText,
        createdAt: new Date(post.createdAt.getTime() + 1200000)
      });

      post.commentsCount = 1;

      // Notification
      await Notification.create({
        to: post.author,
        from: commenter._id,
        type: 'comment',
        postId: post._id,
        postPreview: post.text ? post.text.slice(0, 40) : '',
        read: i < 15,
        createdAt: comment.createdAt
      });
    }

    await post.save();
  }

  // Add follow notifications
  for (let i = 1; i < 4; i++) {
    await Notification.create({
      to: createdUsers[0]._id,
      from: createdUsers[i]._id,
      type: 'follow',
      read: false,
      createdAt: new Date(Date.now() - i * 1800000)
    });
  }

  console.log('\n=============================================');
  console.log('   BLOONLY GARDEN SEED COMPLETE!');
  console.log('=============================================');
  console.log(`Gardeners Created : ${createdUsers.length}`);
  console.log(`Blooms Planted    : ${createdPosts.length}`);
  console.log(`Demo Password     : ${DEMO_PASSWORD}`);
  console.log('\nDemo Gardener Logins:');
  createdUsers.forEach((u) => {
    console.log(`  - @${u.username.padEnd(16)} | Email: ${u.email.padEnd(22)} | Mood: ${u.moodSticker}`);
  });
  console.log('=============================================\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
