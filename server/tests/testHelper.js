const request = require('supertest');
const app = require('../app');

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
      bio: overrides.bio || '',
      moodSticker: overrides.moodSticker || 'flower'
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

module.exports = {
  createTestUser
};
