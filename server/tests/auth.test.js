const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const { loginLimiter, registerLimiter } = require('../routes/auth');
const { connectTestDB, clearTestDB, closeTestDB } = require('./setup');

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_jwt_secret_bloomly_super_secure_key_12345';
  process.env.JWT_EXPIRES_IN = '7d';
  await connectTestDB();
});

beforeEach(async () => {
  loginLimiter.resetKey('::ffff:127.0.0.1');
  loginLimiter.resetKey('127.0.0.1');
  registerLimiter.resetKey('::ffff:127.0.0.1');
  registerLimiter.resetKey('127.0.0.1');
});

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await closeTestDB();
});

describe('System and Scaffolding Endpoints', () => {
  test('GET /api/health returns status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('Unknown /api route returns 404 JSON', async () => {
    const res = await request(app).get('/api/unknown-route');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message', 'API route not found');
  });

  test('Protected routes reject unauthenticated requests with 401', async () => {
    const postsRes = await request(app).get('/api/posts/feed');
    expect(postsRes.status).toBe(401);

    const notificationsRes = await request(app).get('/api/notifications');
    expect(notificationsRes.status).toBe(401);
  });
});

describe('POST /api/auth/register', () => {
  const validUser = {
    username: 'daisy_gardener',
    email: 'daisy@example.com',
    password: 'Password123',
    displayName: 'Daisy',
    bio: 'Gardening little blooms every day'
  };

  test('Registers a new user successfully and sets httpOnly cookie', async () => {
    const res = await request(app).post('/api/auth/register').send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Registration successful');
    expect(res.body.user).toBeDefined();
    expect(res.body.user.username).toBe(validUser.username);
    expect(res.body.user.email).toBe(validUser.email);
    expect(res.body.user.displayName).toBe(validUser.displayName);
    expect(res.body.user.bio).toBe(validUser.bio);
    expect(res.body.user.passwordHash).toBeUndefined();

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/token=/);
    expect(cookies[0]).toMatch(/HttpOnly/i);
    expect(cookies[0]).toMatch(/SameSite=Lax/i);
  });

  test('Rejects duplicate email with 409 and field-level error', async () => {
    await request(app).post('/api/auth/register').send(validUser);

    const duplicateRes = await request(app).post('/api/auth/register').send({
      ...validUser,
      username: 'another_user'
    });

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.errors).toHaveProperty('email');
    expect(duplicateRes.body.errors.email).toMatch(/already in use/i);
  });

  test('Rejects duplicate username with 409 and field-level error', async () => {
    await request(app).post('/api/auth/register').send(validUser);

    const duplicateRes = await request(app).post('/api/auth/register').send({
      ...validUser,
      email: 'another@example.com'
    });

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.errors).toHaveProperty('username');
    expect(duplicateRes.body.errors.username).toMatch(/already in use/i);
  });

  test('Rejects weak password with 400 and field-level error', async () => {
    const shortPassword = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, password: 'p1' });
    expect(shortPassword.status).toBe(400);
    expect(shortPassword.body.errors).toHaveProperty('password');

    const noNumber = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, password: 'passwordonly' });
    expect(noNumber.status).toBe(400);
    expect(noNumber.body.errors).toHaveProperty('password');

    const noLetter = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, password: '12345678' });
    expect(noLetter.status).toBe(400);
    expect(noLetter.body.errors).toHaveProperty('password');
  });

  test('Rejects invalid email format with 400 and field-level error', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, email: 'notanemail' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('email');
  });

  test('Rejects invalid username formats with 400 and field-level error', async () => {
    const tooShort = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, username: 'ab' });
    expect(tooShort.status).toBe(400);
    expect(tooShort.body.errors).toHaveProperty('username');

    const tooLong = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, username: 'a_very_long_username_that_exceeds_twenty_chars' });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.errors).toHaveProperty('username');

    const invalidChars = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, username: 'user@bloom' });
    expect(invalidChars.status).toBe(400);
    expect(invalidChars.body.errors).toHaveProperty('username');
  });
});

describe('POST /api/auth/login', () => {
  const registeredUser = {
    username: 'rose_petal',
    email: 'rose@example.com',
    password: 'RoseSecret123'
  };

  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(registeredUser);
  });

  test('Logs in successfully and sets httpOnly cookie', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: registeredUser.email,
      password: registeredUser.password
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Login successful');
    expect(res.body.user).toBeDefined();
    expect(res.body.user.username).toBe(registeredUser.username);
    expect(res.body.user.passwordHash).toBeUndefined();

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/token=/);
    expect(cookies[0]).toMatch(/HttpOnly/i);
    expect(cookies[0]).toMatch(/SameSite=Lax/i);
  });

  test('Returns 401 with generic message on wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: registeredUser.email,
      password: 'WrongPassword123'
    });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Invalid email or password' });
  });

  test('Returns 401 with same generic message on unknown email (prevents enumeration)', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nonexistent@example.com',
      password: registeredUser.password
    });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Invalid email or password' });
  });
});

describe('GET /api/auth/me and Session Handling', () => {
  const testUser = {
    username: 'clover_leaf',
    email: 'clover@example.com',
    password: 'CloverSafe123'
  };

  test('Returns authenticated user profile when valid cookie is provided', async () => {
    const registerRes = await request(app).post('/api/auth/register').send(testUser);
    expect(registerRes.status).toBe(201);
    const cookie = registerRes.headers['set-cookie'];

    const meRes = await request(app).get('/api/auth/me').set('Cookie', cookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user).toBeDefined();
    expect(meRes.body.user.username).toBe(testUser.username);
    expect(meRes.body.user.email).toBe(testUser.email);
    expect(meRes.body.user.passwordHash).toBeUndefined();
  });

  test('Returns 401 when no cookie is sent', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message', 'Authentication required');
  });

  test('Returns 401 when token is tampered with', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', ['token=tampered.fake.jwttoken']);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message', 'Invalid or expired token');
  });

  test('POST /api/auth/logout clears authentication cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Logged out successfully');

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/token=;/);
  });
});

describe('Security Protections', () => {
  test('passwordHash never appears in any response', async () => {
    const regRes = await request(app).post('/api/auth/register').send({
      username: 'lily_bloom',
      email: 'lily@example.com',
      password: 'LilyPassword123'
    });
    expect(regRes.status).toBe(201);
    expect(regRes.body.user.passwordHash).toBeUndefined();

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'lily@example.com',
      password: 'LilyPassword123'
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.passwordHash).toBeUndefined();

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', loginRes.headers['set-cookie']);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.passwordHash).toBeUndefined();
  });

  test('NoSQL injection payload is sanitized or rejected', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: { $gt: '' },
        password: 'Password123'
      });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.body.user).toBeUndefined();
  });

  test('Rate limit triggers when login requests exceed threshold', async () => {
    loginLimiter.resetKey('::ffff:127.0.0.1');
    loginLimiter.resetKey('127.0.0.1');

    const results = [];
    for (let i = 0; i < 11; i++) {
      const res = await request(app).post('/api/auth/login').send({
        email: 'attacker@example.com',
        password: 'AttackerPassword123'
      });
      results.push(res.status);
    }

    expect(results.slice(0, 10)).not.toContain(429);
    expect(results[10]).toBe(429);
  });
});
