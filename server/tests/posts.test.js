const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../app');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
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

describe('Posts API', () => {
  describe('POST /api/posts', () => {
    test('Creates post with text only', async () => {
      const user = await createTestUser();
      const res = await request(app)
        .post('/api/posts')
        .set('Cookie', user.cookie)
        .send({ text: 'A gentle morning bloom.' });

      expect(res.status).toBe(201);
      expect(res.body.post).toBeDefined();
      expect(res.body.post.text).toBe('A gentle morning bloom.');
      expect(res.body.post.image).toBe('');
      expect(res.body.post.author.username).toBe(user.user.username);
      expect(res.body.post.likesCount).toBe(0);
      expect(res.body.post.commentsCount).toBe(0);
      expect(res.body.post.likedByMe).toBe(false);
    });

    test('Creates post with image only', async () => {
      const user = await createTestUser();
      const fakeImage = Buffer.from('fake-image-content');

      const res = await request(app)
        .post('/api/posts')
        .set('Cookie', user.cookie)
        .attach('image', fakeImage, 'bloom.png');

      expect(res.status).toBe(201);
      expect(res.body.post.image).toMatch(/^\/uploads\/[a-f0-9]+\.png$/);
      expect(res.body.post.text).toBe('');

      // Clean up uploaded test file
      const uploadedPath = path.join(
        __dirname,
        '../uploads',
        path.basename(res.body.post.image)
      );
      if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
    });

    test('Creates post with both text and image', async () => {
      const user = await createTestUser();
      const fakeImage = Buffer.from('fake-image-content');

      const res = await request(app)
        .post('/api/posts')
        .set('Cookie', user.cookie)
        .field('text', 'Looking at the flowers today')
        .attach('image', fakeImage, 'garden.jpg');

      expect(res.status).toBe(201);
      expect(res.body.post.text).toBe('Looking at the flowers today');
      expect(res.body.post.image).toMatch(/^\/uploads\/[a-f0-9]+\.jpg$/);

      const uploadedPath = path.join(
        __dirname,
        '../uploads',
        path.basename(res.body.post.image)
      );
      if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
    });

    test('Rejects post with neither text nor image (400)', async () => {
      const user = await createTestUser();
      const res = await request(app)
        .post('/api/posts')
        .set('Cookie', user.cookie)
        .send({ text: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Text or image is required');
    });

    test('Rejects post with text exceeding 500 characters', async () => {
      const user = await createTestUser();
      const longText = 'A'.repeat(501);

      const res = await request(app)
        .post('/api/posts')
        .set('Cookie', user.cookie)
        .send({ text: longText });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/posts/feed', () => {
    test('Returns only posts from followed users and self in chronological order', async () => {
      const userA = await createTestUser({ username: 'feed_author_a' });
      const userB = await createTestUser({ username: 'feed_author_b' });
      const stranger = await createTestUser({ username: 'feed_stranger' });

      // userA follows userB
      await request(app)
        .post(`/api/users/${userB.user.id}/follow`)
        .set('Cookie', userA.cookie);

      // Create posts
      await request(app)
        .post('/api/posts')
        .set('Cookie', userA.cookie)
        .send({ text: 'My own bloom' });

      await request(app)
        .post('/api/posts')
        .set('Cookie', userB.cookie)
        .send({ text: 'Post from user B' });

      await request(app)
        .post('/api/posts')
        .set('Cookie', stranger.cookie)
        .send({ text: 'Stranger post' });

      const feedRes = await request(app)
        .get('/api/posts/feed')
        .set('Cookie', userA.cookie);

      expect(feedRes.status).toBe(200);
      expect(feedRes.body.items).toHaveLength(2);

      const feedTexts = feedRes.body.items.map((p) => p.text);
      expect(feedTexts).toContain('My own bloom');
      expect(feedTexts).toContain('Post from user B');
      expect(feedTexts).not.toContain('Stranger post');
    });
  });

  describe('GET /api/posts/explore', () => {
    test('Returns all posts paginated', async () => {
      const user = await createTestUser();
      for (let i = 1; i <= 3; i++) {
        await request(app)
          .post('/api/posts')
          .set('Cookie', user.cookie)
          .send({ text: `Explore bloom ${i}` });
      }

      const res = await request(app).get('/api/posts/explore?page=1&limit=2');
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.hasMore).toBe(true);
      expect(res.body.page).toBe(1);
    });
  });

  describe('GET /api/posts/user/:username', () => {
    test('Returns posts for a specific user', async () => {
      const userA = await createTestUser({ username: 'bloomer_one' });
      const userB = await createTestUser({ username: 'bloomer_two' });

      await request(app)
        .post('/api/posts')
        .set('Cookie', userA.cookie)
        .send({ text: 'Bloom 1' });

      await request(app)
        .post('/api/posts')
        .set('Cookie', userB.cookie)
        .send({ text: 'Bloom 2' });

      const res = await request(app).get('/api/posts/user/bloomer_one');
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].text).toBe('Bloom 1');
    });
  });

  describe('GET /api/posts/:id and DELETE /api/posts/:id', () => {
    test('Retrieves single post and verifies 404 for invalid or missing id', async () => {
      const user = await createTestUser();
      const createRes = await request(app)
        .post('/api/posts')
        .set('Cookie', user.cookie)
        .send({ text: 'Single post test' });

      const postId = createRes.body.post.id;

      const getRes = await request(app).get(`/api/posts/${postId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.post.text).toBe('Single post test');

      const invalidRes = await request(app).get('/api/posts/invalid_post_id');
      expect(invalidRes.status).toBe(404);

      const notFoundRes = await request(app).get('/api/posts/507f1f77bcf86cd799439011');
      expect(notFoundRes.status).toBe(404);
    });

    test('Author can delete post and cascades comments, notifications, and image file', async () => {
      const author = await createTestUser();
      const fakeImage = Buffer.from('fake-post-image');

      const postRes = await request(app)
        .post('/api/posts')
        .set('Cookie', author.cookie)
        .field('text', 'Bloom with image')
        .attach('image', fakeImage, 'bloom_pic.png');

      const postId = postRes.body.post.id;
      const imagePath = path.join(
        __dirname,
        '../uploads',
        path.basename(postRes.body.post.image)
      );
      expect(fs.existsSync(imagePath)).toBe(true);

      // Add comment and notification
      const commenter = await createTestUser();
      await request(app)
        .post(`/api/posts/${postId}/comments`)
        .set('Cookie', commenter.cookie)
        .send({ text: 'Lovely post!' });

      expect(await Comment.countDocuments({ post: postId })).toBe(1);
      expect(await Notification.countDocuments({ post: postId })).toBe(1);

      // Stranger cannot delete (403)
      const stranger = await createTestUser();
      const forbiddenRes = await request(app)
        .delete(`/api/posts/${postId}`)
        .set('Cookie', stranger.cookie);
      expect(forbiddenRes.status).toBe(403);

      // Author deletes post
      const deleteRes = await request(app)
        .delete(`/api/posts/${postId}`)
        .set('Cookie', author.cookie);
      expect(deleteRes.status).toBe(200);

      // Verify cascaded deletion
      expect(await Post.findById(postId)).toBeNull();
      expect(await Comment.countDocuments({ post: postId })).toBe(0);
      expect(await Notification.countDocuments({ post: postId })).toBe(0);
      expect(fs.existsSync(imagePath)).toBe(false);
    });
  });

  describe('POST /api/posts/:id/like', () => {
    test('Toggles like/unlike, updates likedByMe, and manages notifications', async () => {
      const author = await createTestUser({ username: 'post_author' });
      const liker = await createTestUser({ username: 'post_liker' });

      const postRes = await request(app)
        .post('/api/posts')
        .set('Cookie', author.cookie)
        .send({ text: 'Bloom worth liking' });
      const postId = postRes.body.post.id;

      // 1. Liker likes post
      const likeRes1 = await request(app)
        .post(`/api/posts/${postId}/like`)
        .set('Cookie', liker.cookie);

      expect(likeRes1.status).toBe(200);
      expect(likeRes1.body.liked).toBe(true);
      expect(likeRes1.body.likesCount).toBe(1);

      // Check notification created for author
      const notifs1 = await Notification.find({ post: postId, from: liker.user.id, type: 'like' });
      expect(notifs1).toHaveLength(1);

      // Check post state from liker's view
      const checkPost1 = await request(app)
        .get(`/api/posts/${postId}`)
        .set('Cookie', liker.cookie);
      expect(checkPost1.body.post.likedByMe).toBe(true);

      // 2. Liker unlikes post
      const unlikeRes = await request(app)
        .post(`/api/posts/${postId}/like`)
        .set('Cookie', liker.cookie);

      expect(unlikeRes.status).toBe(200);
      expect(unlikeRes.body.liked).toBe(false);
      expect(unlikeRes.body.likesCount).toBe(0);

      const notifs2 = await Notification.find({ post: postId, from: liker.user.id, type: 'like' });
      expect(notifs2).toHaveLength(0);

      // 3. Liker likes again (should replace notification, not stack)
      await request(app)
        .post(`/api/posts/${postId}/like`)
        .set('Cookie', liker.cookie);

      const notifs3 = await Notification.find({ post: postId, from: liker.user.id, type: 'like' });
      expect(notifs3).toHaveLength(1);

      // 4. Author liking own post should not create self-notification
      await request(app)
        .post(`/api/posts/${postId}/like`)
        .set('Cookie', author.cookie);

      const selfNotifs = await Notification.find({ post: postId, from: author.user.id, to: author.user.id });
      expect(selfNotifs).toHaveLength(0);
    });
  });
});

