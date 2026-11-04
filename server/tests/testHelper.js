const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const storage = require('../services/storage');
const Media = require('../models/Media');
const Moment = require('../models/Moment');
const Album = require('../models/Album');

let counter = 1;

const createTestUser = async (overrides = {}) => {
  const rand = Math.random().toString(36).substring(2, 7);
  const username = overrides.username || `u_${rand}_${counter++}`;
  const email = overrides.email || `${username}@example.com`;
  const password = overrides.password || 'Password123';

  const res = await request(app)
    .post('/api/auth/register')
    .send({
      username,
      email,
      password,
      displayName: overrides.displayName || username,
      bio: overrides.bio || ''
    });

  if (res.status !== 201) {
    throw new Error(`Failed to create test user (${res.status}): ${JSON.stringify(res.body)}`);
  }

  const cookie = res.headers['set-cookie'];
  return {
    user: res.body.user,
    cookie,
    credentials: { username, email, password }
  };
};

const createTestMedia = async (userId, overrides = {}) => {
  const dummyId = new mongoose.Types.ObjectId();
  const origRel = `${userId}/${dummyId}/original.jpg`;
  const dispRel = `${userId}/${dummyId}/display.webp`;
  const thumbRel = `${userId}/${dummyId}/thumb.webp`;

  await storage.writeBuffer(origRel, Buffer.from('fake-original'));
  await storage.writeBuffer(dispRel, Buffer.from('fake-display'));
  await storage.writeBuffer(thumbRel, Buffer.from('fake-thumb'));

  return await Media.create({
    _id: dummyId,
    owner: userId,
    type: overrides.type || 'image',
    status: overrides.status || 'ready',
    originalName: overrides.originalName || 'test.jpg',
    mime: overrides.mime || 'image/jpeg',
    sizeBytes: overrides.sizeBytes || 1024,
    width: overrides.width || 800,
    height: overrides.height || 600,
    blurDataUrl: 'data:image/webp;base64,fakeblur',
    paths: overrides.paths || {
      original: origRel,
      display: dispRel,
      thumb: thumbRel
    },
    ...overrides
  });
};

const createTestMoment = async (userId, mediaIds, overrides = {}) => {
  return await Moment.create({
    owner: userId,
    title: overrides.title || 'Test Moment',
    caption: overrides.caption || 'A lovely test moment',
    media: mediaIds,
    layout: overrides.layout || {
      type: 'grid',
      template: 'grid',
      gap: 8,
      background: '#ffffff'
    },
    visibility: overrides.visibility || 'public',
    ...overrides
  });
};

const createTestAlbum = async (userId, mediaIds = [], overrides = {}) => {
  return await Album.create({
    owner: userId,
    title: overrides.title || 'Test Album',
    description: overrides.description || 'A test album description',
    visibility: overrides.visibility || 'private',
    media: mediaIds,
    cover: overrides.cover || (mediaIds.length > 0 ? mediaIds[0] : null),
    ...overrides
  });
};

module.exports = {
  createTestUser,
  createTestMedia,
  createTestMoment,
  createTestAlbum
};
