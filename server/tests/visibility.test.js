const request = require('supertest');
const app = require('../app');
const { connectTestDB, clearTestDB, closeTestDB } = require('./setup');
const {
  createTestUser,
  createTestMedia,
  createTestMoment,
  createTestAlbum
} = require('./testHelper');

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_jwt_secret_bloomly_super_secure_key_12345';
  process.env.JWT_EXPIRES_IN = '7d';
  await connectTestDB();
});

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await closeTestDB();
});

describe('Visibility Matrix Test', () => {
  const visibilities = ['public', 'followers', 'private'];

  // Expected status codes:
  // Viewer | public | followers | private
  // owner  |  200   |    200    |   200
  // follow |  200   |    200    |   404
  // strang |  200   |    404    |   404
  // anon   |  404   |    404    |   404
  const expectedMatrix = {
    owner: { public: 200, followers: 200, private: 200 },
    follower: { public: 200, followers: 200, private: 404 },
    stranger: { public: 200, followers: 404, private: 404 },
    anonymous: { public: 404, followers: 404, private: 404 }
  };

  test('Table-driven access matrix for Moments, Albums, and Media', async () => {
    // 1. Create users
    const alice = await createTestUser({ username: 'matrix_alice' });
    const bob = await createTestUser({ username: 'matrix_bob' });
    const charlie = await createTestUser({ username: 'matrix_charlie' });

    // Bob follows Alice; Charlie does not
    await request(app)
      .post(`/api/users/${alice.user.id}/follow`)
      .set('Cookie', bob.cookie);

    const viewers = {
      owner: alice.cookie,
      follower: bob.cookie,
      stranger: charlie.cookie,
      anonymous: null
    };

    for (const vis of visibilities) {
      // Create Media, Moment, and Album for this visibility
      const media = await createTestMedia(alice.user.id);
      const moment = await createTestMoment(alice.user.id, [media._id], {
        title: `Moment ${vis}`,
        visibility: vis
      });
      const album = await createTestAlbum(alice.user.id, [media._id], {
        title: `Album ${vis}`,
        visibility: vis
      });

      for (const [role, cookie] of Object.entries(viewers)) {
        const expectedStatus = expectedMatrix[role][vis];

        // 1. Test Moment endpoint
        const momentReq = request(app).get(`/api/moments/${moment._id}`);
        if (cookie) momentReq.set('Cookie', cookie);
        const momentRes = await momentReq;
        expect(momentRes.status).toBe(expectedStatus);

        // 2. Test Album endpoint
        const albumReq = request(app).get(`/api/albums/${album._id}`);
        if (cookie) albumReq.set('Cookie', cookie);
        const albumRes = await albumReq;
        expect(albumRes.status).toBe(expectedStatus);

        // 3. Test Media endpoint
        const mediaReq = request(app).get(`/api/media/${media._id}/file?variant=display`);
        if (cookie) mediaReq.set('Cookie', cookie);
        const mediaRes = await mediaReq;
        expect(mediaRes.status).toBe(expectedStatus);
      }
    }
  });

  test('Anonymous viewer can access private album and media using valid share token', async () => {
    const owner = await createTestUser();
    const media = await createTestMedia(owner.user.id);
    const album = await createTestAlbum(owner.user.id, [media._id], {
      visibility: 'private',
      shareToken: 'testtoken1234567890abcdef1234567890abcdef1234567890abcdef12345678'
    });

    const token = album.shareToken;

    // Without token: 404
    const anonNoToken = await request(app).get(`/api/albums/${album._id}`);
    expect(anonNoToken.status).toBe(404);

    const fileNoToken = await request(app).get(`/api/media/${media._id}/file?variant=display`);
    expect(fileNoToken.status).toBe(404);

    // With token on shared album endpoint: 200
    const anonWithToken = await request(app).get(`/api/albums/shared/${token}`);
    expect(anonWithToken.status).toBe(200);

    // With token on media file endpoint: 200
    const fileWithToken = await request(app).get(
      `/api/media/${media._id}/file?variant=display&token=${token}`
    );
    expect(fileWithToken.status).toBe(200);
  });
});

