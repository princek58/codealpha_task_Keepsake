/**
 * @jest-environment jsdom
 */

import * as api from '../js/api.js';

describe('API Client Module', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('Constructs proper endpoint URLs and parameters', async () => {
    const calls = [];
    global.fetch = jest.fn((url, options) => {
      calls.push({ url, options });
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true })
      });
    });

    // 1. Search Users
    await api.searchUsers('daisy', 2, 15);
    expect(calls[0].url).toBe('/api/users/search?q=daisy&page=2&limit=15');

    // 2. Moments Feed
    await api.getFeedMoments(3, 10);
    expect(calls[1].url).toBe('/api/moments/feed?page=3&limit=10');

    // 3. User Moments
    await api.getUserMoments('daisy', 1, 20);
    expect(calls[2].url).toBe('/api/moments/user/daisy?page=1&limit=20');

    // 4. Shared Album
    await api.getSharedAlbum('token123');
    expect(calls[3].url).toBe('/api/albums/shared/token123');

    // 5. Media Limits
    await api.getMediaLimits();
    expect(calls[4].url).toBe('/api/media/limits');
  });

  test('Maps HTTP error responses into ApiError with status and fields', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: { get: () => 'application/json' },
        json: () =>
          Promise.resolve({
            message: 'Validation failed',
            errors: { title: 'Title cannot exceed 80 characters' }
          })
      })
    );

    await expect(api.createMoment({ title: 'Too long...' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Validation failed',
      errors: { title: 'Title cannot exceed 80 characters' }
    });
  });

  test('Emits auth:unauthorized event on 401 response without redirect loop', async () => {
    let firedEvent = null;
    window.addEventListener('auth:unauthorized', (e) => {
      firedEvent = e;
    });

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ message: 'Token expired' })
      })
    );

    await expect(api.getMe()).rejects.toThrow();
    expect(firedEvent).not.toBeNull();
  });
});

