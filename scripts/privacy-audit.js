// Keepsake Automated Privacy Audit
// Tests cross-user data isolation across feeds, explore, profiles, direct moment URLs, album lists, and media file access.
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const config = require('../server/config');
const User = require('../server/models/User');
const Moment = require('../server/models/Moment');
const Album = require('../server/models/Album');
const Media = require('../server/models/Media');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

class Client {
  constructor(baseUrl = BASE_URL) {
    this.baseUrl = baseUrl;
    this.cookies = {};
  }

  setCookieHeader(res) {
    const rawCookies = res.headers['set-cookie'];
    if (rawCookies) {
      const arr = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
      arr.forEach((str) => {
        const parts = str.split(';');
        const [nameVal] = parts;
        const [name, val] = nameVal.split('=');
        if (name && val) {
          this.cookies[name.trim()] = val.trim();
        }
      });
    }
  }

  getCookieHeader() {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  async request(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.baseUrl);
      const reqHeaders = { ...(options.headers || {}) };
      const cookieStr = this.getCookieHeader();
      if (cookieStr) {
        reqHeaders['Cookie'] = cookieStr;
      }

      let bodyData = null;
      if (options.body && typeof options.body === 'object') {
        bodyData = JSON.stringify(options.body);
        reqHeaders['Content-Type'] = 'application/json';
      }

      const req = http.request(
        url,
        {
          method: options.method || 'GET',
          headers: reqHeaders
        },
        (res) => {
          this.setCookieHeader(res);
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            let parsed = null;
            try {
              parsed = JSON.parse(data);
            } catch {
              parsed = data;
            }
            resolve({ status: res.statusCode, headers: res.headers, data: parsed });
          });
        }
      );

      req.on('error', reject);
      if (bodyData) req.write(bodyData);
      req.end();
    });
  }

  async login(email, password) {
    const res = await this.request('/api/auth/login', {
      method: 'POST',
      body: { email, password }
    });
    return res;
  }
}

