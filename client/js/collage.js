// Keepsake Collage & Layout Renderer Module
import { getTemplateById } from './collage-templates.js';
import { getMediaUrl } from './media-url.js';
import { icon } from './icons.js';
import { buildMediaTile } from './ui.js';

const AREA_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

/**
 * Renders a collage grid inside a container element
 */
export function renderCollage(container, {
  items = [],
  template = 'collage-1-2',
  gap = 8,
  background = 'var(--color-white)',
  token = null,
  onTileClick = null
} = {}) {
  container.innerHTML = '';
  container.className = 'collage-container';

  const tmpl = getTemplateById(template);
  container.style.display = 'grid';
  container.style.gridTemplateColumns = tmpl.columns;
  container.style.gridTemplateRows = tmpl.rows;
  container.style.gridTemplateAreas = tmpl.areas;
  container.style.gap = `${gap}px`;
  container.style.backgroundColor = background;
  container.style.aspectRatio = tmpl.aspectRatio || '16 / 10';
  container.style.borderRadius = 'var(--radius-lg)';
  container.style.overflow = 'hidden';
  container.style.padding = `${gap}px`;

  items.slice(0, 10).forEach((item, index) => {
    const letter = AREA_LETTERS[index];
    const cell = document.createElement('div');
    cell.className = 'collage-cell';
    cell.style.gridArea = letter;
    cell.style.position = 'relative';
    cell.style.overflow = 'hidden';
    cell.style.borderRadius = 'var(--radius-sm)';
    cell.style.backgroundColor = 'var(--color-sand)';
    cell.style.cursor = 'pointer';

    if (item.blurDataUrl) {
      cell.style.backgroundImage = `url("${item.blurDataUrl}")`;
      cell.style.backgroundSize = 'cover';
    }

    const img = document.createElement('img');
    img.src = getMediaUrl(item, 'display', token);
    img.alt = item.caption || 'Collage photo';
    img.loading = 'lazy';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.display = 'block';
    img.style.transition = 'transform 300ms ease';
    cell.appendChild(img);

    cell.onmouseenter = () => { img.style.transform = 'scale(1.03)'; };
    cell.onmouseleave = () => { img.style.transform = 'none'; };

    if (item.type === 'video') {
      const badge = document.createElement('div');
      badge.className = 'media-badge';
      badge.style.position = 'absolute';
      badge.style.bottom = '8px';
      badge.style.right = '8px';
      badge.appendChild(icon('play', { size: 12 }));
      cell.appendChild(badge);
    }

    cell.onclick = (e) => {
      if (onTileClick) {
        onTileClick({ item, index, cellElement: cell, items });
      }
    };

    container.appendChild(cell);
  });

  return container;
}

/**
 * Universal layout renderer handling collage, grid, and carousel
 */
export function renderLayout(container, moment, options = {}) {
  if (!container || !moment || !Array.isArray(moment.media)) return;

  const layoutType = moment.layout?.type || 'grid';
  const items = moment.media;

  if (layoutType === 'collage' && items.length >= 2) {
    return renderCollage(container, {
      items,
      template: moment.layout.template || 'collage-1-2',
      gap: moment.layout.gap ?? 8,
      background: moment.layout.background || 'var(--color-white)',
      token: options.token,
      onTileClick: options.onTileClick
    });
  }

  if (layoutType === 'carousel' && items.length > 1) {
    return renderCarousel(container, items, options);
  }

  // Default: Grid
  return renderUniformGrid(container, items, moment.layout?.gap ?? 8, options);
}

function renderUniformGrid(container, items, gap = 8, options = {}) {
  container.innerHTML = '';
  container.className = 'moment-grid';
  container.style.display = 'grid';
  container.style.gap = `${gap}px`;

  const count = items.length;
  if (count === 1) {
    container.style.gridTemplateColumns = '1fr';
  } else if (count === 2) {
    container.style.gridTemplateColumns = '1fr 1fr';
  } else if (count === 3) {
    container.style.gridTemplateColumns = 'repeat(3, 1fr)';
  } else {
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
  }

  items.forEach((item, index) => {
    const tile = buildMediaTile(item, {
      token: options.token,
      selectable: options.selectable
    });
    tile.style.aspectRatio = '4 / 3';

    tile.onclick = () => {
      if (options.onTileClick) {
        options.onTileClick({ item, index, tileElement: tile, items });
      }
    };

    container.appendChild(tile);
  });

  return container;
}

