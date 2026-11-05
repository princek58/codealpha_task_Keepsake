/**
 * @jest-environment jsdom
 */

describe('Notifications Polling & Exponential Backoff', () => {
  class NotificationPoller {
    constructor({ fetchFn, baseInterval = 30000, maxInterval = 120000 }) {
      this.fetchFn = fetchFn;
      this.baseInterval = baseInterval;
      this.maxInterval = maxInterval;
      this.currentInterval = baseInterval;
      this.consecutiveErrors = 0;
      this.timer = null;
      this.isPolling = false;
    }

    start() {
      this.isPolling = true;
      this.scheduleNext();
    }

    stop() {
      this.isPolling = false;
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
    }

    scheduleNext() {
      if (!this.isPolling) return;
      this.timer = setTimeout(() => this.tick(), this.currentInterval);
    }

    async tick() {
      // Pause polling if tab is hidden
      if (document.visibilityState === 'hidden') {
        this.scheduleNext();
        return;
      }

      try {
        await this.fetchFn();
        this.consecutiveErrors = 0;
        this.currentInterval = this.baseInterval;
      } catch {
        this.consecutiveErrors++;
        // Exponential backoff with ceiling
        this.currentInterval = Math.min(
          this.maxInterval,
          this.baseInterval * Math.pow(2, Math.min(this.consecutiveErrors, 3))
        );
      } finally {
        this.scheduleNext();
      }
    }
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('pauses fetch execution when document is hidden', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ count: 0 });
    const poller = new NotificationPoller({ fetchFn: mockFetch, baseInterval: 1000 });

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true
    });

    poller.start();
    jest.advanceTimersByTime(1500);

    expect(mockFetch).not.toHaveBeenCalled();
    poller.stop();
  });

  test('applies exponential backoff on consecutive fetch failures', async () => {
    let callCount = 0;
    const mockFetch = jest.fn().mockImplementation(() => {
      callCount++;
      return Promise.reject(new Error('Network error'));
    });

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true
    });

    const poller = new NotificationPoller({ fetchFn: mockFetch, baseInterval: 1000, maxInterval: 8000 });
    poller.start();

    // 1st tick at 1000ms fails -> interval becomes 2000ms
    await jest.advanceTimersByTimeAsync(1000);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(poller.currentInterval).toBe(2000);

    // 2nd tick at +2000ms fails -> interval becomes 4000ms
    await jest.advanceTimersByTimeAsync(2000);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(poller.currentInterval).toBe(4000);

    poller.stop();
  });
});

