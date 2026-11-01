const request = require('supertest');
const app = require('../app');
const Notification = require('../models/Notification');
const { connectTestDB, clearTestDB, closeTestDB } = require('./setup');
const { createTestUser } = require('./testHelper');

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

describe('Notifications API', () => {
  test('Requires authentication for all notification endpoints', async () => {
    const listRes = await request(app).get('/api/notifications');
    expect(listRes.status).toBe(401);

    const countRes = await request(app).get('/api/notifications/unread-count');
    expect(countRes.status).toBe(401);

    const markAllRes = await request(app).put('/api/notifications/read');
    expect(markAllRes.status).toBe(401);

    const markOneRes = await request(app).put('/api/notifications/507f1f77bcf86cd799439011/read');
    expect(markOneRes.status).toBe(401);
  });

  test('Lists notifications in chronological order and tracks unread count', async () => {
    const receiver = await createTestUser({ username: 'receiver_user' });
    const sender = await createTestUser({ username: 'sender_user' });

    // Create a post and like it
    const postRes = await request(app)
      .post('/api/posts')
      .set('Cookie', receiver.cookie)
      .send({ text: 'Notification receiver bloom' });
    const postId = postRes.body.post.id;

    // Follow and Like from sender
    await request(app)
      .post(`/api/users/${receiver.user.id}/follow`)
      .set('Cookie', sender.cookie);

    await request(app)
      .post(`/api/posts/${postId}/like`)
      .set('Cookie', sender.cookie);

    // Check unread count
    const countRes = await request(app)
      .get('/api/notifications/unread-count')
      .set('Cookie', receiver.cookie);
    expect(countRes.status).toBe(200);
    expect(countRes.body.count).toBe(2);

    // List notifications
    const listRes = await request(app)
      .get('/api/notifications')
      .set('Cookie', receiver.cookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.items).toHaveLength(2);
    expect(listRes.body.items[0].type).toBe('like');
    expect(listRes.body.items[0].from.username).toBe('sender_user');
    expect(listRes.body.items[0].postPreview).toBe('Notification receiver bloom');
    expect(listRes.body.items[0].read).toBe(false);

    // Mark single notification read
    const firstNotifId = listRes.body.items[0].id;
    const markOneRes = await request(app)
      .put(`/api/notifications/${firstNotifId}/read`)
      .set('Cookie', receiver.cookie);
    expect(markOneRes.status).toBe(200);

    const countResAfterOne = await request(app)
      .get('/api/notifications/unread-count')
      .set('Cookie', receiver.cookie);
    expect(countResAfterOne.body.count).toBe(1);

    // Mark all as read
    const markAllRes = await request(app)
      .put('/api/notifications/read')
      .set('Cookie', receiver.cookie);
    expect(markAllRes.status).toBe(200);

    const countResAfterAll = await request(app)
      .get('/api/notifications/unread-count')
      .set('Cookie', receiver.cookie);
    expect(countResAfterAll.body.count).toBe(0);
  });

  test('Cannot mark another user notification as read', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const userC = await createTestUser();

    // User C follows User A -> notification for User A
    await request(app)
      .post(`/api/users/${userA.user.id}/follow`)
      .set('Cookie', userC.cookie);

    const notif = await Notification.findOne({ to: userA.user.id });

    // User B attempts to mark User A's notification as read
    const res = await request(app)
      .put(`/api/notifications/${notif._id}/read`)
      .set('Cookie', userB.cookie);
    expect(res.status).toBe(404);
  });
});

