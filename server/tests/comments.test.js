const request = require('supertest');
const app = require('../app');
const Moment = require('../models/Moment');
const Comment = require('../models/Comment');
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

describe('Comments API', () => {
  test('Creates comment, increments commentsCount, and notifies moment author', async () => {
    const author = await createTestUser({ username: 'moment_author' });
    const commenter = await createTestUser({ username: 'kind_commenter' });

    const media = await createTestMedia(author.user.id);
    const moment = await createTestMoment(author.user.id, [media._id], {
      caption: 'A lovely moment today',
      visibility: 'public'
    });
    const momentId = moment._id.toString();

    const commentRes = await request(app)
      .post(`/api/moments/${momentId}/comments`)
      .set('Cookie', commenter.cookie)
      .send({ text: 'So happy for you!' });

    expect(commentRes.status).toBe(201);
    expect(commentRes.body.comment).toBeDefined();
    expect(commentRes.body.comment.text).toBe('So happy for you!');
    expect(commentRes.body.comment.momentId).toBe(momentId);
    expect(commentRes.body.comment.author.username).toBe('kind_commenter');

    const updatedMoment = await Moment.findById(momentId);
    expect(updatedMoment.commentsCount).toBe(1);

    const notifs = await Notification.find({ moment: momentId, from: commenter.user.id, type: 'comment' });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].to.toString()).toBe(author.user.id);
  });

  test('Self-commenting does not generate a notification', async () => {
    const author = await createTestUser();
    const media = await createTestMedia(author.user.id);
    const moment = await createTestMoment(author.user.id, [media._id], {
      caption: 'Self moment',
      visibility: 'public'
    });
    const momentId = moment._id.toString();

    await request(app)
      .post(`/api/moments/${momentId}/comments`)
      .set('Cookie', author.cookie)
      .send({ text: 'Adding details to my moment' });

    const notifs = await Notification.find({ moment: momentId, to: author.user.id });
    expect(notifs).toHaveLength(0);
  });

  test('Rejects empty or oversized comment text', async () => {
    const user = await createTestUser();
    const media = await createTestMedia(user.user.id);
    const moment = await createTestMoment(user.user.id, [media._id], {
      caption: 'Validation test moment',
      visibility: 'public'
    });
    const momentId = moment._id.toString();

    const emptyRes = await request(app)
      .post(`/api/moments/${momentId}/comments`)
      .set('Cookie', user.cookie)
      .send({ text: '   ' });
    expect(emptyRes.status).toBe(400);

    const longRes = await request(app)
      .post(`/api/moments/${momentId}/comments`)
      .set('Cookie', user.cookie)
      .send({ text: 'B'.repeat(301) });
    expect(longRes.status).toBe(400);
  });

  test('Lists comments oldest first with pagination', async () => {
    const user = await createTestUser();
    const media = await createTestMedia(user.user.id);
    const moment = await createTestMoment(user.user.id, [media._id], {
      caption: 'Listing test moment',
      visibility: 'public'
    });
    const momentId = moment._id.toString();

    await request(app)
      .post(`/api/moments/${momentId}/comments`)
      .set('Cookie', user.cookie)
      .send({ text: 'First comment' });

    await request(app)
      .post(`/api/moments/${momentId}/comments`)
      .set('Cookie', user.cookie)
      .send({ text: 'Second comment' });

    const listRes = await request(app)
      .get(`/api/moments/${momentId}/comments`)
      .set('Cookie', user.cookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.items).toHaveLength(2);
    expect(listRes.body.items[0].text).toBe('First comment');
    expect(listRes.body.items[1].text).toBe('Second comment');
  });

  test('Deletes comment by comment author or moment author, decrements count, and removes notification', async () => {
    const momentAuthor = await createTestUser({ username: 'moment_owner' });
    const commentAuthor = await createTestUser({ username: 'comment_writer' });
    const stranger = await createTestUser({ username: 'stranger_user' });

    const media = await createTestMedia(momentAuthor.user.id);
    const moment = await createTestMoment(momentAuthor.user.id, [media._id], {
      caption: 'Delete comment test moment',
      visibility: 'public'
    });
    const momentId = moment._id.toString();

    const commentRes = await request(app)
      .post(`/api/moments/${momentId}/comments`)
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

    const momentAfterDelete = await Moment.findById(momentId);
    expect(momentAfterDelete.commentsCount).toBe(0);

    const notifs = await Notification.find({ moment: momentId, from: commentAuthor.user.id });
    expect(notifs).toHaveLength(0);

    // Test moment author can also delete comments on their moment
    const commentRes2 = await request(app)
      .post(`/api/moments/${momentId}/comments`)
      .set('Cookie', commentAuthor.cookie)
      .send({ text: 'Second comment for moment owner delete' });
    const commentId2 = commentRes2.body.comment.id;

    const momentOwnerDelete = await request(app)
      .delete(`/api/comments/${commentId2}`)
      .set('Cookie', momentAuthor.cookie);
    expect(momentOwnerDelete.status).toBe(200);
  });
});
