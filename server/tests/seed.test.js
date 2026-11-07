// Keepsake Seed Integrity and Data Verification Test Suite
const { connectTestDB, clearTestDB, closeTestDB } = require('./setup');
const { runSeed } = require('../../scripts/seed');
const User = require('../models/User');
const Media = require('../models/Media');
const Moment = require('../models/Moment');
const Album = require('../models/Album');

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.SEED_TEST_SMALL = 'true';
  process.env.JWT_SECRET = 'test_jwt_secret_keepsake_secure_key_12345';
  process.env.JWT_EXPIRES_IN = '7d';
  await connectTestDB();
  await clearTestDB();
  await runSeed({ keepConnection: true });
}, 60000);

afterAll(async () => {
  await clearTestDB();
  await closeTestDB();
});

describe('Seeded Database Integrity & Architecture Audit', () => {
  test('Exactly 8 users exist with non-empty avatars', async () => {
    const users = await User.find({});
    expect(users.length).toBe(8);

    users.forEach((u) => {
      expect(typeof u.username).toBe('string');
      expect(u.username.length).toBeGreaterThan(0);
      expect(typeof u.avatarPath).toBe('string');
      expect(u.avatarPath.length).toBeGreaterThan(0);
      expect(u.avatarPath.startsWith('avatars/')).toBe(true);
    });
  });

  test('Exactly 28 moments exist with required layout distributions', async () => {
    const moments = await Moment.find({});
    expect(moments.length).toBe(28);

    const collageMoments = moments.filter((m) => m.layout?.type === 'collage');
    const gridMoments = moments.filter((m) => m.layout?.type === 'grid');
    const carouselMoments = moments.filter((m) => m.layout?.type === 'carousel');

    expect(collageMoments.length).toBeGreaterThanOrEqual(5);
    expect(gridMoments.length).toBeGreaterThanOrEqual(5);
    expect(carouselMoments.length).toBeGreaterThanOrEqual(3);
  });

  test('Exactly 10 albums exist, including at least one with an active shareToken', async () => {
    const albums = await Album.find({});
    expect(albums.length).toBe(10);

    const sharedAlbums = albums.filter((a) => a.shareToken && a.shareToken.length > 0);
    expect(sharedAlbums.length).toBeGreaterThanOrEqual(1);
    expect(sharedAlbums.some((a) => a.shareToken === 'c8f16d46ca25ab19b0161b12')).toBe(true);
  });

  test('All Media records have status ready and non-empty blurDataUrl', async () => {
    const mediaList = await Media.find({});
    const minCount = process.env.SEED_TEST_SMALL === 'true' ? 6 : 70;
    expect(mediaList.length).toBeGreaterThanOrEqual(minCount);

    mediaList.forEach((m) => {
      expect(m.status).toBe('ready');
      expect(typeof m.blurDataUrl).toBe('string');
      expect(m.blurDataUrl.startsWith('data:image/')).toBe(true);
      expect(m.sizeBytes).toBeGreaterThan(0);
    });
  });

  test('The "On this day" query for today matches at least 3 moments from 3 different users', async () => {
    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentDay = now.getUTCDate();
    const currentYear = now.getUTCFullYear();

    const onThisDayMoments = await Moment.find({
      $expr: {
        $and: [
          { $eq: [{ $month: '$takenOn' }, currentMonth] },
          { $eq: [{ $dayOfMonth: '$takenOn' }, currentDay] },
          { $lt: [{ $year: '$takenOn' }, currentYear] }
        ]
      }
    });

    expect(onThisDayMoments.length).toBeGreaterThanOrEqual(3);

    const distinctUsers = new Set(onThisDayMoments.map((m) => m.owner.toString()));
    expect(distinctUsers.size).toBeGreaterThanOrEqual(3);
  });

  test('No media record has placeholder or old bloom/plant text', async () => {
    const mediaList = await Media.find({});
    const forbiddenPatterns = [
      /\bbloom\b/i,
      /\bbloomly\b/i,
      /\bplant\b/i,
      /\bdummy\b/i,
      /\bplaceholder\b/i,
      /\blorem\b/i
    ];

    mediaList.forEach((m) => {
      const textToScan = `${m.caption || ''} ${m.place || ''} ${m.originalName || ''}`;
      forbiddenPatterns.forEach((pattern) => {
        expect(pattern.test(textToScan)).toBe(false);
      });
    });
  });
});

