const request = require('supertest');
const app = require('../app');
const Album = require('../models/Album');
const Media = require('../models/Media');
const { connectTestDB, clearTestDB, closeTestDB } = require('./setup');
const { createTestUser, createTestMedia, createTestAlbum } = require('./testHelper');

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

describe('Albums API', () => {
  test('Creates album, manages media, checks permutation on reorder, and cover assignment', async () => {
    const { user, cookie } = await createTestUser();

    const m1 = await createTestMedia(user.id);
    const m2 = await createTestMedia(user.id);
    const m3 = await createTestMedia(user.id);

    // 1. Create album with m1 and m2
    const createRes = await request(app)
      .post('/api/albums')
      .set('Cookie', cookie)
      .send({
        title: 'Summer Vacation',
        description: 'Trip photos',
        visibility: 'private',
        media: [m1._id.toString(), m2._id.toString()]
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.album.title).toBe('Summer Vacation');
    expect(createRes.body.album.cover.id).toBe(m1._id.toString());
    expect(createRes.body.album.mediaCount).toBe(2);

    const albumId = createRes.body.album.id;

    // 2. Add m3 to album
    const addRes = await request(app)
      .post(`/api/albums/${albumId}/media`)
      .set('Cookie', cookie)
      .send({ ids: [m3._id.toString()] });

    expect(addRes.status).toBe(200);
    expect(addRes.body.album.mediaCount).toBe(3);

    // 3. Reorder: valid permutation [m3, m1, m2]
    const reorderRes = await request(app)
      .put(`/api/albums/${albumId}/order`)
      .set('Cookie', cookie)
      .send({
        ids: [m3._id.toString(), m1._id.toString(), m2._id.toString()]
      });

    expect(reorderRes.status).toBe(200);

    const updatedAlbum = await Album.findById(albumId);
    expect(updatedAlbum.media.map((id) => id.toString())).toEqual([
      m3._id.toString(),
      m1._id.toString(),
      m2._id.toString()
    ]);

    // 4. Reorder: invalid permutation (missing item or duplicate)
    const badReorderRes = await request(app)
      .put(`/api/albums/${albumId}/order`)
      .set('Cookie', cookie)
      .send({
        ids: [m3._id.toString(), m3._id.toString(), m2._id.toString()]
      });

    expect(badReorderRes.status).toBe(400);

    // 5. Remove cover item m1 (currently m1 is cover or let's set cover to m3)
    await request(app)
      .patch(`/api/albums/${albumId}`)
      .set('Cookie', cookie)
      .send({ cover: m3._id.toString() });

    const removeCoverRes = await request(app)
      .delete(`/api/albums/${albumId}/media/${m3._id}`)
      .set('Cookie', cookie);

    expect(removeCoverRes.status).toBe(200);
    // Cover should be reassigned to the next item (m1)
    expect(removeCoverRes.body.album.cover.id).toBe(m1._id.toString());
  });

  test('Share token lifecycle: generate token, anonymous view, and revocation', async () => {
    const { user, cookie } = await createTestUser();
    const media = await createTestMedia(user.id);

    const album = await createTestAlbum(user.id, [media._id], {
      title: 'Secret Shared Album',
      visibility: 'private'
    });
    const albumId = album._id.toString();

    // Generate share token
    const shareRes = await request(app)
      .post(`/api/albums/${albumId}/share`)
      .set('Cookie', cookie);

    expect(shareRes.status).toBe(200);
    expect(shareRes.body.shareToken).toHaveLength(64);
    const token = shareRes.body.shareToken;

    // Anonymous view via shared link
    const anonRes = await request(app).get(`/api/albums/shared/${token}`);
    expect(anonRes.status).toBe(200);
    expect(anonRes.body.album.title).toBe('Secret Shared Album');
    expect(anonRes.body.media).toHaveLength(1);
    expect(anonRes.body.media[0].urls.display).toContain(`token=${token}`);

    // Anonymous fetch media using the token
    const fileRes = await request(app).get(
      `/api/media/${media._id}/file?variant=display&token=${token}`
    );
    expect(fileRes.status).toBe(200);

    // Revoke share token
    const revokeRes = await request(app)
      .delete(`/api/albums/${albumId}/share`)
      .set('Cookie', cookie);

    expect(revokeRes.status).toBe(200);

    // Subsequent access with revoked token returns 404
    const deadRes = await request(app).get(`/api/albums/shared/${token}`);
    expect(deadRes.status).toBe(404);

    const deadFileRes = await request(app).get(
      `/api/media/${media._id}/file?variant=display&token=${token}`
    );
    expect(deadFileRes.status).toBe(404);
  });

  test('Deleting album leaves media items in library', async () => {
    const { user, cookie } = await createTestUser();
    const media = await createTestMedia(user.id);

    const album = await createTestAlbum(user.id, [media._id]);
    const albumId = album._id.toString();

    const delRes = await request(app)
      .delete(`/api/albums/${albumId}`)
      .set('Cookie', cookie);

    expect(delRes.status).toBe(200);

    const checkAlbum = await Album.findById(albumId);
    expect(checkAlbum).toBeNull();

    const checkMedia = await Media.findById(media._id);
    expect(checkMedia).not.toBeNull();
  });
});

