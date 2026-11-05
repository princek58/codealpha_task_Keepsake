/**
 * @jest-environment jsdom
 */

import { getSafeNextUrl } from '../js/guard.js';

describe('Auth Guard & Open-Redirect Prevention', () => {
  function setWindowSearch(search) {
    window.history.pushState({}, '', `/auth.html${search}`);
  }

  afterEach(() => {
    window.history.pushState({}, '', '/auth.html');
  });

  test('returns defaultUrl when no next parameter is provided', () => {
    setWindowSearch('');
    expect(getSafeNextUrl()).toBe('/home.html');
    expect(getSafeNextUrl('/custom-default.html')).toBe('/custom-default.html');
  });

  test('accepts safe relative paths', () => {
    setWindowSearch('?next=%2Flibrary.html');
    expect(getSafeNextUrl()).toBe('/library.html');

    setWindowSearch('?next=%2Fmoment.html%3Fid%3D12345');
    expect(getSafeNextUrl()).toBe('/moment.html?id=12345');

    setWindowSearch('?next=%2Fprofile.html%3Fu%3Dwillow');
    expect(getSafeNextUrl()).toBe('/profile.html?u=willow');
  });

  test('rejects absolute URLs and protocol-based attacks', () => {
    setWindowSearch('?next=https%3A%2F%2Fattacker.com');
    expect(getSafeNextUrl()).toBe('/home.html');

    setWindowSearch('?next=http%3A%2F%2Fevil.org%2Fphish');
    expect(getSafeNextUrl()).toBe('/home.html');

    setWindowSearch('?next=javascript%3Aalert(1)');
    expect(getSafeNextUrl()).toBe('/home.html');

    setWindowSearch('?next=data%3Atext%2Fhtml%2Chacked');
    expect(getSafeNextUrl()).toBe('/home.html');
  });

  test('rejects protocol-relative and backslash evasion URLs', () => {
    setWindowSearch('?next=%2F%2Fevil.com');
    expect(getSafeNextUrl()).toBe('/home.html');

    setWindowSearch('?next=%2F%5Cevil.com');
    expect(getSafeNextUrl()).toBe('/home.html');
  });
});
