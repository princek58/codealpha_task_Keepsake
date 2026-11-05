/**
 * @jest-environment jsdom
 */

import { openLightbox } from '../js/lightbox.js';

describe('Full-Screen Lightbox Module', () => {
  const items = [
    { id: '1', type: 'image', caption: 'Sunset', takenAt: '2026-10-10' },
    { id: '2', type: 'video', caption: 'Waves', durationSec: 15 },
    { id: '3', type: 'image', caption: 'Mountain' }
  ];

  afterEach(() => {
    document.querySelectorAll('.lightbox-root').forEach((el) => el.remove());
  });

  test('Opens lightbox, sets aria-modal, and updates counter', () => {
    const lb = openLightbox({ items, startIndex: 1 });
    expect(lb).toBeDefined();

    const root = document.querySelector('.lightbox-root');
    expect(root).not.toBeNull();
    expect(root.getAttribute('role')).toBe('dialog');
    expect(root.getAttribute('aria-modal')).toBe('true');

    const counter = root.querySelector('.lightbox-counter');
    expect(counter.textContent).toBe('2 / 3');

    // Video should render <video> tag
    const video = root.querySelector('video');
    expect(video).not.toBeNull();

    lb.close();
  });

  test('Keyboard navigation: ArrowRight advances, ArrowLeft goes back, Esc closes', () => {
    const lb = openLightbox({ items, startIndex: 0 });
    const counter = document.querySelector('.lightbox-counter');
    expect(counter.textContent).toBe('1 / 3');

    // Arrow Right -> index 1
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(counter.textContent).toBe('2 / 3');

    // Arrow Right -> index 2
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(counter.textContent).toBe('3 / 3');

    // Arrow Left -> index 1
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(counter.textContent).toBe('2 / 3');

    // Esc closes
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    // Wait for close animation
    setTimeout(() => {
      expect(document.querySelector('.lightbox-root')).toBeNull();
    }, 250);
  });

  test('Zoom clamping limits zoom level between 1 and 4', () => {
    const lb = openLightbox({ items, startIndex: 0 });
    lb.setZoom(5);
    expect(lb.zoomLevel).toBe(4);

    lb.setZoom(0.5);
    expect(lb.zoomLevel).toBe(1);

    lb.close();
  });
});

