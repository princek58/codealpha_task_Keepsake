// Keepsake Justified Gallery Layout & Renderer Module
import { buildMediaTile, debounce } from './ui.js';

/**
 * Pure layout algorithm computing justified rows for media items.
 * @param {Array} items - List of media items with width and height
 * @param {number} containerWidth - Pixel width of the container
 * @param {number} targetRowHeight - Target row height in pixels
 * @param {number} gap - Gap between items in pixels
 * @returns {Array} List of rows: [ { height, items: [ { item, width, height } ] } ]
 */
export function computeJustifiedRows(items, containerWidth, targetRowHeight = 220, gap = 8) {
  if (!Array.isArray(items) || items.length === 0 || containerWidth <= 0) {
    return [];
  }

  const rows = [];
  let currentRow = [];
  let currentAspectSum = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rawW = Number(item.width) || 400;
    const rawH = Number(item.height) || 300;
    // Constrain extreme aspect ratios for visual harmony (0.4 to 3.0)
    const aspect = Math.min(3.0, Math.max(0.4, rawW / rawH));

    currentRow.push({ item, aspect });
    currentAspectSum += aspect;

    const totalGaps = (currentRow.length - 1) * gap;
    const projectedWidth = currentAspectSum * targetRowHeight + totalGaps;

    if (projectedWidth >= containerWidth) {
      // Row is full. Calculate exact row height to fill containerWidth
      const availableWidth = containerWidth - totalGaps;
      const computedHeight = Math.round(availableWidth / currentAspectSum);

      const rowItems = [];
      let accumulatedWidth = 0;

      for (let j = 0; j < currentRow.length; j++) {
        let itemWidth;
        if (j === currentRow.length - 1) {
          // Snap last item to fill exact remaining pixels
          itemWidth = availableWidth - accumulatedWidth;
        } else {
          itemWidth = Math.round(currentRow[j].aspect * computedHeight);
          accumulatedWidth += itemWidth;
        }
        rowItems.push({
          item: currentRow[j].item,
          width: itemWidth,
          height: computedHeight
        });
      }

      rows.push({ height: computedHeight, items: rowItems });
      currentRow = [];
      currentAspectSum = 0;
    }
  }

  // Handle remaining items in the last row
  if (currentRow.length > 0) {
    const totalGaps = (currentRow.length - 1) * gap;
    const availableWidth = containerWidth - totalGaps;
    const naturalHeight = Math.round(availableWidth / currentAspectSum);

    // Rule: Don't stretch last row if it would exceed targetRowHeight by more than 35%
    const finalHeight = naturalHeight > targetRowHeight * 1.35 ? targetRowHeight : naturalHeight;

    const rowItems = currentRow.map((entry) => ({
      item: entry.item,
      width: Math.round(entry.aspect * finalHeight),
      height: finalHeight
    }));

    rows.push({ height: finalHeight, items: rowItems, isLastRow: true });
  }

  return rows;
}

/**
 * Groups media items by year/month based on takenAt or createdAt
 * @param {Array} items
 * @returns {Array} [ { key: 'October 2026', year: 2026, month: 9, items: [...] } ]
 */
export function groupMediaByDate(items) {
  if (!Array.isArray(items)) return [];

  const groups = new Map();
  for (const item of items) {
    const rawDate = item.takenAt || item.createdAt;
    const d = rawDate ? new Date(rawDate) : new Date();
    const key = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d);

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        year: d.getFullYear(),
        month: d.getMonth(),
        items: []
      });
    }
    groups.get(key).items.push(item);
  }

  return Array.from(groups.values());
}

/**
 * Returns responsive target row height based on container or window width
 */
export function getTargetRowHeight(width = window.innerWidth) {
  if (width < 640) return 120;
  if (width < 1024) return 160;
  return 220;
}

/**
 * Creates and mounts a justified gallery
 */
