const request = require('supertest');
const app = require('../app');
const { createTestUser, createTestMedia } = require('./testHelper');
const { connectTestDB, clearTestDB, closeTestDB } = require('./setup');

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await connectTestDB();
});

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await closeTestDB();
});

describe('Security & Robustness', () => {
  it('should include Content-Security-Policy header in responses', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers).toHaveProperty('content-security-policy');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
  });

  it('should reject state-changing requests with foreign Origin', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost:5000')
      .set('Origin', 'http://malicious-attacker-domain.com')
      .send({ email: 'test@example.com', password: 'Password123' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/rejected|cross-origin/i);
  });

  it('should allow state-changing requests with same or local origin', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost:5000')
      .set('Origin', 'http://localhost:5000')
      .send({ email: 'test@example.com', password: 'Password123' });

    // It should proceed past the CSRF check (will hit invalid credentials 401, not 403)
    expect(res.status).toBe(401);
  });

  it('should reject invalid upload mime types', async () => {
    const { cookie } = await createTestUser();
    const res = await request(app)
      .post('/api/media')
      .set('Cookie', cookie)
      .attach('files', Buffer.from('malicious script code'), 'evil.exe');

    expect(res.status).toBe(200);
    expect(res.body.errors.length).toBeGreaterThanOrEqual(1);
    expect(res.body.errors[0].code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('should store and return XSS payloads as plain text without sanitization loss or execution', async () => {
    const xssPayload = "<script>alert('xss')</script><img src=x onerror=alert(1)>";
    const { user, cookie } = await createTestUser({ bio: xssPayload });

    expect(user.bio).toBe(xssPayload);

    const media = await createTestMedia(user.id);
    const momentRes = await request(app)
      .post('/api/moments')
      .set('Cookie', cookie)
      .send({ media: [media._id.toString()], caption: xssPayload });

    expect(momentRes.status).toBe(201);
    expect(momentRes.body.moment.caption).toBe(xssPayload);
  });
});
