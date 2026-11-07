// Keepsake Render Readiness, Config, and Services Integration Tests
const request = require('supertest');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const config = require('../config');
const User = require('../models/User');
const Media = require('../models/Media');
const Moment = require('../models/Moment');
const Album = require('../models/Album');
const { restoreDemoBundle } = require('../services/demoBundle');
const { reconcileStorage } = require('../services/reconcileStorage');

let mongoServer;
let testStorageDir;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  testStorageDir = path.resolve(__dirname, '../../tmp/test-render-storage');
  if (fs.existsSync(testStorageDir)) {
    fs.rmSync(testStorageDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testStorageDir, { recursive: true });
  config.storageDir = testStorageDir;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  if (fs.existsSync(testStorageDir)) {
    fs.rmSync(testStorageDir, { recursive: true, force: true });
  }
});

describe('Render Platform Integration & Config Verification', () => {
  test('GET /api/health returns valid status, uptime, database state and demo readiness', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('uptime');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.database).toBe('connected');
    expect(res.body).toHaveProperty('demoReady');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body.password).toBeUndefined();
    expect(res.body.jwtSecret).toBeUndefined();
  });

  test('GET /api/config returns demoMode and configured limits without secrets', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('demoMode');
    expect(res.body).toHaveProperty('limits');
    expect(typeof res.body.limits.maxImageMb).toBe('number');
    expect(typeof res.body.limits.maxVideoMb).toBe('number');
    expect(typeof res.body.limits.maxVideoSeconds).toBe('number');
    expect(typeof res.body.limits.userQuotaMb).toBe('number');
    expect(res.body.jwtSecret).toBeUndefined();
    expect(res.body.mongodbUri).toBeUndefined();
  });

  test('CSRF middleware allows requests from configured allowed origins', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', config.publicUrl)
      .send({ email: 'nonexistent@example.com', password: 'Password123' });

    // Expect 401 (invalid credentials), NOT 403 (CSRF blocked)
    expect(res.status).toBe(401);
  });

  test('CSRF middleware blocks state-changing requests from unlisted external origins', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://malicious-attacker-site.com')
      .send({ email: 'clara@example.com', password: 'Password123' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/rejected|invalid/i);
  });

  test('Trust proxy honours X-Forwarded-Proto header for secure protocol detection', async () => {
    // When trust proxy is active, req.secure is true when X-Forwarded-Proto is https
    const testApp = require('express')();
    testApp.set('trust proxy', 1);
    testApp.get('/test-proxy', (req, res) => {
      res.json({ secure: req.secure, protocol: req.protocol, ip: req.ip });
    });

    const res = await request(testApp)
      .get('/test-proxy')
      .set('X-Forwarded-Proto', 'https')
      .set('X-Forwarded-For', '203.0.113.195');

    expect(res.body.secure).toBe(true);
    expect(res.body.protocol).toBe('https');
    expect(res.body.ip).toBe('203.0.113.195');
  });
});

describe('Demo Bundle Restore Service', () => {
  test('Refuses to restore in production mode when DEMO_MODE is false', async () => {
    const origEnv = config.env;
    const origProd = config.isProduction;
    const origDemo = config.demoMode;

    config.env = 'production';
    config.isProduction = true;
    config.demoMode = false;

    await expect(restoreDemoBundle({ force: false })).rejects.toThrow(/DEMO_MODE must be true/);

    config.env = origEnv;
    config.isProduction = origProd;
    config.demoMode = origDemo;
  });

  test('Restores demo bundle idempotently with deterministic records and On-This-Day dates', async () => {
    config.demoMode = true;
    const result1 = await restoreDemoBundle({ force: true });
    expect(result1.restored).toBe(true);
    expect(result1.users).toBe(8);
    expect(result1.moments).toBe(28);
    expect(result1.albums).toBe(10);

    // Verify On-This-Day moments have today's month and day
    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentDay = now.getUTCDate();

    const onThisDay = await Moment.find({
      $expr: {
        $and: [
          { $eq: [{ $month: '$takenOn' }, currentMonth] },
          { $eq: [{ $dayOfMonth: '$takenOn' }, currentDay] }
        ]
      }
    });
    expect(onThisDay.length).toBeGreaterThanOrEqual(3);

    // Idempotent: second run does not duplicate records
    const result2 = await restoreDemoBundle({ force: true });
    expect(result2.restored).toBe(true);
    const userCount = await User.countDocuments();
    const momentCount = await Moment.countDocuments();
    expect(userCount).toBe(8);
    expect(momentCount).toBe(28);
  });
});

describe('Storage Reconciliation Service', () => {
  test('Purges orphan media records whose files are missing from disk and cascades to moments', async () => {
    // Create a dummy user
    const dummyUser = await User.create({
      username: 'orphan_test_user',
      email: 'orphan@example.com',
      passwordHash: 'hash',
      storageUsedBytes: 50000
    });

    // Create a media record pointing to non-existent file
    const ghostMedia = await Media.create({
      owner: dummyUser._id,
      type: 'image',
      status: 'ready',
      originalName: 'ghost.jpg',
      mime: 'image/jpeg',
      sizeBytes: 50000,
      width: 800,
      height: 600,
      paths: {
        original: 'ghost_user/ghost_media/original.jpg',
        display: 'ghost_user/ghost_media/display.webp',
        thumb: 'ghost_user/ghost_media/thumb.webp'
      }
    });

    // Create a moment containing only this ghost media
    const ghostMoment = await Moment.create({
      owner: dummyUser._id,
      title: 'Moment with ghost file',
      media: [ghostMedia._id],
      visibility: 'public'
    });

    // Run reconciliation
    const reconResult = await reconcileStorage();
    expect(reconResult.purgedMedia).toBeGreaterThanOrEqual(1);

    // Verify media was purged
    const foundMedia = await Media.findById(ghostMedia._id);
    expect(foundMedia).toBeNull();

    // Verify empty moment was deleted
    const foundMoment = await Moment.findById(ghostMoment._id);
    expect(foundMoment).toBeNull();

    // Verify user storage was adjusted downward
    const updatedUser = await User.findById(dummyUser._id);
    expect(updatedUser.storageUsedBytes).toBe(0);
  });

  test('Creates storage directory cleanly if missing without deleting records silently', async () => {
    const nonExistentDir = path.resolve(__dirname, '../../tmp/missing-test-dir');
    if (fs.existsSync(nonExistentDir)) fs.rmSync(nonExistentDir, { recursive: true, force: true });

    const origStorage = config.storageDir;
    config.storageDir = nonExistentDir;

    const res = await reconcileStorage();
    expect(res.purgedMedia).toBe(0);
    expect(fs.existsSync(nonExistentDir)).toBe(true);

    config.storageDir = origStorage;
    fs.rmSync(nonExistentDir, { recursive: true, force: true });
  });
});

