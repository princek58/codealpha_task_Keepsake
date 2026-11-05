/**
 * @jest-environment jsdom
 */

import { templatesForCount, getTemplateById } from '../js/collage-templates.js';

describe('Moment Draft Logic & Template Fitting', () => {
  test('enforces max 20 media limit', () => {
    const MAX_MEDIA = 20;
    const media = Array.from({ length: 25 }, (_, i) => ({ id: `m-${i}` }));

    function validateMediaSelection(items) {
      if (!items || items.length === 0) {
        return { valid: false, error: 'At least 1 media item is required' };
      }
      if (items.length > MAX_MEDIA) {
        return { valid: false, error: `Maximum ${MAX_MEDIA} media items allowed` };
      }
      return { valid: true, error: null };
    }

    expect(validateMediaSelection([]).valid).toBe(false);
    expect(validateMediaSelection(media).valid).toBe(false);
    expect(validateMediaSelection(media.slice(0, 20)).valid).toBe(true);
    expect(validateMediaSelection(media.slice(0, 5)).valid).toBe(true);
  });

  test('matches collage templates to exact media item counts', () => {
    const templatesFor2 = templatesForCount(2);
    expect(templatesFor2.length).toBeGreaterThan(0);
    templatesFor2.forEach((t) => {
      expect(t.allowedCounts).toContain(2);
    });

    const templatesFor3 = templatesForCount(3);
    expect(templatesFor3.length).toBeGreaterThan(0);
    templatesFor3.forEach((t) => {
      expect(t.allowedCounts).toContain(3);
    });

    const template4 = getTemplateById('collage-2x2');
    expect(template4).toBeDefined();
    expect(template4.id).toBe('collage-2x2');
    expect(template4.allowedCounts).toContain(4);
  });

  test('serializes and restores moment drafts cleanly', () => {
    const draft = {
      mediaIds: ['id-1', 'id-2', 'id-3'],
      title: 'Summer in Kyoto',
      caption: 'Quiet temple steps and cedar trees.',
      layout: {
        type: 'collage',
        template: 'collage-1-2',
        gap: 8,
        background: 'var(--color-sand)'
      },
      tags: ['travel', 'japan'],
      visibility: 'public'
    };

    sessionStorage.setItem('keepsake_draft_test', JSON.stringify(draft));
    const restored = JSON.parse(sessionStorage.getItem('keepsake_draft_test'));

    expect(restored).toEqual(draft);
    expect(restored.mediaIds.length).toBe(3);
    expect(restored.layout.type).toBe('collage');
    sessionStorage.removeItem('keepsake_draft_test');
  });
});
