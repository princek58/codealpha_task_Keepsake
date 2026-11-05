/**
 * @jest-environment jsdom
 */

describe('Reorder Math and Keyboard Moves', () => {
  function moveItem(array, fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= array.length) return array;
    if (toIndex < 0 || toIndex >= array.length) return array;
    if (fromIndex === toIndex) return array;

    const copy = [...array];
    const [item] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, item);
    return copy;
  }

  function moveEarlier(array, index) {
    if (index <= 0) return array;
    return moveItem(array, index, index - 1);
  }

  function moveLater(array, index) {
    if (index >= array.length - 1) return array;
    return moveItem(array, index, index + 1);
  }

  const list = ['A', 'B', 'C', 'D'];

  test('moves item earlier correctly', () => {
    const updated = moveEarlier(list, 2); // 'C' moved before 'B'
    expect(updated).toEqual(['A', 'C', 'B', 'D']);
  });

  test('cannot move first item earlier', () => {
    const updated = moveEarlier(list, 0);
    expect(updated).toEqual(list);
  });

  test('moves item later correctly', () => {
    const updated = moveLater(list, 1); // 'B' moved after 'C'
    expect(updated).toEqual(['A', 'C', 'B', 'D']);
  });

  test('cannot move last item later', () => {
    const updated = moveLater(list, 3);
    expect(updated).toEqual(list);
  });

  test('handles keyboard shortcuts simulation (Alt+Left, Alt+Right)', () => {
    let currentList = ['alpha', 'beta', 'gamma'];
    let focusedIndex = 1; // 'beta'

    function handleKeyDown(key, altKey) {
      if (altKey && key === 'ArrowLeft') {
        currentList = moveEarlier(currentList, focusedIndex);
        if (focusedIndex > 0) focusedIndex--;
      } else if (altKey && key === 'ArrowRight') {
        currentList = moveLater(currentList, focusedIndex);
        if (focusedIndex < currentList.length - 1) focusedIndex++;
      }
    }

    handleKeyDown('ArrowLeft', true);
    expect(currentList).toEqual(['beta', 'alpha', 'gamma']);
    expect(focusedIndex).toBe(0);

    // Cannot move earlier than 0
    handleKeyDown('ArrowLeft', true);
    expect(currentList).toEqual(['beta', 'alpha', 'gamma']);
    expect(focusedIndex).toBe(0);

    handleKeyDown('ArrowRight', true);
    expect(currentList).toEqual(['alpha', 'beta', 'gamma']);
    expect(focusedIndex).toBe(1);
  });
});

