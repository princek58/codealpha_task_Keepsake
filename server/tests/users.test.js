const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../app');
const User = require('../models/User');
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

describe('Users API', () => {
  describe('GET /api/users/search', () => {
    test('Searches by username and displayName case-insensitively', async () => {
      await createTestUser({ username: 'sunflower_1', displayName: 'Sunny Bloom' });
      await createTestUser({ username: 'lavender_2', displayName: 'Gentle Breeze' });

      const res1 = await request(app).get('/api/users/search?q=sunny');
      expect(res1.status).toBe(200);
      expect(res1.body.items).toHaveLength(1);
      expect(res1.body.items[0].username).toBe('sunflower_1');

      const res2 = await request(app).get('/api/users/search?q=LAVENDER');
      expect(res2.status).toBe(200);
      expect(res2.body.items).toHaveLength(1);
      expect(res2.body.items[0].username).toBe('lavender_2');
    });

    test('Rejects search query shorter than 2 characters', async () => {
      const res = await request(app).get('/api/users/search?q=a');
      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('q');
    });

    test('Safely escapes regex special characters without crashing or injection', async () => {
      await createTestUser({ username: 'regular_user', displayName: 'Regular User' });
      const res = await request(app).get('/api/users/search?q=.*+?^');
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(0);
    });
  });

  describe('GET /api/users/suggestions', () => {
    test('Requires authentication', async () => {
      const res = await request(app).get('/api/users/suggestions');
      expect(res.status).toBe(401);
    });

    test('Returns suggestions prioritizing second-degree connections, excluding self and followed', async () => {
      const me = await createTestUser({ username: 'gardener_me' });
      const friend = await createTestUser({ username: 'gardener_friend' });
      const friendOfFriend = await createTestUser({ username: 'gardener_fof' });
      const stranger = await createTestUser({ username: 'gardener_stranger' });

      // me follows friend
      await request(app)
        .post(`/api/users/${friend.user.id}/follow`)
        .set('Cookie', me.cookie);

      // friend follows friendOfFriend
      await request(app)
        .post(`/api/users/${friendOfFriend.user.id}/follow`)
        .set('Cookie', friend.cookie);

      const res = await request(app)
        .get('/api/users/suggestions')
        .set('Cookie', me.cookie);

      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();

      const suggestedUsernames = res.body.items.map((u) => u.username);
      expect(suggestedUsernames).not.toContain('gardener_me');
      expect(suggestedUsernames).not.toContain('gardener_friend');
      expect(suggestedUsernames).toContain('gardener_fof');
      expect(suggestedUsernames).toContain('gardener_stranger');
    });
  });

  describe('GET /api/users/:username', () => {
    test('Returns public profile with accurate counts and flags', async () => {
      const viewer = await createTestUser({ username: 'viewer_user' });
      const target = await createTestUser({
        username: 'target_bloomer',
        displayName: 'Target Bloomer',
        bio: 'Little cozy garden',
        moodSticker: 'heart'
      });

      // viewer follows target
      await request(app)
        .post(`/api/users/${target.user.id}/follow`)
        .set('Cookie', viewer.cookie);

      const res = await request(app)
        .get('/api/users/target_bloomer')
        .set('Cookie', viewer.cookie);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.username).toBe('target_bloomer');
      expect(res.body.user.displayName).toBe('Target Bloomer');
      expect(res.body.user.bio).toBe('Little cozy garden');
      expect(res.body.user.moodSticker).toBe('heart');
      expect(res.body.user.followersCount).toBe(1);
      expect(res.body.user.followingCount).toBe(0);
      expect(res.body.user.isFollowing).toBe(true);
      expect(res.body.user.isMe).toBe(false);
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.user.email).toBeUndefined();
    });

    test('Returns 404 for non-existent username', async () => {
      const res = await request(app).get('/api/users/definitely_not_a_user_123');
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('User not found');
    });
  });

  describe('GET /api/users/:username/followers and /following', () => {
    test('Returns paginated followers and following lists', async () => {
      const u1 = await createTestUser({ username: 'user_one' });
      const u2 = await createTestUser({ username: 'user_two' });

      await request(app)
        .post(`/api/users/${u2.user.id}/follow`)
        .set('Cookie', u1.cookie);

      const followersRes = await request(app).get('/api/users/user_two/followers');
      expect(followersRes.status).toBe(200);
      expect(followersRes.body.items).toHaveLength(1);
      expect(followersRes.body.items[0].username).toBe('user_one');
      expect(followersRes.body.hasMore).toBe(false);

      const followingRes = await request(app).get('/api/users/user_one/following');
      expect(followingRes.status).toBe(200);
      expect(followingRes.body.items).toHaveLength(1);
      expect(followingRes.body.items[0].username).toBe('user_two');
    });
  });

  describe('PUT /api/users/me', () => {
    test('Updates displayName, bio, moodSticker and cleans up replaced avatar', async () => {
      const me = await createTestUser({ username: 'editor_me' });

      // First upload an avatar
      const fakeImage1 = Buffer.from('fake-avatar-1');
      const res1 = await request(app)
        .put('/api/users/me')
        .set('Cookie', me.cookie)
        .field('displayName', 'Updated Daisy')
        .field('bio', 'Blooming blossoms')
        .field('moodSticker', 'star')
        .attach('avatar', fakeImage1, 'avatar1.png');

      expect(res1.status).toBe(200);
      expect(res1.body.user.displayName).toBe('Updated Daisy');
      expect(res1.body.user.bio).toBe('Blooming blossoms');
      expect(res1.body.user.moodSticker).toBe('star');
      expect(res1.body.user.avatar).toMatch(/^\/uploads\/[a-f0-9]+\.png$/);

      const firstAvatarPath = path.join(
        __dirname,
        '../uploads',
        path.basename(res1.body.user.avatar)
      );
      expect(fs.existsSync(firstAvatarPath)).toBe(true);

      // Second upload should replace and delete first avatar file from disk
      const fakeImage2 = Buffer.from('fake-avatar-2');
      const res2 = await request(app)
        .put('/api/users/me')
        .set('Cookie', me.cookie)
        .attach('avatar', fakeImage2, 'avatar2.jpg');

      expect(res2.status).toBe(200);
      expect(res2.body.user.avatar).toMatch(/^\/uploads\/[a-f0-9]+\.jpg$/);
      expect(fs.existsSync(firstAvatarPath)).toBe(false);

      // Now remove avatar via removeAvatar=true
      const res3 = await request(app)
        .put('/api/users/me')
        .set('Cookie', me.cookie)
        .field('removeAvatar', 'true');

      expect(res3.status).toBe(200);
      expect(res3.body.user.avatar).toBe('');
    });

    test('Rejects invalid mood sticker and oversized display name', async () => {
      const me = await createTestUser({ username: 'validator_user' });

      const res = await request(app)
        .put('/api/users/me')
        .set('Cookie', me.cookie)
        .send({
          displayName: 'A'.repeat(35),
          moodSticker: 'not_a_valid_sticker_name'
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('displayName');
      expect(res.body.errors).toHaveProperty('moodSticker');
    });
  });

  describe('POST /api/users/:id/follow', () => {
    test('Toggles follow/unfollow and manages follow notification correctly', async () => {
      const userA = await createTestUser({ username: 'planter_a' });
      const userB = await createTestUser({ username: 'planter_b' });

      // User A follows User B
      const followRes = await request(app)
        .post(`/api/users/${userB.user.id}/follow`)
        .set('Cookie', userA.cookie);

      expect(followRes.status).toBe(200);
      expect(followRes.body.following).toBe(true);
      expect(followRes.body.followersCount).toBe(1);

      // Check notification created for User B
      const notifsAfterFollow = await Notification.find({
        to: userB.user.id,
        from: userA.user.id,
        type: 'follow'
      });
      expect(notifsAfterFollow).toHaveLength(1);

      // User A unfollows User B
      const unfollowRes = await request(app)
        .post(`/api/users/${userB.user.id}/follow`)
        .set('Cookie', userA.cookie);

      expect(unfollowRes.status).toBe(200);
      expect(unfollowRes.body.following).toBe(false);
      expect(unfollowRes.body.followersCount).toBe(0);

      // Notification should be removed
      const notifsAfterUnfollow = await Notification.find({
        to: userB.user.id,
        from: userA.user.id,
        type: 'follow'
      });
      expect(notifsAfterUnfollow).toHaveLength(0);
    });

    test('Cannot follow yourself', async () => {
      const me = await createTestUser({ username: 'self_follower' });

      const res = await request(app)
        .post(`/api/users/${me.user.id}/follow`)
        .set('Cookie', me.cookie);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('You cannot follow yourself');
    });

    test('Returns 404 for unknown user id', async () => {
      const me = await createTestUser({ username: 'random_follower' });

      const res = await request(app)
        .post('/api/users/507f1f77bcf86cd799439011/follow')
        .set('Cookie', me.cookie);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('User not found');
    });
  });
});

