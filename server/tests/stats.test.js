const request = require('supertest');
const app = require('../app');
const statsRouter = require('../routes/stats');
const { createTestUser, createTestMedia, createTestMoment } = require('./testHelper');
const { connectTestDB, clearTestDB, closeTestDB } = require('./setup');

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await connectTestDB();
});

beforeEach(() => {
  statsRouter.resetStatsCache();
});

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await closeTestDB();
});

describe('GET /api/stats', () => {
  it('should return 200 with real user and moment counts', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(typeof res.body.users).toBe('number');
    expect(typeof res.body.moments).toBe('number');
  });

  it('should reflect user and public moment documents created', async () => {
    const { user } = await createTestUser();
    const media = await createTestMedia(user.id);
    await createTestMoment(user.id, [media._id], { visibility: 'public' });

    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.users).toBeGreaterThanOrEqual(1);
    expect(res.body.moments).toBeGreaterThanOrEqual(1);
  });

  it('should not count private moments in public stats', async () => {
    const { user } = await createTestUser();
    const media = await createTestMedia(user.id);
    await createTestMoment(user.id, [media._id], { visibility: 'private' });

    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.moments).toBe(0);
  });

  it('should return cached response on subsequent call', async () => {
    const res1 = await request(app).get('/api/stats');
    expect(res1.status).toBe(200);

    const { user } = await createTestUser();
    // Cache should still return previous value
    const res2 = await request(app).get('/api/stats');
    expect(res2.body.users).toBe(res1.body.users);
  });
});
