const request = require('supertest');
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

describe('Comments API', () => {
  test('Creates comment, increments commentsCount, and notifies post author', async () => {
    const author = await createTestUser({ username: 'bloom_author' });
    const commenter = await createTestUser({ username: 'kind_commenter' });

    const postRes = await request(app)
      .post('/api/posts')
      .set('Cookie', author.cookie)
      .send({ text: 'A lovely bloom today' });
    const postId = postRes.body.post.id;

    const commentRes = await request(app)
      .post(`/api/posts/${postId}/comments`)
      .set('Cookie', commenter.cookie)
      .send({ text: 'So happy for you!' });

    expect(commentRes.status).toBe(201);
    expect(commentRes.body.comment).toBeDefined();
    expect(commentRes.body.comment.text).toBe('So happy for you!');
    expect(commentRes.body.comment.postId).toBe(postId);
    expect(commentRes.body.comment.author.username).toBe('kind_commenter');

    const updatedPost = await Post.findById(postId);
    expect(updatedPost.commentsCount).toBe(1);

    const notifs = await Notification.find({ post: postId, from: commenter.user.id, type: 'comment' });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].to.toString()).toBe(author.user.id);
  });

  test('Self-commenting does not generate a notification', async () => {
    const author = await createTestUser();
    const postRes = await request(app)
      .post('/api/posts')
      .set('Cookie', author.cookie)
      .send({ text: 'Self post' });
    const postId = postRes.body.post.id;

    await request(app)
      .post(`/api/posts/${postId}/comments`)
      .set('Cookie', author.cookie)
      .send({ text: 'Adding details to my bloom' });

    const notifs = await Notification.find({ post: postId, to: author.user.id });
    expect(notifs).toHaveLength(0);
  });

  test('Rejects empty or oversized comment text', async () => {
    const user = await createTestUser();
    const postRes = await request(app)
      .post('/api/posts')
      .set('Cookie', user.cookie)
      .send({ text: 'Validation test post' });
    const postId = postRes.body.post.id;

    const emptyRes = await request(app)
      .post(`/api/posts/${postId}/comments`)
      .set('Cookie', user.cookie)
      .send({ text: '   ' });
    expect(emptyRes.status).toBe(400);

    const longRes = await request(app)
      .post(`/api/posts/${postId}/comments`)
      .set('Cookie', user.cookie)
      .send({ text: 'B'.repeat(301) });
    expect(longRes.status).toBe(400);
  });

  test('Lists comments oldest first with pagination', async () => {
    const user = await createTestUser();
    const postRes = await request(app)
      .post('/api/posts')
      .set('Cookie', user.cookie)
      .send({ text: 'Listing test post' });
    const postId = postRes.body.post.id;

    await request(app)
      .post(`/api/posts/${postId}/comments`)
      .set('Cookie', user.cookie)
      .send({ text: 'First comment' });

    await request(app)
      .post(`/api/posts/${postId}/comments`)
      .set('Cookie', user.cookie)
      .send({ text: 'Second comment' });

    const listRes = await request(app).get(`/api/posts/${postId}/comments`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.items).toHaveLength(2);
    expect(listRes.body.items[0].text).toBe('First comment');
    expect(listRes.body.items[1].text).toBe('Second comment');
  });

  test('Deletes comment by comment author or post author, decrements count, and removes notification', async () => {
    const postAuthor = await createTestUser({ username: 'post_owner' });
    const commentAuthor = await createTestUser({ username: 'comment_writer' });
    const stranger = await createTestUser({ username: 'stranger_user' });

    const postRes = await request(app)
      .post('/api/posts')
      .set('Cookie', postAuthor.cookie)
      .send({ text: 'Delete comment test post' });
    const postId = postRes.body.post.id;

    const commentRes = await request(app)
      .post(`/api/posts/${postId}/comments`)
      .set('Cookie', commentAuthor.cookie)
      .send({ text: 'A comment to be deleted' });
    const commentId = commentRes.body.comment.id;

    // Stranger cannot delete (403)
    const strangerRes = await request(app)
      .delete(`/api/comments/${commentId}`)
      .set('Cookie', stranger.cookie);
    expect(strangerRes.status).toBe(403);

    // Comment author can delete
    const deleteRes = await request(app)
      .delete(`/api/comments/${commentId}`)
      .set('Cookie', commentAuthor.cookie);
    expect(deleteRes.status).toBe(200);

    const postAfterDelete = await Post.findById(postId);
    expect(postAfterDelete.commentsCount).toBe(0);

    const notifs = await Notification.find({ post: postId, from: commentAuthor.user.id });
    expect(notifs).toHaveLength(0);

    // Test post author can also delete comments on their post
    const commentRes2 = await request(app)
      .post(`/api/posts/${postId}/comments`)
      .set('Cookie', commentAuthor.cookie)
      .send({ text: 'Second comment for post owner delete' });
    const commentId2 = commentRes2.body.comment.id;

    const postOwnerDelete = await request(app)
      .delete(`/api/comments/${commentId2}`)
      .set('Cookie', postAuthor.cookie);
    expect(postOwnerDelete.status).toBe(200);
  });
});

