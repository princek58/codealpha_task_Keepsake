/**
 * @jest-environment jsdom
 */

import {
  formatTimeAgo,
  formatBytes,
  formatDuration,
  buildCommentItem,
  buildMomentCard,
  buildUserRow,
  buildNotificationItem,
  openModal,
  closeModal
} from '../js/ui.js';

describe('UI Utilities & Safe Element Builders', () => {
  test('formatBytes formats bytes into human-readable units', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024 * 4.5)).toBe('4.5 MB');
    expect(formatBytes(1024 * 1024 * 1024 * 2)).toBe('2.0 GB');
  });

  test('formatDuration formats seconds into mm:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(45)).toBe('0:45');
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(605)).toBe('10:05');
  });

  test('formatTimeAgo outputs relative intervals', () => {
    const now = Date.now();
    expect(formatTimeAgo(new Date(now - 10 * 1000))).toBe('just now');
    expect(formatTimeAgo(new Date(now - 5 * 60 * 1000))).toBe('5m ago');
    expect(formatTimeAgo(new Date(now - 3 * 3600 * 1000))).toBe('3h ago');
    expect(formatTimeAgo(new Date(now - 2 * 86400 * 1000))).toBe('2d ago');
  });

  test('Safe builders NEVER interpret user HTML (XSS prevention test)', () => {
    const xssPayload = '<img src=x onerror="alert(1)"><b>Malicious</b>';

    // 1. Comment Item
    const comment = {
      id: 'c1',
      author: { displayName: xssPayload, username: 'hacker' },
      text: xssPayload
    };
    const commentEl = buildCommentItem(comment);
    expect(commentEl.innerHTML).not.toContain('<img src=x onerror');
    expect(commentEl.querySelector('img[onerror]')).toBeNull();
    expect(commentEl.querySelector('b')).toBeNull();
    expect(commentEl.querySelector('.comment-text').textContent).toBe(xssPayload);

    // 2. Moment Card
    const moment = {
      id: 'm1',
      author: { displayName: xssPayload, username: 'user' },
      title: xssPayload,
      caption: xssPayload,
      place: xssPayload,
      media: []
    };
    const momentCard = buildMomentCard(moment);
    expect(momentCard.querySelector('img[onerror]')).toBeNull();
    expect(momentCard.querySelector('.moment-title').textContent).toBe(xssPayload);
    expect(momentCard.querySelector('.moment-caption').textContent).toBe(xssPayload);

    // 3. User Row
    const user = { username: 'testuser', displayName: xssPayload };
    const userRow = buildUserRow(user);
    expect(userRow.querySelector('img[onerror]')).toBeNull();

    // 4. Notification Item
    const notif = {
      from: { displayName: xssPayload, username: 'actor' },
      type: 'like',
      momentPreview: xssPayload
    };
    const notifEl = buildNotificationItem(notif);
    expect(notifEl.querySelector('img[onerror]')).toBeNull();
  });

  test('Modal focus trap and focus restore', () => {
    // Create button that will open modal
    const launchBtn = document.createElement('button');
    launchBtn.textContent = 'Launch';
    document.body.appendChild(launchBtn);
    launchBtn.focus();
    expect(document.activeElement).toBe(launchBtn);

    // Create modal backdrop and modal with focusable children
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const modal = document.createElement('div');
    modal.className = 'modal';

    const input1 = document.createElement('input');
    const input2 = document.createElement('input');
    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('data-close-modal', '');

    modal.appendChild(input1);
    modal.appendChild(input2);
    modal.appendChild(closeBtn);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // Open Modal
    openModal(backdrop);
    expect(backdrop.classList.contains('open')).toBe(true);
    expect(backdrop.getAttribute('aria-hidden')).toBe('false');

    // First focusable element should be focused
    expect(document.activeElement).toBe(input1);

    // Close Modal
    closeModal(backdrop);
    expect(backdrop.classList.contains('open')).toBe(false);
    expect(backdrop.getAttribute('aria-hidden')).toBe('true');

    // Focus restored to launching element
    expect(document.activeElement).toBe(launchBtn);
  });
});