export class JustifiedGallery {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      gap: 8,
      selectable: false,
      token: null,
      onTileClick: null,
      onSelectionChange: null,
      onLoadMore: null,
      ...options
    };

    this.items = [];
    this.selectedIds = new Set();
    this.lastSelectedIndex = -1;
    this.resizeObserver = null;
    this.sentinelObserver = null;

    this.init();
  }

  init() {
    this.container.classList.add('justified-gallery');
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.gap = `${this.options.gap}px`;

    // Debounced layout update on resize
    const handleResize = debounce(() => {
      this.layout();
    }, 150);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => handleResize());
      this.resizeObserver.observe(this.container);
    } else {
      window.addEventListener('resize', handleResize);
    }
  }

  setItems(items) {
    this.items = items || [];
    this.layout();
  }

  appendItems(newItems) {
    if (!newItems || newItems.length === 0) return;
    this.items = this.items.concat(newItems);
    this.layout();
  }

  setSelectable(selectable) {
    this.options.selectable = Boolean(selectable);
    if (!this.options.selectable) {
      this.selectedIds.clear();
      this.lastSelectedIndex = -1;
    }
    this.layout();
    if (this.options.onSelectionChange) {
      this.options.onSelectionChange(Array.from(this.selectedIds));
    }
  }

  getSelectedIds() {
    return Array.from(this.selectedIds);
  }

  layout() {
    const width = this.container.clientWidth;
    if (width <= 0) return;

    this.container.innerHTML = '';
    const targetHeight = getTargetRowHeight(width);
    const rows = computeJustifiedRows(this.items, width, targetHeight, this.options.gap);

    let globalIndex = 0;

    for (const row of rows) {
      const rowEl = document.createElement('div');
      rowEl.className = 'gallery-row';
      rowEl.style.display = 'flex';
      rowEl.style.gap = `${this.options.gap}px`;
      rowEl.style.height = `${row.height}px`;

      for (const entry of row.items) {
        const itemIndex = globalIndex++;
        const itemId = entry.item.id || entry.item._id;
        const isSelected = this.selectedIds.has(itemId);

        const tile = buildMediaTile(entry.item, {
          token: this.options.token,
          selectable: this.options.selectable,
          selected: isSelected
        });

        tile.style.width = `${entry.width}px`;
        tile.style.height = `${entry.height}px`;
        tile.style.flexShrink = '0';

        tile.onclick = (e) => {
          if (this.options.selectable) {
            this.handleTileSelection(itemIndex, itemId, e.shiftKey);
          } else if (this.options.onTileClick) {
            this.options.onTileClick({
              item: entry.item,
              index: itemIndex,
              tileElement: tile,
              items: this.items
            });
          }
        };

        tile.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            tile.click();
          }
        };

        rowEl.appendChild(tile);
      }

      this.container.appendChild(rowEl);
    }

    // Attach sentinel for infinite scroll if callback provided
    if (this.options.onLoadMore) {
      this.setupSentinel();
    }
  }

  handleTileSelection(index, id, isShiftKey) {
    if (isShiftKey && this.lastSelectedIndex !== -1) {
      // Range select
      const start = Math.min(this.lastSelectedIndex, index);
      const end = Math.max(this.lastSelectedIndex, index);
      for (let i = start; i <= end; i++) {
        const currentId = this.items[i].id || this.items[i]._id;
        this.selectedIds.add(currentId);
      }
    } else {
      if (this.selectedIds.has(id)) {
        this.selectedIds.delete(id);
      } else {
        this.selectedIds.add(id);
      }
      this.lastSelectedIndex = index;
    }

    this.layout();
    if (this.options.onSelectionChange) {
      this.options.onSelectionChange(Array.from(this.selectedIds));
    }
  }

  setupSentinel() {
    if (this.sentinelEl) {
      this.sentinelEl.remove();
    }

    this.sentinelEl = document.createElement('div');
    this.sentinelEl.className = 'gallery-sentinel';
    this.sentinelEl.style.height = '1px';
    this.container.appendChild(this.sentinelEl);

    if (this.sentinelObserver) {
      this.sentinelObserver.disconnect();
    }

    this.sentinelObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        this.options.onLoadMore();
      }
    });

    this.sentinelObserver.observe(this.sentinelEl);
  }

  destroy() {
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.sentinelObserver) this.sentinelObserver.disconnect();
    this.container.innerHTML = '';
  }
}

