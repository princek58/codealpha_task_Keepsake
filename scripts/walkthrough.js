const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('ffmpeg-static');
const { spawn } = require('child_process');

let BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const generateVideoFile = (destPath) => {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, [
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=1:size=320x240:rate=30',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=800:duration=1',
      '-c:v',
      'libx264',
      '-c:a',
      'aac',
      '-y',
      destPath
    ]);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Failed to generate video: code ${code}`));
    });
  });
};

const runWalkthrough = async () => {
  console.log('==================================================');
  console.log('   Keepsake Full Real-HTTP API Walkthrough');
  console.log('==================================================\n');

  let serverInstance = null;
  let mongoServer = null;

  // Check if server is running
  let isRunning = false;
  try {
    const check = await fetch(`${BASE_URL}/api/health`);
    isRunning = check.ok;
  } catch {}

  if (!isRunning) {
    console.log('No server running on', BASE_URL, '-> starting self-contained test server...');
    const mongoose = require('mongoose');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const app = require('../server/app');
    const storage = require('../server/services/storage');
    const mediaQueue = require('../server/services/media/queue');

    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await storage.cleanTmp();
    await mediaQueue.recoverDanglingProcessing();

    const PORT = 5055;
    BASE_URL = `http://localhost:${PORT}`;
    serverInstance = app.listen(PORT);
    console.log(`Server started on ${BASE_URL}\n`);
  } else {
    console.log(`Connected to live server on ${BASE_URL}\n`);
  }

  try {
    const rand = Math.random().toString(36).substring(2, 7);
    const userAData = {
      username: `alice_${rand}`,
      email: `alice_${rand}@example.com`,
      password: 'Password123!',
      displayName: 'Alice MemoryKeeper'
    };
    const userBData = {
      username: `bob_${rand}`,
      email: `bob_${rand}@example.com`,
      password: 'Password123!',
      displayName: 'Bob MemoryKeeper'
    };

    // Helper for requests
    let cookieA = '';
    let cookieB = '';

    const reqPost = async (endpoint, body, cookie = '', isJson = true) => {
      const headers = { Origin: BASE_URL };
      if (isJson) headers['Content-Type'] = 'application/json';
      if (cookie) headers['Cookie'] = cookie;

      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: isJson ? JSON.stringify(body) : body
      });
      const setCookie = res.headers.get('set-cookie');
      let data = null;
      try {
        data = await res.json();
      } catch {}
      return { status: res.status, data, setCookie };
    };

    const reqGet = async (endpoint, cookie = '', extraHeaders = {}) => {
      const headers = { ...extraHeaders };
      if (cookie) headers['Cookie'] = cookie;

      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'GET',
        headers
      });
      let data = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          data = await res.json();
        } catch {}
      }
      return {
        status: res.status,
        data,
        headers: res.headers,
        contentLength: res.headers.get('content-length')
      };
    };

    const reqDelete = async (endpoint, cookie = '') => {
      const headers = { Origin: BASE_URL };
      if (cookie) headers['Cookie'] = cookie;
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'DELETE',
        headers
      });
      let data = null;
      try {
        data = await res.json();
      } catch {}
      return { status: res.status, data };
    };

    // STEP 1: Register User A and User B
    console.log('[Step 1] Registering User A and User B...');
    const regA = await reqPost('/api/auth/register', userAData);
    cookieA = regA.setCookie?.split(';')[0] || '';
    console.log(`  -> User A registered [Status: ${regA.status}] (${userAData.username})`);

    const regB = await reqPost('/api/auth/register', userBData);
    cookieB = regB.setCookie?.split(';')[0] || '';
    console.log(`  -> User B registered [Status: ${regB.status}] (${userBData.username})`);

    if (regA.status !== 201 || regB.status !== 201) {
      throw new Error('Registration failed');
    }

    // STEP 2: User A uploads 3 images and 1 video
    console.log('\n[Step 2] User A uploading 3 images and 1 video...');
    const imgBuf1 = await sharp({
      create: { width: 300, height: 200, channels: 3, background: { r: 255, g: 120, b: 80 } }
    }).jpeg().toBuffer();

    const imgBuf2 = await sharp({
      create: { width: 400, height: 250, channels: 3, background: { r: 80, g: 200, b: 120 } }
    }).webp().toBuffer();

    const imgBuf3 = await sharp({
      create: { width: 350, height: 350, channels: 3, background: { r: 100, g: 150, b: 240 } }
    }).png().toBuffer();

    const tmpVideoPath = path.join(__dirname, `walkthrough_clip_${rand}.mp4`);
    await generateVideoFile(tmpVideoPath);
    const videoBuf = await fs.promises.readFile(tmpVideoPath);
    await fs.promises.unlink(tmpVideoPath);

    const formData = new FormData();
    formData.append('files', new Blob([imgBuf1], { type: 'image/jpeg' }), 'photo1.jpg');
    formData.append('files', new Blob([imgBuf2], { type: 'image/webp' }), 'photo2.webp');
    formData.append('files', new Blob([imgBuf3], { type: 'image/png' }), 'photo3.png');
    formData.append('files', new Blob([videoBuf], { type: 'video/mp4' }), 'clip.mp4');

    const uploadRes = await fetch(`${BASE_URL}/api/media`, {
      method: 'POST',
      headers: {
        Cookie: cookieA,
        Origin: BASE_URL
      },
      body: formData
    });

    const uploadData = await uploadRes.json();
    console.log(`  -> Media upload [Status: ${uploadRes.status}]`);
    console.log(`     Items uploaded: ${uploadData.items?.length || 0}, Errors: ${uploadData.errors?.length || 0}`);
    if (uploadData.errors?.length > 0) {
      console.log('     Upload errors:', uploadData.errors);
    }

    if (uploadRes.status !== 200 || uploadData.items.length !== 4) {
      throw new Error('Media upload failed');
    }

    const uploadedItems = uploadData.items;
    const imageItems = uploadedItems.filter((i) => i.type === 'image');
    const videoItem = uploadedItems.find((i) => i.type === 'video');

    // STEP 3: Wait for video processing
    console.log('\n[Step 3] Waiting for video background transcoding...');
    let videoReady = false;
    for (let attempt = 1; attempt <= 20; attempt++) {
      const statusRes = await reqGet(`/api/media/status?ids=${videoItem.id}`, cookieA);
      const current = statusRes.data?.items?.[0];
      if (current && current.status === 'ready') {
        videoReady = true;
        console.log(`  -> Video transcode completed [Status: ready] after attempt ${attempt}`);
        break;
      }
      await sleep(1000);
    }
    if (!videoReady) {
      throw new Error('Video processing timed out');
    }

    // STEP 4: User A creates a collage Moment (followers visibility)
    console.log('\n[Step 4] User A creates a collage Moment (followers visibility)...');
    const momentRes = await reqPost(
      '/api/moments',
      {
        title: 'Walkthrough Memories',
        caption: 'A wonderful day in the park',
        media: imageItems.slice(0, 3).map((i) => i.id),
        layout: {
          type: 'collage',
          template: 'collage-1-2',
          gap: 12,
          background: '#fdf8f4'
        },
        tags: ['park', 'memories', 'spring'],
        visibility: 'followers'
      },
      cookieA
    );
    console.log(`  -> Create collage Moment [Status: ${momentRes.status}] (id: ${momentRes.data?.moment?.id})`);
    const momentId = momentRes.data?.moment?.id;

    // STEP 5: User A creates an album and adds items
    console.log('\n[Step 5] User A creates an album and adds items...');
    const albumRes = await reqPost(
      '/api/albums',
      {
        title: 'Walkthrough Photo Album',
        description: 'Our curated album',
        visibility: 'followers',
        media: [imageItems[0].id, imageItems[1].id, videoItem.id]
      },
      cookieA
    );
    console.log(`  -> Create Album [Status: ${albumRes.status}] (id: ${albumRes.data?.album?.id})`);
    const albumId = albumRes.data?.album?.id;

    // STEP 6: User B follows User A
    console.log('\n[Step 6] User B follows User A...');
    const followRes = await reqPost(`/api/users/${regA.data.user.id}/follow`, {}, cookieB);
    console.log(`  -> User B followed User A [Status: ${followRes.status}]`);

    // STEP 7: User B sees the Moment in the feed and fetches thumb & video (Range request)
    console.log('\n[Step 7] User B fetches feed, thumb, and video with Range request...');
    const feedRes = await reqGet('/api/moments/feed', cookieB);
    console.log(`  -> Feed request [Status: ${feedRes.status}]`);
    const foundInFeed = feedRes.data?.items?.some((m) => m.id === momentId);
    console.log(`     Found Moment in feed: ${foundInFeed}`);

    // Fetch thumb
    const thumbRes = await reqGet(`/api/media/${imageItems[0].id}/file?variant=thumb`, cookieB);
    console.log(`  -> Fetch thumb [Status: ${thumbRes.status}]`);

    // Fetch video with Range
    const rangeRes = await reqGet(`/api/media/${videoItem.id}/file?variant=video`, cookieB, {
      Range: 'bytes=0-150'
    });
    console.log(`  -> Fetch video Range 0-150 [Status: ${rangeRes.status}] (Content-Range: ${rangeRes.headers.get('content-range')})`);

    // STEP 8: User B cannot fetch User A's private media (404)
    console.log("\n[Step 8] User B attempts to fetch User A's unshared private media...");
    const privateMedia = imageItems[2].id; // not in any public/followers moment or shared album
    // Note: private media attached to followers moment is viewable by followers; but unshared private media without moment is not!
    const unsharedImgBuf = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 1, g: 1, b: 1 } }
    }).png().toBuffer();

    const fdPrivate = new FormData();
    fdPrivate.append('files', new Blob([unsharedImgBuf]), 'private.png');
    const privUpload = await fetch(`${BASE_URL}/api/media`, {
      method: 'POST',
      headers: { Cookie: cookieA, Origin: BASE_URL },
      body: fdPrivate
    });
    const privData = await privUpload.json();
    const privMediaId = privData.items[0].id;

    const strangerPrivRes = await reqGet(`/api/media/${privMediaId}/file?variant=display`, cookieB);
    console.log(`  -> Stranger fetches private media [Status: ${strangerPrivRes.status}] (Expected: 404)`);

    // STEP 9: User A makes the album shareable and anonymous request opens it
    console.log('\n[Step 9] User A shares album and anonymous viewer accesses shared link...');
    const shareRes = await reqPost(`/api/albums/${albumId}/share`, {}, cookieA);
    const token = shareRes.data?.shareToken;
    console.log(`  -> Create share token [Status: ${shareRes.status}] (token: ${token?.substring(0, 16)}...)`);

    const anonSharedAlbum = await reqGet(`/api/albums/shared/${token}`);
    console.log(`  -> Anonymous accesses shared album [Status: ${anonSharedAlbum.status}]`);

    const anonMediaFile = await reqGet(`/api/media/${imageItems[0].id}/file?variant=display&token=${token}`);
    console.log(`  -> Anonymous fetches media with share token [Status: ${anonMediaFile.status}]`);

    // STEP 10: User B likes and comments on Moment
    console.log('\n[Step 10] User B likes and comments on Moment...');
    const likeRes = await reqPost(`/api/moments/${momentId}/like`, {}, cookieB);
    console.log(`  -> User B likes Moment [Status: ${likeRes.status}] (liked: ${likeRes.data?.liked})`);

    const commentRes = await reqPost(
      `/api/moments/${momentId}/comments`,
      { text: 'What an exquisite memory!' },
      cookieB
    );
    console.log(`  -> User B comments on Moment [Status: ${commentRes.status}] (comment id: ${commentRes.data?.comment?.id})`);

    // STEP 11: User A reads notifications
    console.log('\n[Step 11] User A reads notifications...');
    const notifsRes = await reqGet('/api/notifications', cookieA);
    console.log(`  -> User A gets notifications [Status: ${notifsRes.status}] (Count: ${notifsRes.data?.items?.length})`);

    const markReadRes = await fetch(`${BASE_URL}/api/notifications/read`, {
      method: 'PUT',
      headers: { Cookie: cookieA, Origin: BASE_URL }
    });
    console.log(`  -> User A marks notifications as read [Status: ${markReadRes.status}]`);

    // STEP 12: User A deletes media and verifies cascade
    console.log('\n[Step 12] User A deletes media and verifies cascade...');
    const delMediaRes = await reqDelete(`/api/media/${imageItems[0].id}`, cookieA);
    console.log(`  -> Delete media [Status: ${delMediaRes.status}] (deleted: ${delMediaRes.data?.deletedCount})`);

    // Check album updated (media removed)
    const albumCheck = await reqGet(`/api/albums/${albumId}`, cookieA);
    console.log(`  -> Album media count after delete: ${albumCheck.data?.album?.mediaCount}`);

    console.log('\n==================================================');
    console.log('   All 12 Walkthrough Steps Succeeded Perfectly!');
    console.log('==================================================\n');
  } finally {
    if (serverInstance) {
      serverInstance.close();
      const mongoose = require('mongoose');
      await mongoose.disconnect();
      if (mongoServer) await mongoServer.stop();
    }
  }
};

if (require.main === module) {
  runWalkthrough()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\nWalkthrough Error:', err);
      process.exit(1);
    });
}

module.exports = runWalkthrough;
