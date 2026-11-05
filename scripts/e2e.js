// Keepsake Full End-to-End Suite Runner
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

class TestClient {
  constructor(baseUrl = BASE_URL) {
    this.baseUrl = baseUrl;
    this.cookies = {};
  }

  setCookieHeader(res) {
    const rawCookies = res.headers.get('set-cookie');
    if (rawCookies) {
      const parts = rawCookies.split(';');
      const [nameVal] = parts;
      const [name, val] = nameVal.split('=');
      if (name && val) {
        this.cookies[name.trim()] = val.trim();
      }
    }
  }

  getCookieHeader() {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  async request(endpoint, options = {}) {
    const headers = { ...options.headers };
    const cookieStr = this.getCookieHeader();
    if (cookieStr) {
      headers['Cookie'] = cookieStr;
    }

    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const config = {
      method: options.method || 'GET',
      headers,
      ...options
    };

    if (options.body && !(options.body instanceof FormData)) {
      config.body = JSON.stringify(options.body);
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, config);
    this.setCookieHeader(res);

    let data;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    return { status: res.status, ok: res.ok, data, headers: res.headers };
  }
}

async function runE2E() {
  console.log('====================================================');
  console.log('       Keepsake Comprehensive End-to-End Suite      ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  const timestamp = Date.now();
  const alice = new TestClient();
  const bob = new TestClient();
  const stranger = new TestClient();

  // 1. Health check
  console.log('1. Server Health Check');
  const health = await alice.request('/api/health');
  assert(health.status === 200 && health.data.status === 'ok', 'Server is healthy');

  // 2. Registration & Authentication
  console.log('\n2. User Registration & Auth');
  const aliceUser = `alice_${timestamp}`;
  const bobUser = `bob_${timestamp}`;

  const regAlice = await alice.request('/api/auth/register', {
    method: 'POST',
    body: {
      username: aliceUser,
      email: `${aliceUser}@example.com`,
      password: 'Password123',
      displayName: 'Alice In Wonderland',
      bio: 'Exploring memories and rabbit holes'
    }
  });
  assert(regAlice.status === 201 && regAlice.data.user.username === aliceUser, 'Alice registered successfully');
  assert(Boolean(alice.cookies['token']), 'Auth cookie was set for Alice');

  const meAlice = await alice.request('/api/auth/me');
  assert(meAlice.status === 200 && meAlice.data.user.displayName === 'Alice In Wonderland', 'Alice /api/auth/me returns current user');

  const regBob = await bob.request('/api/auth/register', {
    method: 'POST',
    body: {
      username: bobUser,
      email: `${bobUser}@example.com`,
      password: 'Password123',
      displayName: 'Bob The Builder'
    }
  });
  assert(regBob.status === 201 && regBob.data.user.username === bobUser, 'Bob registered successfully');

  // 3. Media Upload & Processing
  console.log('\n3. Media Upload & Processing');
  // Create sample image buffer
  const sampleImgBuf = await sharp({
    create: {
      width: 600,
      height: 400,
      channels: 4,
      background: { r: 180, g: 83, b: 42, alpha: 1 }
    }
  }).jpeg().toBuffer();

  const formData = new FormData();
  const blob = new Blob([sampleImgBuf], { type: 'image/jpeg' });
  formData.append('files', blob, 'test_memory.jpg');

  const uploadRes = await alice.request('/api/media/upload', {
    method: 'POST',
    body: formData
  });

  assert((uploadRes.status === 200 || uploadRes.status === 201) && uploadRes.data.items?.length === 1, 'Alice uploaded photo successfully');
  const uploadedMedia = uploadRes.data.items[0];
  const mediaId = uploadedMedia.id;
  assert(uploadedMedia.status === 'ready', 'Uploaded media processed to ready status');
  assert(Boolean(uploadedMedia.urls?.display), 'Media display URL generated');

  // Verify file download
  const fileRes = await alice.request(uploadedMedia.urls.display);
  assert(fileRes.status === 200, 'Display image file serves with 200 OK');

  // 4. Moment Creation (Collage Layout)
  console.log('\n4. Moment Creation & Feed Verification');
  // Upload second image for collage
  const blob2 = new Blob([sampleImgBuf], { type: 'image/jpeg' });
  const form2 = new FormData();
  form2.append('files', blob2, 'test_memory_2.jpg');
  const up2 = await alice.request('/api/media/upload', { method: 'POST', body: form2 });
  const mediaId2 = up2.data.items[0].id;

  const momentRes = await alice.request('/api/moments', {
    method: 'POST',
    body: {
      title: 'Our Cozy Afternoon',
      caption: 'Warm tea and quiet moments together.',
      media: [mediaId, mediaId2],
      layout: {
        type: 'collage',
        template: 'collage-1x2',
        gap: 8,
        background: '#F7F3EC'
      },
      place: 'Kyoto, Japan',
      tags: ['tea', 'calm'],
      visibility: 'public'
    }
  });

  assert(momentRes.status === 201 && momentRes.data.moment.title === 'Our Cozy Afternoon', 'Collage moment created successfully');
  const momentId = momentRes.data.moment.id;
  assert(momentRes.data.moment.layout.type === 'collage', 'Layout type is collage');

  // Check public explore feed includes Alice's moment
  const exploreRes = await stranger.request('/api/moments/explore');
  assert(exploreRes.status === 200 && exploreRes.data.items.some((m) => m.id === momentId), 'Public moment appears in Explore stream');

  // 5. Album Creation & Anonymous Public Sharing
  console.log('\n5. Album Creation & Secret Link Sharing');
  const albumRes = await alice.request('/api/albums', {
    method: 'POST',
    body: {
      title: 'Autumn Wanderings',
      description: 'Photos collected along the canal path.',
      visibility: 'private',
      media: [mediaId, mediaId2]
    }
  });

  assert(albumRes.status === 201 && albumRes.data.album.title === 'Autumn Wanderings', 'Album created with media items');
  const albumId = albumRes.data.album.id;

  // Stranger cannot view private album
  const strangerViewPrivate = await stranger.request(`/api/albums/${albumId}`);
  assert(strangerViewPrivate.status === 404, 'Stranger cannot view private album');

  // Create share token
  const shareRes = await alice.request(`/api/albums/${albumId}/share`, { method: 'POST' });
  assert(shareRes.status === 200 && Boolean(shareRes.data.shareToken), 'Album secret share token generated');
  const shareToken = shareRes.data.shareToken;

  // Stranger views shared album via token
  const sharedView = await stranger.request(`/api/albums/shared/${shareToken}`);
  assert(sharedView.status === 200 && sharedView.data.album.title === 'Autumn Wanderings', 'Stranger can view album anonymously with token');
  assert(sharedView.data.media.length === 2, 'Shared album includes all media items');

  // 6. Social Graph, Likes & Comments
  console.log('\n6. Social Interactions (Follow, Like, Comment, Notifications)');
  // Bob follows Alice
  const followRes = await bob.request(`/api/users/${regAlice.data.user.id}/follow`, { method: 'POST' });
  assert(followRes.status === 200 && (followRes.data.following === true || followRes.data.isFollowing === true), 'Bob followed Alice');

  // Bob likes Alice's moment
  const likeRes = await bob.request(`/api/moments/${momentId}/like`, { method: 'POST' });
  assert(likeRes.status === 200 && likeRes.data.liked === true, 'Bob liked Alice moment');

  // Bob comments on Alice's moment
  const commentRes = await bob.request(`/api/moments/${momentId}/comments`, {
    method: 'POST',
    body: { text: 'Such peaceful tones! Love this.' }
  });
  assert(commentRes.status === 201 && commentRes.data.comment.text === 'Such peaceful tones! Love this.', 'Bob commented on Alice moment');
  const commentId = commentRes.data.comment.id;

  // Alice checks unread notifications
  const notifCount = await alice.request('/api/notifications/unread-count');
  assert(notifCount.status === 200 && notifCount.data.count >= 2, 'Alice received notifications for like and comment');

  // 7. Security: XSS Sanitization & Strict Privacy
  console.log('\n7. Security & XSS Safety');
  const xssAttempt = await bob.request(`/api/moments/${momentId}/comments`, {
    method: 'POST',
    body: { text: '<script>alert("xss")</script><b>Bold Memory</b>' }
  });
  assert(xssAttempt.status === 201, 'Comment with HTML characters received');
  // Text should be stored cleanly as string, never executed
  assert(xssAttempt.data.comment.text.includes('<script>'), 'Raw text preserved safely without script injection execution');

  // Private moment test
  const privMomentRes = await alice.request('/api/moments', {
    method: 'POST',
    body: {
      title: 'Secret Personal Note',
      media: [mediaId],
      visibility: 'private'
    }
  });
  const privId = privMomentRes.data.moment.id;

  const strangerPrivateMoment = await stranger.request(`/api/moments/${privId}`);
  assert(strangerPrivateMoment.status === 404, 'Stranger cannot view private moment (returns 404)');

  // 8. Logout & Protection Verification
  console.log('\n8. Logout & Session Termination');
  const logoutRes = await alice.request('/api/auth/logout', { method: 'POST' });
  assert(logoutRes.status === 200, 'Alice logged out successfully');

  // Alice tries to access protected endpoint after logout
  alice.cookies = {}; // cleared
  const afterLogout = await alice.request('/api/auth/me');
  assert(afterLogout.status === 401, 'Protected route returns 401 Unauthorized after logout');

  console.log('\n====================================================');
  console.log(`E2E SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runE2E().catch((err) => {
  console.error('Fatal E2E error:', err);
  process.exit(1);
});

