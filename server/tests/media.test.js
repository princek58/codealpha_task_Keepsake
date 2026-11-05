const request = require('supertest');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const app = require('../app');
const config = require('../config');
const storage = require('../services/storage');
const mediaQueue = require('../services/media/queue');
const Media = require('../models/Media');
const User = require('../models/User');
const Moment = require('../models/Moment');
const Album = require('../models/Album');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const { connectTestDB, clearTestDB, closeTestDB } = require('./setup');
const { createTestUser, createTestMoment, createTestAlbum } = require('./testHelper');

jest.setTimeout(40000);

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_jwt_secret_bloomly_super_secure_key_12345';
  process.env.JWT_EXPIRES_IN = '7d';
  await connectTestDB();
});

afterEach(async () => {
  await clearTestDB();
  await storage.cleanTmp();
});

afterAll(async () => {
  await closeTestDB();
});

const generateTestVideoBuffer = () => {
  return new Promise((resolve, reject) => {
    const ffmpeg = require('ffmpeg-static');
    const { spawn } = require('child_process');
    const tmpPath = path.join(
      storage.getTmpDir(),
      `fixture_${Date.now()}_${Math.random().toString(36).substring(2)}.mp4`
    );
    const proc = spawn(ffmpeg, [
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=1:size=320x240:rate=30',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=1000:duration=1',
      '-c:v',
      'libx264',
      '-c:a',
      'aac',
      '-y',
      tmpPath
    ]);
    proc.on('close', async (code) => {
      if (code === 0) {
        try {
          const buf = await fs.promises.readFile(tmpPath);
          await fs.promises.unlink(tmpPath);
          resolve(buf);
        } catch (e) {
          reject(e);
        }
      } else {
        reject(new Error(`Failed to generate fixture video: exit ${code}`));
      }
    });
  });
};

