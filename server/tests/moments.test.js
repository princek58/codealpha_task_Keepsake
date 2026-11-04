const request = require('supertest');
const app = require('../app');
const Moment = require('../models/Moment');
const Media = require('../models/Media');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { connectTestDB, clearTestDB, closeTestDB } = require('./setup');
const { createTestUser, createTestMedia, createTestMoment } = require('./testHelper');

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

describe('Moments API', () => {
  test('Creates moment with valid layouts and rejects invalid templates or counts', async () => {
    const { user, cookie } = await createTestUser();

    // Create 3 media items
    const m1 = await createTestMedia(user.id);
    const m2 = await createTestMedia(user.id);
    const m3 = await createTestMedia(user.id);

    // 1. Grid layout
    const gridRes = await request(app)
      .post('/api/moments')
      .set('Cookie', cookie)
      .send({
        title: 'Grid Moment',
        media: [m1._id.toString(), m2._id.toString()],
        layout: { type: 'grid' }
      });

    expect(gridRes.status).toBe(201);
    expect(gridRes.body.moment.layout.type).toBe('grid');

    // 2. Carousel layout
    const carouselRes = await request(app)
      .post('/api/moments')
      .set('Cookie', cookie)
      .send({
        title: 'Carousel Moment',
        media: [m1._id.toString(), m2._id.toString()],
        layout: { type: 'carousel' }
      });

    expect(carouselRes.status).toBe(201);
    expect(carouselRes.body.moment.layout.type).toBe('carousel');

    // 3. Valid collage: collage-1-2 with 3 items
    const collageRes = await request(app)
      .post('/api/moments')
      .set('Cookie', cookie)
      .send({
        title: 'Collage Moment',
        media: [m1._id.toString(), m2._id.toString(), m3._id.toString()],
        layout: { type: 'collage', template: 'collage-1-2', gap: 12, background: '#f5f5f5' }
      });

    expect(collageRes.status).toBe(201);
    expect(collageRes.body.moment.layout.type).toBe('collage');
    expect(collageRes.body.moment.layout.template).toBe('collage-1-2');

    // 4. Invalid template name
    const badTemplateRes = await request(app)
      .post('/api/moments')
      .set('Cookie', cookie)
      .send({
        title: 'Bad Template',
        media: [m1._id.toString(), m2._id.toString()],
        layout: { type: 'collage', template: 'not-a-real-template' }
      });

    expect(badTemplateRes.status).toBe(400);

    // 5. Wrong item count for template (collage-1-2 expects 3 items, got 2)
    const wrongCountRes = await request(app)
      .post('/api/moments')
      .set('Cookie', cookie)
      .send({
        title: 'Wrong Count',
        media: [m1._id.toString(), m2._id.toString()],
        layout: { type: 'collage', template: 'collage-1-2' }
      });

    expect(wrongCountRes.status).toBe(400);
  });

  test('Rejects using someone else media or failed media items', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();

    const mediaA = await createTestMedia(userA.user.id);
    const mediaB = await createTestMedia(userB.user.id);
    const failedMediaA = await createTestMedia(userA.user.id, { status: 'failed' });

    // User A attempts to use User B's media
    const theftRes = await request(app)
      .post('/api/moments')
      .set('Cookie', userA.cookie)
      .send({
        title: 'Stolen Media',
        media: [mediaB._id.toString()]
      });

    expect(theftRes.status).toBe(400);

    // User A attempts to use failed media
    const failedRes = await request(app)
      .post('/api/moments')
      .set('Cookie', userA.cookie)
      .send({
        title: 'Failed Media',
        media: [failedMediaA._id.toString()]
      });

    expect(failedRes.status).toBe(400);
  });

  test('Feed and Explore visibility: explore is public only; feed shows followed (public + followers) and own', async () => {
    const alice = await createTestUser({ username: 'alice_feed' });
    const bob = await createTestUser({ username: 'bob_feed' });
    const charlie = await createTestUser({ username: 'charlie_feed' });

    // Alice media & moments
    const ma1 = await createTestMedia(alice.user.id);
    const ma2 = await createTestMedia(alice.user.id);
    const ma3 = await createTestMedia(alice.user.id);

    await createTestMoment(alice.user.id, [ma1._id], { title: 'Alice Public', visibility: 'public' });
    await createTestMoment(alice.user.id, [ma2._id], { title: 'Alice Followers', visibility: 'followers' });
    await createTestMoment(alice.user.id, [ma3._id], { title: 'Alice Private', visibility: 'private' });

    // Charlie media & moments
    const mc1 = await createTestMedia(charlie.user.id);
    await createTestMoment(charlie.user.id, [mc1._id], { title: 'Charlie Public', visibility: 'public' });

    // Explore check: returns public moments only
    const exploreRes = await request(app)
      .get('/api/moments/explore')
      .set('Cookie', bob.cookie);

    expect(exploreRes.status).toBe(200);
    const exploreTitles = exploreRes.body.items.map((m) => m.title);
    expect(exploreTitles).toContain('Alice Public');
    expect(exploreTitles).toContain('Charlie Public');
    expect(exploreTitles).not.toContain('Alice Followers');
    expect(exploreTitles).not.toContain('Alice Private');

    // Bob feed before following Alice: empty (no followings, no own)
    const feedBefore = await request(app)
      .get('/api/moments/feed')
      .set('Cookie', bob.cookie);
    expect(feedBefore.body.items).toHaveLength(0);

    // Bob follows Alice
    await request(app)
      .post(`/api/users/${alice.user.id}/follow`)
      .set('Cookie', bob.cookie);

    // Refresh Bob user in test (to get updated following list)
    const bobUpdated = await User.findById(bob.user.id);

    // Bob feed after following Alice: sees Alice Public & Alice Followers, NOT Alice Private
    const feedAfter = await request(app)
      .get('/api/moments/feed')
      .set('Cookie', bob.cookie);

    expect(feedAfter.status).toBe(200);
    const feedTitles = feedAfter.body.items.map((m) => m.title);
    expect(feedTitles).toContain('Alice Public');
    expect(feedTitles).toContain('Alice Followers');
    expect(feedTitles).not.toContain('Alice Private');
  });

  test('GET /api/moments/on-this-day returns items from previous years', async () => {
    const { user, cookie } = await createTestUser();
    const media = await createTestMedia(user.id);

    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 2);

    await createTestMoment(user.id, [media._id], {
      title: 'Two Years Ago Today',
      takenOn: pastDate
    });

    const otdRes = await request(app)
      .get('/api/moments/on-this-day')
      .set('Cookie', cookie);

    expect(otdRes.status).toBe(200);
    expect(otdRes.body.groups).toBeDefined();
    expect(otdRes.body.groups.length).toBeGreaterThanOrEqual(1);
    expect(otdRes.body.groups[0].year).toBe(pastDate.getFullYear());
    expect(otdRes.body.groups[0].moments[0].title).toBe('Two Years Ago Today');
  });

  test('Edits and deletes moment with cascade, media stays in library', async () => {
    const { user, cookie } = await createTestUser();
    const media = await createTestMedia(user.id);

    const moment = await createTestMoment(user.id, [media._id], { title: 'Original Title' });
    const momentId = moment._id.toString();

    // Edit
    const editRes = await request(app)
      .patch(`/api/moments/${momentId}`)
      .set('Cookie', cookie)
      .send({
        title: 'New Edited Title',
        caption: 'Updated caption'
      });

    expect(editRes.status).toBe(200);
    expect(editRes.body.moment.title).toBe('New Edited Title');

    // Delete
    const delRes = await request(app)
      .delete(`/api/moments/${momentId}`)
      .set('Cookie', cookie);

    expect(delRes.status).toBe(200);

    // Moment gone from db
    const checkMoment = await Moment.findById(momentId);
    expect(checkMoment).toBeNull();

    // Media stays intact in Library!
    const checkMedia = await Media.findById(media._id);
    expect(checkMedia).not.toBeNull();
  });

  test('Likes toggle and notification behavior', async () => {
    const author = await createTestUser({ username: 'moment_liker_target' });
    const liker = await createTestUser({ username: 'liker_user' });

    const media = await createTestMedia(author.user.id);
    const moment = await createTestMoment(author.user.id, [media._id], { visibility: 'public' });
    const momentId = moment._id.toString();

    // Liker likes
    const likeRes = await request(app)
      .post(`/api/moments/${momentId}/like`)
      .set('Cookie', liker.cookie);

    expect(likeRes.status).toBe(200);
    expect(likeRes.body.liked).toBe(true);
    expect(likeRes.body.likesCount).toBe(1);

    const notif = await Notification.findOne({ moment: momentId, from: liker.user.id });
    expect(notif).not.toBeNull();

    // Liker unlikes
    const unlikeRes = await request(app)
      .post(`/api/moments/${momentId}/like`)
      .set('Cookie', liker.cookie);

    expect(unlikeRes.status).toBe(200);
    expect(unlikeRes.body.liked).toBe(false);
    expect(unlikeRes.body.likesCount).toBe(0);

    const notifAfterUnlike = await Notification.findOne({ moment: momentId, from: liker.user.id });
    expect(notifAfterUnlike).toBeNull();
  });
});
