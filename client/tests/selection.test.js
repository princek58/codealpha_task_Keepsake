/**
 * @jest-environment jsdom
 */

describe('Selection Management (Single, Range, Select All, Clear)', () => {
  class SelectionManager {
    constructor(items = []) {
      this.items = items;
      this.selected = new Set();
      this.lastSelectedIndex = -1;
    }

    toggle(id, index, shiftKey = false) {
      if (shiftKey && this.lastSelectedIndex !== -1 && index !== -1) {
        const start = Math.min(this.lastSelectedIndex, index);
        const end = Math.max(this.lastSelectedIndex, index);
        for (let i = start; i <= end; i++) {
          this.selected.add(this.items[i].id);
        }
      } else {
        if (this.selected.has(id)) {
          this.selected.delete(id);
        } else {
          this.selected.add(id);
        }
        this.lastSelectedIndex = index;
      }
      return Array.from(this.selected);
    }

    selectAll() {
      this.items.forEach((item) => this.selected.add(item.id));
      return Array.from(this.selected);
    }

    clear() {
      this.selected.clear();
      this.lastSelectedIndex = -1;
      return [];
    }

    isSelected(id) {
      return this.selected.has(id);
    }

    get count() {
      return this.selected.size;
    }
  }

  const sampleItems = [
    { id: 'item-1', name: 'Photo 1' },
    { id: 'item-2', name: 'Photo 2' },
    { id: 'item-3', name: 'Photo 3' },
    { id: 'item-4', name: 'Photo 4' },
    { id: 'item-5', name: 'Photo 5' }
  ];

  test('toggles single item selection', () => {
    const sm = new SelectionManager(sampleItems);
    sm.toggle('item-1', 0, false);
    expect(sm.count).toBe(1);
    expect(sm.isSelected('item-1')).toBe(true);

    sm.toggle('item-1', 0, false);
    expect(sm.count).toBe(0);
    expect(sm.isSelected('item-1')).toBe(false);
  });

  test('supports shift-click range selection between indices', () => {
    const sm = new SelectionManager(sampleItems);
    // Click item 1 (index 1)
    sm.toggle('item-2', 1, false);
    expect(sm.count).toBe(1);

    // Shift click item 4 (index 3)
    sm.toggle('item-4', 3, true);
    expect(sm.count).toBe(3);
    expect(sm.isSelected('item-2')).toBe(true);
    expect(sm.isSelected('item-3')).toBe(true);
    expect(sm.isSelected('item-4')).toBe(true);
    expect(sm.isSelected('item-1')).toBe(false);
    expect(sm.isSelected('item-5')).toBe(false);
  });

  test('selects all items and clears selection', () => {
    const sm = new SelectionManager(sampleItems);
    sm.selectAll();
    expect(sm.count).toBe(5);
    sampleItems.forEach((item) => expect(sm.isSelected(item.id)).toBe(true));

    sm.clear();
    expect(sm.count).toBe(0);
    sampleItems.forEach((item) => expect(sm.isSelected(item.id)).toBe(false));
  });
});