async function runPrivacyAudit() {
  console.log('========================================================');
  console.log('            Keepsake Automated Privacy Audit            ');
  console.log('========================================================\n');

  await mongoose.connect(config.mongodbUri);

  const DEMO_USERNAMES = ['willow', 'jasper', 'elena', 'kai', 'maya', 'sorin', 'nora', 'clara'];
  const seedUsers = await User.find({ username: { $in: DEMO_USERNAMES } });
  if (seedUsers.length === 0) {
    console.error('No seed users found in database. Run "npm run seed" first.');
    process.exit(1);
  }

  console.log(`Auditing privacy rules across ${seedUsers.length} seed users...\n`);

  const userClients = new Map();
  for (const u of seedUsers) {
    const client = new Client();
    const token = jwt.sign({ id: u._id.toString() }, config.jwtSecret || process.env.JWT_SECRET || 'keepsake-jwt-secret-key-1234567890');
    client.cookies['token'] = token;
    userClients.set(u.id || u._id.toString(), { user: u, client });
  }

  const anonClient = new Client();
  let checksPassed = 0;
  let leaks = [];

  // 1. Audit Explore Stream
  console.log('1. Checking Explore stream (MUST contain only Public moments)...');
  for (const [id, { user, client }] of userClients.entries()) {
    const res = await client.request('/api/moments/explore');
    const items = res.data?.items || [];
    for (const item of items) {
      const doc = await Moment.findById(item.id);
      if (doc && doc.visibility !== 'public') {
        leaks.push(`Explore stream leaked non-public moment ${item.id} (${doc.visibility}) to ${user.username}`);
      } else {
        checksPassed++;
      }
    }
  }

  // Explore for anonymous
  const anonExplore = await anonClient.request('/api/moments/explore');
  for (const item of (anonExplore.data?.items || [])) {
    const doc = await Moment.findById(item.id);
    if (doc && doc.visibility !== 'public') {
      leaks.push(`Explore stream leaked non-public moment ${item.id} (${doc.visibility}) to anonymous viewer`);
    } else {
      checksPassed++;
    }
  }
  console.log(`  ✓ Explore check passed (${checksPassed} items verified public-only)`);

  // 2. Audit Direct Moment Access & Profile Streams
  console.log('\n2. Checking Moment Privacy & Direct Access Controls...');
  const allMoments = await Moment.find({}).populate('owner');

  for (const m of allMoments) {
    if (!m.owner) continue;
    const ownerId = m.owner._id.toString();

    for (const [viewerId, { user: viewer, client: viewerClient }] of userClients.entries()) {
      if (viewerId === ownerId) continue; // Owner is allowed to view own moments

      const isFollowing = viewer.following && viewer.following.some(f => f.toString() === ownerId);
      const res = await viewerClient.request(`/api/moments/${m._id}`);

      if (m.visibility === 'private') {
        if (res.status === 200) {
          leaks.push(`Private moment ${m._id} of @${m.owner.username} was accessible to @${viewer.username} (status ${res.status})`);
        } else {
          checksPassed++;
        }
      } else if (m.visibility === 'followers') {
        if (!isFollowing && res.status === 200) {
          leaks.push(`Followers-only moment ${m._id} of @${m.owner.username} was accessible to non-follower @${viewer.username}`);
        } else if (isFollowing && res.status !== 200) {
          leaks.push(`Followers-only moment ${m._id} was blocked for follower @${viewer.username} (status ${res.status})`);
        } else {
          checksPassed++;
        }
      } else if (m.visibility === 'public') {
        if (res.status !== 200) {
          leaks.push(`Public moment ${m._id} was blocked for @${viewer.username} (status ${res.status})`);
        } else {
          checksPassed++;
        }
      }
    }

    // Anonymous check on direct moment URL
    const anonRes = await anonClient.request(`/api/moments/${m._id}`);
    if (m.visibility !== 'public' && anonRes.status === 200) {
      leaks.push(`Non-public moment ${m._id} (${m.visibility}) was accessible to anonymous viewer`);
    } else {
      checksPassed++;
    }
  }
  console.log(`  ✓ Direct moment access checks passed (${checksPassed} checks)`);

  // 3. Audit Direct Media File URL Access
  console.log('\n3. Checking Media File Serving Access Control...');
  const privateMoments = allMoments.filter(m => m.visibility === 'private');
  for (const m of privateMoments) {
    const ownerId = m.owner._id.toString();
    for (const mediaId of m.media) {
      // If this media item is also used in a public or followers moment/album, it is not exclusively private
      const isPubliclyShared = await Moment.exists({ media: mediaId, visibility: { $ne: 'private' } }) ||
                               await Album.exists({ media: mediaId, visibility: { $ne: 'private' } });
      if (isPubliclyShared) {
        continue;
      }

      // Find a non-owner viewer
      const otherEntry = Array.from(userClients.entries()).find(([id]) => id !== ownerId);
      if (otherEntry) {
        const [_, { user: stranger, client: strangerClient }] = otherEntry;
        const fileRes = await strangerClient.request(`/api/media/${mediaId}/file?variant=display`);
        if (fileRes.status === 200) {
          leaks.push(`Private media file ${mediaId} was accessible to stranger @${stranger.username} (status 200)`);
        } else {
          checksPassed++;
        }
      }

      // Anonymous check
      const anonFileRes = await anonClient.request(`/api/media/${mediaId}/file?variant=display`);
      if (anonFileRes.status === 200) {
        leaks.push(`Private media file ${mediaId} was accessible anonymously`);
      } else {
        checksPassed++;
      }
    }
  }
  console.log(`  ✓ Private media file isolation passed`);

  // 4. Audit Album Visibility
  console.log('\n4. Checking Album Privacy & Share Link Access...');
  const allAlbums = await Album.find({}).populate('owner');

  for (const a of allAlbums) {
    if (!a.owner) continue;
    const ownerId = a.owner._id.toString();

    for (const [viewerId, { user: viewer, client: viewerClient }] of userClients.entries()) {
      if (viewerId === ownerId) continue;

      const isFollowing = viewer.following && viewer.following.some(f => f.toString() === ownerId);
      const res = await viewerClient.request(`/api/albums/${a._id}`);

      if (a.visibility === 'private') {
        if (res.status === 200) {
          leaks.push(`Private album ${a._id} of @${a.owner.username} was accessible to @${viewer.username}`);
        } else {
          checksPassed++;
        }
      } else if (a.visibility === 'followers') {
        if (!isFollowing && res.status === 200) {
          leaks.push(`Followers-only album ${a._id} was accessible to non-follower @${viewer.username}`);
        } else {
          checksPassed++;
        }
      }
    }

    // Anonymous check
    const anonRes = await anonClient.request(`/api/albums/${a._id}`);
    if (a.visibility !== 'public' && anonRes.status === 200) {
      leaks.push(`Non-public album ${a._id} (${a.visibility}) was accessible to anonymous viewer`);
    } else {
      checksPassed++;
    }

    // Shared album token test
    if (a.shareToken) {
      const sharedRes = await anonClient.request(`/api/albums/shared/${a.shareToken}`);
      if (sharedRes.status !== 200) {
        leaks.push(`Shared album with active token ${a.shareToken} failed to load anonymously (status ${sharedRes.status})`);
      } else {
        checksPassed++;
      }
    }
  }
  console.log(`  ✓ Album privacy & share token access passed`);

  await mongoose.disconnect();

  console.log('\n========================================================');
  if (leaks.length > 0) {
    console.error(`PRIVACY AUDIT FAILED WITH ${leaks.length} LEAKS:\n`);
    leaks.forEach((leak, idx) => console.error(`  ${idx + 1}. ${leak}`));
    console.log('========================================================\n');
    process.exit(1);
  }

  console.log(`PRIVACY AUDIT PASSED CLEANLY: ${checksPassed} ASSERTIONS VERIFIED, ZERO LEAKS DETECTED.`);
  console.log('========================================================\n');
  process.exit(0);
}

runPrivacyAudit().catch((err) => {
  console.error('Fatal error during privacy audit:', err);
  process.exit(1);
});
