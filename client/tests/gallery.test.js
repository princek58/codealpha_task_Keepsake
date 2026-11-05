/**
 * @jest-environment jsdom
 */

import { computeJustifiedRows, groupMediaByDate, getTargetRowHeight } from '../js/gallery.js';

describe('Justified Gallery Layout Engine', () => {
  test('Returns empty array for empty or invalid input', () => {
    expect(computeJustifiedRows([], 1000)).toEqual([]);
    expect(computeJustifiedRows(null, 1000)).toEqual([]);
    expect(computeJustifiedRows([{ width: 100, height: 100 }], 0)).toEqual([]);
    expect(computeJustifiedRows([{ width: 100, height: 100 }], -200)).toEqual([]);
  });

  test('Single item layout honors container width and aspect ratio constraints', () => {
    const items = [{ id: '1', width: 800, height: 600 }];
    const containerWidth = 900;
    const targetHeight = 220;
    const gap = 8;

    const rows = computeJustifiedRows(items, containerWidth, targetHeight, gap);
    expect(rows).toHaveLength(1);
    expect(rows[0].items).toHaveLength(1);
    expect(rows[0].items[0].item.id).toBe('1');
    expect(rows[0].items[0].width).toBeLessThanOrEqual(containerWidth);
    expect(rows[0].items[0].height).toBeLessThanOrEqual(targetHeight * 1.35);
  });

  test('Rows never exceed container width and respect gaps', () => {
    const items = [
      { id: '1', width: 1200, height: 800 },
      { id: '2', width: 800, height: 1200 },
      { id: '3', width: 1000, height: 1000 },
      { id: '4', width: 1200, height: 675 },
      { id: '5', width: 900, height: 1200 },
      { id: '6', width: 1200, height: 900 },
      { id: '7', width: 1000, height: 1000 }
    ];

    const containerWidth = 1000;
    const targetHeight = 220;
    const gap = 10;

    const rows = computeJustifiedRows(items, containerWidth, targetHeight, gap);
    expect(rows.length).toBeGreaterThan(1);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const itemsWidth = row.items.reduce((sum, entry) => sum + entry.width, 0);
      const gapsWidth = (row.items.length - 1) * gap;
      const totalRowWidth = itemsWidth + gapsWidth;

      if (!row.isLastRow) {
        // Full rows must match containerWidth exactly
        expect(totalRowWidth).toBe(containerWidth);
      } else {
        // Last row must never exceed containerWidth
        expect(totalRowWidth).toBeLessThanOrEqual(containerWidth);
      }
    }
  });

  test('Preserves item order strictly', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: `item_${i}`,
      width: 400 + (i % 3) * 100,
      height: 300
    }));

    const rows = computeJustifiedRows(items, 800, 200, 8);
    const flattenedIds = rows.flatMap((r) => r.items.map((entry) => entry.item.id));
    expect(flattenedIds).toEqual(items.map((i) => i.id));
  });

  test('Handles extreme aspect ratios (very tall and very wide) safely', () => {
    const extremeItems = [
      { id: 'pano', width: 5000, height: 500 }, // 10:1 ratio
      { id: 'tower', width: 200, height: 4000 } // 1:20 ratio
    ];

    const rows = computeJustifiedRows(extremeItems, 900, 220, 8);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      for (const entry of row.items) {
        expect(entry.width).toBeGreaterThan(0);
        expect(entry.height).toBeGreaterThan(0);
      }
    }
  });

  test('groupMediaByDate groups items into chronological months', () => {
    const items = [
      { id: '1', takenAt: '2026-10-15T10:00:00Z' },
      { id: '2', takenAt: '2026-10-20T10:00:00Z' },
      { id: '3', takenAt: '2026-09-05T10:00:00Z' }
    ];

    const groups = groupMediaByDate(items);
    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe('October 2026');
    expect(groups[0].items).toHaveLength(2);
    expect(groups[1].key).toBe('September 2026');
    expect(groups[1].items).toHaveLength(1);
  });

  test('getTargetRowHeight responds to breakpoint widths', () => {
    expect(getTargetRowHeight(400)).toBe(120);
    expect(getTargetRowHeight(800)).toBe(160);
    expect(getTargetRowHeight(1200)).toBe(220);
  });
});

