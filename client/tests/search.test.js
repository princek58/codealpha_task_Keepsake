/**
 * @jest-environment jsdom
 */

import { debounce } from '../js/ui.js';

describe('Search Debounce and Abort Handling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('debounces search invocations by specified wait time', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced('w');
    debounced('wi');
    debounced('wil');

    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('wil');
  });

  test('cancels stale requests using AbortController', async () => {
    let currentAbortController = null;
    const completedResults = [];

    async function executeSearch(query) {
      if (currentAbortController) {
        currentAbortController.abort();
      }
      currentAbortController = new AbortController();
      const signal = currentAbortController.signal;

      try {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 50);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
        completedResults.push(query);
      } catch (err) {
        if (err.name !== 'AbortError') throw err;
      }
    }

    const p1 = executeSearch('first-query');
    const p2 = executeSearch('second-query');

    jest.advanceTimersByTime(60);
    await Promise.all([p1, p2]);

    expect(completedResults).toEqual(['second-query']);
  });
});