function renderCarousel(container, items, options = {}) {
  container.innerHTML = '';
  container.className = 'carousel-container';
  container.style.position = 'relative';

  const track = document.createElement('div');
  track.className = 'carousel-track';
  track.style.display = 'flex';
  track.style.gap = '8px';
  track.style.overflowX = 'auto';
  track.style.scrollSnapType = 'x mandatory';
  track.style.scrollbarWidth = 'none';

  items.forEach((item, index) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    slide.style.flex = '0 0 100%';
    slide.style.scrollSnapAlign = 'center';
    slide.style.aspectRatio = '16 / 10';
    slide.style.borderRadius = 'var(--radius-lg)';
    slide.style.overflow = 'hidden';

    const tile = buildMediaTile(item, { token: options.token });
    tile.style.width = '100%';
    tile.style.height = '100%';
    tile.onclick = () => {
      if (options.onTileClick) {
        options.onTileClick({ item, index, tileElement: tile, items });
      }
    };

    slide.appendChild(tile);
    track.appendChild(slide);
  });

  container.appendChild(track);

  // Indicators / dots
  const dots = document.createElement('div');
  dots.className = 'carousel-dots';
  dots.style.display = 'flex';
  dots.style.justifyContent = 'center';
  dots.style.gap = '6px';
  dots.style.padding = '8px 0';

  items.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = `segmented-item ${i === 0 ? 'active' : ''}`;
    dot.style.width = '8px';
    dot.style.height = '8px';
    dot.style.padding = '0';
    dot.style.borderRadius = 'var(--radius-pill)';
    dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
    dot.onclick = () => {
      track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
    };
    dots.appendChild(dot);
  });

  track.addEventListener('scroll', () => {
    const activeIndex = Math.round(track.scrollLeft / track.clientWidth);
    Array.from(dots.children).forEach((d, idx) => {
      if (idx === activeIndex) d.classList.add('active');
      else d.classList.remove('active');
    });
  }, { passive: true });

  container.appendChild(dots);
  return container;
}

/**
 * Off-screen canvas collage PNG exporter
 */
export async function exportCollagePng(items, templateId = 'collage-1-2', gap = 8, background = 'white', width = 1200) {
  // Validate that no video is present
  const hasVideo = items.some((item) => item.type === 'video');
  if (hasVideo) {
    throw new Error('Collage export only supports photos, not videos.');
  }

  const tmpl = getTemplateById(templateId);
  const rows = tmpl.areas.replace(/"/g, '').split(' ');
  const totalRows = rows.length;
  const totalCols = rows[0].split('').length;

  const aspectParts = (tmpl.aspectRatio || '16 / 10').split('/').map((s) => Number(s.trim()));
  const aspect = aspectParts[0] / aspectParts[1];
  const height = Math.round(width / aspect);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Fill background
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const colWidth = (width - gap * (totalCols + 1)) / totalCols;
  const rowHeight = (height - gap * (totalRows + 1)) / totalRows;

  // Compute bounding boxes for each area letter
  const bounds = {};
  rows.forEach((r, rowIdx) => {
    r.split('').forEach((letter, colIdx) => {
      if (!bounds[letter]) {
        bounds[letter] = {
          minCol: colIdx,
          maxCol: colIdx,
          minRow: rowIdx,
          maxRow: rowIdx
        };
      } else {
        bounds[letter].minCol = Math.min(bounds[letter].minCol, colIdx);
        bounds[letter].maxCol = Math.max(bounds[letter].maxCol, colIdx);
        bounds[letter].minRow = Math.min(bounds[letter].minRow, rowIdx);
        bounds[letter].maxRow = Math.max(bounds[letter].maxRow, rowIdx);
      }
    });
  });

  // Load and draw each image
  for (let i = 0; i < items.length; i++) {
    const letter = AREA_LETTERS[i];
    const b = bounds[letter];
    if (!b) continue;

    const cellX = gap + b.minCol * (colWidth + gap);
    const cellY = gap + b.minRow * (rowHeight + gap);
    const cellW = (b.maxCol - b.minCol + 1) * colWidth + (b.maxCol - b.minCol) * gap;
    const cellH = (b.maxRow - b.minRow + 1) * rowHeight + (b.maxRow - b.minRow) * gap;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = getMediaUrl(items[i], 'display');

    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load image for export: ${img.src}`));
    });

    // Object-fit cover draw calculation
    const imgAspect = img.width / img.height;
    const cellAspect = cellW / cellH;

    let srcX = 0;
    let srcY = 0;
    let srcW = img.width;
    let srcH = img.height;

    if (imgAspect > cellAspect) {
      srcW = img.height * cellAspect;
      srcX = (img.width - srcW) / 2;
    } else {
      srcH = img.width / cellAspect;
      srcY = (img.height - srcH) / 2;
    }

    ctx.save();
    // Rounded cell clip
    ctx.beginPath();
    const r = 8;
    ctx.moveTo(cellX + r, cellY);
    ctx.arcTo(cellX + cellW, cellY, cellX + cellW, cellY + cellH, r);
    ctx.arcTo(cellX + cellW, cellY + cellH, cellX, cellY + cellH, r);
    ctx.arcTo(cellX, cellY + cellH, cellX, cellY, r);
    ctx.arcTo(cellX, cellY, cellX + cellW, cellY, r);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(img, srcX, srcY, srcW, srcH, cellX, cellY, cellW, cellH);
    ctx.restore();
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas blob export failed'));
    }, 'image/png');
  });
}

/**
 * Browser download helper for generated Blob
 */
export function downloadBlob(blob, filename = 'keepsake-collage.png') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