describe('Media Pipeline & API', () => {
  test('Image upload processes variants, strips metadata, and auto-rotates', async () => {
    const { user, cookie } = await createTestUser();

    // Create 400x200 JPEG with orientation 6 (should rotate to 200x400)
    const imgBuf = await sharp({
      create: { width: 400, height: 200, channels: 3, background: { r: 255, g: 100, b: 50 } }
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const uploadRes = await request(app)
      .post('/api/media')
      .set('Cookie', cookie)
      .attach('files', imgBuf, 'rotated_test.jpg');

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.items).toHaveLength(1);
    expect(uploadRes.body.errors).toHaveLength(0);

    const media = uploadRes.body.items[0];
    expect(media.status).toBe('ready');
    expect(media.type).toBe('image');
    expect(media.width).toBe(200);
    expect(media.height).toBe(400);
    expect(media.blurDataUrl).toMatch(/^data:image\/webp;base64,/);
    expect(media.urls.thumb).toBeDefined();
    expect(media.urls.display).toBeDefined();
    expect(media.urls.original).toBeDefined();

    // Verify stored files on disk
    const mediaDoc = await Media.findById(media.id);
    expect(await storage.exists(mediaDoc.paths.original)).toBe(true);
    expect(await storage.exists(mediaDoc.paths.display)).toBe(true);
    expect(await storage.exists(mediaDoc.paths.thumb)).toBe(true);

    // Verify metadata stripped in display and thumb
    const displayAbs = storage.resolveSafePath(mediaDoc.paths.display);
    const displayMeta = await sharp(displayAbs).metadata();
    expect(displayMeta.exif).toBeUndefined();

    const thumbAbs = storage.resolveSafePath(mediaDoc.paths.thumb);
    const thumbMeta = await sharp(thumbAbs).metadata();
    expect(thumbMeta.exif).toBeUndefined();

    // Verify storage used quota increased
    const updatedUser = await User.findById(user.id);
    expect(updatedUser.storageUsedBytes).toBe(mediaDoc.sizeBytes);
  });

  test('Video upload queues, transcodes to 720p H.264, creates poster, and handles Range requests', async () => {
    const { user, cookie } = await createTestUser();
    const videoBuf = await generateTestVideoBuffer();

    const uploadRes = await request(app)
      .post('/api/media')
      .set('Cookie', cookie)
      .attach('files', videoBuf, 'clip.mp4');

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.items).toHaveLength(1);

    const initialMedia = uploadRes.body.items[0];
    expect(initialMedia.status).toBe('processing');

    // Await queue idle
    await mediaQueue.waitForQueueIdle();

    const readyDoc = await Media.findById(initialMedia.id);
    expect(readyDoc.status).toBe('ready');
    expect(readyDoc.durationSec).toBe(1);
    expect(readyDoc.paths.video).toBeDefined();
    expect(readyDoc.paths.poster).toBeDefined();
    expect(readyDoc.blurDataUrl).toMatch(/^data:image\/webp;base64,/);

    // Verify video streams with ffprobe (H.264/AAC, <= 720p)
    const ffprobe = require('ffprobe-static');
    const { spawn } = require('child_process');
    const videoAbs = storage.resolveSafePath(readyDoc.paths.video);
    const probeOutput = await new Promise((resolve, reject) => {
      const proc = spawn(ffprobe.path, [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_streams',
        videoAbs
      ]);
      let out = '';
      proc.stdout.on('data', (d) => {
        out += d;
      });
      proc.on('close', (code) => {
        if (code === 0) resolve(JSON.parse(out));
        else reject(new Error('ffprobe failed'));
      });
    });

    const vStream = probeOutput.streams.find((s) => s.codec_type === 'video');
    const aStream = probeOutput.streams.find((s) => s.codec_type === 'audio');
    expect(vStream).toBeDefined();
    expect(vStream.codec_name).toBe('h264');
    expect(vStream.width).toBeLessThanOrEqual(720);
    expect(vStream.height).toBeLessThanOrEqual(720);
    expect(aStream).toBeDefined();
    expect(aStream.codec_name).toBe('aac');

    // Test streaming video with Range request
    const rangeRes = await request(app)
      .get(`/api/media/${readyDoc._id}/file?variant=video`)
      .set('Cookie', cookie)
      .set('Range', 'bytes=0-100');

    expect(rangeRes.status).toBe(206);
    expect(rangeRes.headers['content-range']).toMatch(/^bytes 0-100\/\d+$/);
    expect(rangeRes.headers['accept-ranges']).toBe('bytes');
    expect(rangeRes.headers['content-type']).toBe('video/mp4');

    // Test fetching poster
    const posterRes = await request(app)
      .get(`/api/media/${readyDoc._id}/file?variant=poster`)
      .set('Cookie', cookie);

    expect(posterRes.status).toBe(200);
    expect(posterRes.headers['content-type']).toBe('image/jpeg');
  });

  test('Rejects spoofed file types, HEIC with friendly code, and processes valid files in batch independently', async () => {
    const { cookie } = await createTestUser();

    const validImg = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 10, g: 20, b: 30 } }
    })
      .png()
      .toBuffer();

    const fakeExe = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00fake');
    const fakeHeic = Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0]);

    const res = await request(app)
      .post('/api/media')
      .set('Cookie', cookie)
      .attach('files', validImg, 'good.png')
      .attach('files', fakeExe, 'trojan.png')
      .attach('files', fakeHeic, 'photo.heic');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].status).toBe('ready');

    expect(res.body.errors).toHaveLength(2);
    const exeErr = res.body.errors.find((e) => e.originalName === 'trojan.png');
    expect(exeErr.code).toBe('UNSUPPORTED_FILE_TYPE');

    const heicErr = res.body.errors.find((e) => e.originalName === 'photo.heic');
    expect(heicErr.code).toBe('UNSUPPORTED_HEIC');
    expect(heicErr.message).toMatch(/HEIC/i);
  });

  test('Enforces storage quota and refunds quota on delete', async () => {
    const { user, cookie } = await createTestUser();

    // Temporarily reduce quota to 100 bytes for test
    const origQuota = config.userQuotaMb;
    config.userQuotaMb = 0.0001; // ~104 bytes

    const imgBuf = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 50, g: 50, b: 50 } }
    })
      .jpeg()
      .toBuffer();

    const res = await request(app)
      .post('/api/media')
      .set('Cookie', cookie)
      .attach('files', imgBuf, 'large.jpg');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0].code).toBe('QUOTA_EXCEEDED');

    // Restore quota
    config.userQuotaMb = origQuota;

    // Normal upload
    const okRes = await request(app)
      .post('/api/media')
      .set('Cookie', cookie)
      .attach('files', imgBuf, 'normal.jpg');

    expect(okRes.status).toBe(200);
    expect(okRes.body.items).toHaveLength(1);

    const mediaId = okRes.body.items[0].id;
    const userWithMedia = await User.findById(user.id);
    expect(userWithMedia.storageUsedBytes).toBeGreaterThan(0);

    // Delete media
    const delRes = await request(app)
      .delete(`/api/media/${mediaId}`)
      .set('Cookie', cookie);

    expect(delRes.status).toBe(200);
    expect(delRes.body.deletedCount).toBe(1);

    const userAfterDel = await User.findById(user.id);
    expect(userAfterDel.storageUsedBytes).toBe(0);
  });

  test('Access control: stranger cannot fetch private media, original variant is owner-only', async () => {
    const owner = await createTestUser({ username: 'owner_media' });
    const stranger = await createTestUser({ username: 'stranger_media' });

    const imgBuf = await sharp({
      create: { width: 60, height: 60, channels: 3, background: { r: 100, g: 100, b: 100 } }
    })
      .png()
      .toBuffer();

    const uploadRes = await request(app)
      .post('/api/media')
      .set('Cookie', owner.cookie)
      .attach('files', imgBuf, 'photo.png');

    const mediaId = uploadRes.body.items[0].id;

    // Owner can fetch display and original
    const ownerDisp = await request(app)
      .get(`/api/media/${mediaId}/file?variant=display`)
      .set('Cookie', owner.cookie);
    expect(ownerDisp.status).toBe(200);

    const ownerOrig = await request(app)
      .get(`/api/media/${mediaId}/file?variant=original`)
      .set('Cookie', owner.cookie);
    expect(ownerOrig.status).toBe(200);

    // Stranger fetching original gets 404
    const strangerOrig = await request(app)
      .get(`/api/media/${mediaId}/file?variant=original`)
      .set('Cookie', stranger.cookie);
    expect(strangerOrig.status).toBe(404);

    // Stranger fetching unshared private media gets 404
    const strangerDisp = await request(app)
      .get(`/api/media/${mediaId}/file?variant=display`)
      .set('Cookie', stranger.cookie);
    expect(strangerDisp.status).toBe(404);
  });

  test('Deleting media cascades: removes from moments and albums, deletes moment if zero media left', async () => {
    const { user, cookie } = await createTestUser();

    const imgBuf = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 10, g: 10, b: 10 } }
    })
      .png()
      .toBuffer();

    const uploadRes = await request(app)
      .post('/api/media')
      .set('Cookie', cookie)
      .attach('files', imgBuf, 'pic.png');

    const mediaId = uploadRes.body.items[0].id;

    // Create a Moment containing only this media
    const moment = await createTestMoment(user.id, [mediaId]);
    const momentId = moment._id.toString();

    // Create an Album containing this media as cover
    const album = await createTestAlbum(user.id, [mediaId]);
    const albumId = album._id.toString();

    // Delete the media
    const delRes = await request(app)
      .delete(`/api/media/${mediaId}`)
      .set('Cookie', cookie);

    expect(delRes.status).toBe(200);

    // Moment should be cascade deleted
    const checkMoment = await Moment.findById(momentId);
    expect(checkMoment).toBeNull();

    // Album should have media removed and cover set to null
    const checkAlbum = await Album.findById(albumId);
    expect(checkAlbum.media).toHaveLength(0);
    expect(checkAlbum.cover).toBeNull();
  });

  test('GET /api/users/me/storage returns accurate usage and counts', async () => {
    const { user, cookie } = await createTestUser();

    const storageRes = await request(app)
      .get('/api/users/me/storage')
      .set('Cookie', cookie);

    expect(storageRes.status).toBe(200);
    expect(storageRes.body.quotaBytes).toBe(config.userQuotaBytes);
    expect(typeof storageRes.body.usedBytes).toBe('number');
    expect(typeof storageRes.body.percent).toBe('number');
    expect(storageRes.body.counts).toEqual({ images: 0, videos: 0 });
  });

  test('GET /api/media/limits returns configured limits and allowed mimes', async () => {
    const res = await request(app).get('/api/media/limits');

    expect(res.status).toBe(200);
    expect(res.body.maxImageBytes).toBe(config.maxImageBytes);
    expect(res.body.maxVideoBytes).toBe(config.maxVideoBytes);
    expect(res.body.maxVideoSeconds).toBe(config.maxVideoSeconds);
    expect(res.body.maxFilesPerRequest).toBe(config.maxFilesPerRequest);
    expect(res.body.maxItemsPerMoment).toBe(config.maxItemsPerMoment);
    expect(res.body.maxItemsPerAlbum).toBe(config.maxItemsPerAlbum);
    expect(res.body.userQuotaBytes).toBe(config.userQuotaBytes);
    expect(Array.isArray(res.body.allowedImageMimes)).toBe(true);
    expect(Array.isArray(res.body.allowedVideoMimes)).toBe(true);
  });

  test('Rejects upload with more than MAX_FILES_PER_REQUEST files', async () => {
    const { cookie } = await createTestUser();
    const imgBuf = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 0, b: 0 } }
    })
      .png()
      .toBuffer();

    const req = request(app).post('/api/media').set('Cookie', cookie);
    for (let i = 0; i < (config.maxFilesPerRequest || 10) + 1; i++) {
      req.attach('files', imgBuf, `file_${i}.png`);
    }

    const res = await req;
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Cannot upload more than/i);
  });
});
