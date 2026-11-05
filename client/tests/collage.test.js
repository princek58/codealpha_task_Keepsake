/**
 * @jest-environment jsdom
 */

import { COLLAGE_TEMPLATES, templatesForCount, getDefaultTemplate } from '../js/collage-templates.js';
import { renderCollage, exportCollagePng } from '../js/collage.js';

describe('Collage Templates & Renderer', () => {
  test('All 12 collage templates have valid grids and area counts', () => {
    const templateIds = Object.keys(COLLAGE_TEMPLATES);
    expect(templateIds).toHaveLength(12);

    for (const [id, tmpl] of Object.entries(COLLAGE_TEMPLATES)) {
      expect(tmpl.id).toBe(id);
      expect(tmpl.label).toBeDefined();
      expect(tmpl.columns).toBeDefined();
      expect(tmpl.rows).toBeDefined();
      expect(tmpl.areas).toBeDefined();

      // Count unique area letters in the areas string
      const uniqueLetters = new Set(tmpl.areas.replace(/[^a-z]/g, '').split(''));
      if (id === 'collage-mosaic') {
        expect(tmpl.allowedCounts).toContain(uniqueLetters.size);
      } else {
        expect(uniqueLetters.size).toBe(tmpl.itemCount);
      }
    }
  });

  test('templatesForCount returns only templates matching item count', () => {
    const twoMatches = templatesForCount(2);
    expect(twoMatches.map((t) => t.id)).toEqual(
      expect.arrayContaining(['collage-1x2', 'collage-2x1'])
    );
    for (const t of twoMatches) {
      expect(t.allowedCounts).toContain(2);
    }

    const threeMatches = templatesForCount(3);
    expect(threeMatches.map((t) => t.id)).toEqual(
      expect.arrayContaining(['collage-1-2', 'collage-2-1', 'collage-3col', 'collage-mosaic'])
    );

    const nineMatches = templatesForCount(9);
    expect(nineMatches.map((t) => t.id)).toEqual(
      expect.arrayContaining(['collage-3x3', 'collage-mosaic'])
    );
  });

  test('getDefaultTemplate returns appropriate template ID for various counts', () => {
    expect(getDefaultTemplate(2)).toBe('collage-1x2');
    expect(getDefaultTemplate(3)).toBe('collage-1-2');
    expect(getDefaultTemplate(4)).toBe('collage-2x2');
    expect(getDefaultTemplate(5)).toBe('collage-1-4');
    expect(getDefaultTemplate(6)).toBe('collage-3x2');
    expect(getDefaultTemplate(9)).toBe('collage-3x3');
  });

  test('renderCollage creates the exact number of cells in order with proper attributes', () => {
    const container = document.createElement('div');
    const items = [
      { id: 'm1', caption: 'First', type: 'image' },
      { id: 'm2', caption: 'Second', type: 'video' },
      { id: 'm3', caption: 'Third', type: 'image' }
    ];

    let clicked = null;
    renderCollage(container, {
      items,
      template: 'collage-1-2',
      gap: 12,
      onTileClick: (info) => {
        clicked = info;
      }
    });

    const cells = container.querySelectorAll('.collage-cell');
    expect(cells).toHaveLength(3);
    expect(cells[0].style.gridArea).toBe('a');
    expect(cells[1].style.gridArea).toBe('b');
    expect(cells[2].style.gridArea).toBe('c');

    // Video cell should have media-badge
    expect(cells[1].querySelector('.media-badge')).not.toBeNull();

    // Clicking cell triggers callback
    cells[0].click();
    expect(clicked).not.toBeNull();
    expect(clicked.index).toBe(0);
    expect(clicked.item.id).toBe('m1');
  });

  test('exportCollagePng rejects videos with friendly error', async () => {
    const mixedItems = [
      { id: 'img1', type: 'image' },
      { id: 'vid1', type: 'video' }
    ];

    await expect(exportCollagePng(mixedItems, 'collage-1x2')).rejects.toThrow(
      'Collage export only supports photos, not videos.'
    );
  });
});

