// Keepsake Collage Templates Definitions & Helpers

export const COLLAGE_TEMPLATES = {
  'collage-1x2': {
    id: 'collage-1x2',
    label: 'Split Vertical',
    itemCount: 2,
    allowedCounts: [2],
    columns: '1fr 1fr',
    rows: '1fr',
    areas: '"a b"',
    aspectRatio: '16 / 9'
  },
  'collage-2x1': {
    id: 'collage-2x1',
    label: 'Split Horizontal',
    itemCount: 2,
    allowedCounts: [2],
    columns: '1fr',
    rows: '1fr 1fr',
    areas: '"a" "b"',
    aspectRatio: '4 / 3'
  },
  'collage-1-2': {
    id: 'collage-1-2',
    label: 'Feature Left',
    itemCount: 3,
    allowedCounts: [3],
    columns: '2fr 1fr',
    rows: '1fr 1fr',
    areas: '"a b" "a c"',
    aspectRatio: '16 / 10'
  },
  'collage-2-1': {
    id: 'collage-2-1',
    label: 'Feature Right',
    itemCount: 3,
    allowedCounts: [3],
    columns: '1fr 2fr',
    rows: '1fr 1fr',
    areas: '"a c" "b c"',
    aspectRatio: '16 / 10'
  },
  'collage-3col': {
    id: 'collage-3col',
    label: 'Three Columns',
    itemCount: 3,
    allowedCounts: [3],
    columns: '1fr 1fr 1fr',
    rows: '1fr',
    areas: '"a b c"',
    aspectRatio: '16 / 9'
  },
  'collage-2x2': {
    id: 'collage-2x2',
    label: 'Quad Grid',
    itemCount: 4,
    allowedCounts: [4],
    columns: '1fr 1fr',
    rows: '1fr 1fr',
    areas: '"a b" "c d"',
    aspectRatio: '1 / 1'
  },
  'collage-1-3': {
    id: 'collage-1-3',
    label: 'Hero & Sidebar',
    itemCount: 4,
    allowedCounts: [4],
    columns: '3fr 1fr',
    rows: '1fr 1fr 1fr',
    areas: '"a b" "a c" "a d"',
    aspectRatio: '16 / 10'
  },
  'collage-1-4': {
    id: 'collage-1-4',
    label: 'Hero & Strip',
    itemCount: 5,
    allowedCounts: [5],
    columns: '1fr 1fr 1fr 1fr',
    rows: '2fr 1fr',
    areas: '"a a a a" "b c d e"',
    aspectRatio: '4 / 3'
  },
  'collage-2x3': {
    id: 'collage-2x3',
    label: 'Six Pack Vertical',
    itemCount: 6,
    allowedCounts: [6],
    columns: '1fr 1fr',
    rows: '1fr 1fr 1fr',
    areas: '"a b" "c d" "e f"',
    aspectRatio: '2 / 3'
  },
  'collage-3x2': {
    id: 'collage-3x2',
    label: 'Six Pack Horizontal',
    itemCount: 6,
    allowedCounts: [6],
    columns: '1fr 1fr 1fr',
    rows: '1fr 1fr',
    areas: '"a b c" "d e f"',
    aspectRatio: '3 / 2'
  },
  'collage-3x3': {
    id: 'collage-3x3',
    label: 'Nine Grid',
    itemCount: 9,
    allowedCounts: [9],
    columns: '1fr 1fr 1fr',
    rows: '1fr 1fr 1fr',
    areas: '"a b c" "d e f" "g h i"',
    aspectRatio: '1 / 1'
  },
  'collage-mosaic': {
    id: 'collage-mosaic',
    label: 'Mosaic Flow',
    itemCount: 5,
    allowedCounts: [3, 4, 5, 6, 7, 8, 9, 10],
    columns: '2fr 1fr 1fr',
    rows: '1fr 1fr',
    areas: '"a b c" "a d e"',
    aspectRatio: '16 / 10'
  }
};

const AREA_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

export function getTemplateById(id) {
  return COLLAGE_TEMPLATES[id] || COLLAGE_TEMPLATES['collage-1-2'];
}

export function templatesForCount(count) {
  const n = Number(count) || 0;
  return Object.values(COLLAGE_TEMPLATES).filter((tmpl) =>
    tmpl.allowedCounts.includes(n)
  );
}

export function getDefaultTemplate(count) {
  if (count === 2) return 'collage-1x2';
  if (count === 3) return 'collage-1-2';
  if (count === 4) return 'collage-2x2';
  if (count === 5) return 'collage-1-4';
  if (count === 6) return 'collage-3x2';
  if (count >= 7 && count <= 9) return 'collage-3x3';
  if (count === 10) return 'collage-mosaic';

  const matches = templatesForCount(count);
  if (matches.length > 0) return matches[0].id;
  return 'collage-mosaic';
}

/**
 * Returns an SVG element preview of the template grid
 */
export function renderTemplatePreview(templateId, size = 48) {
  const tmpl = getTemplateById(templateId);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 48 36');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(Math.round(size * 0.75)));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1');

  // Parse areas to draw rectangles
  const rows = tmpl.areas.replace(/"/g, '').split(' ');
  const totalRows = rows.length;
  const totalCols = rows[0].split('').length;

  const w = 48 / totalCols;
  const h = 36 / totalRows;

  const seen = new Set();
  rows.forEach((r, rowIdx) => {
    r.split('').forEach((letter, colIdx) => {
      if (!seen.has(letter)) {
        seen.add(letter);
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', String(colIdx * w + 1));
        rect.setAttribute('y', String(rowIdx * h + 1));
        rect.setAttribute('width', String(w - 2));
        rect.setAttribute('height', String(h - 2));
        rect.setAttribute('rx', '2');
        rect.setAttribute('fill', 'var(--color-sand)');
        svg.appendChild(rect);
      }
    });
  });

  return svg;
}

