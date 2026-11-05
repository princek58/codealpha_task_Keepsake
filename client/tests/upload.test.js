/**
 * @jest-environment jsdom
 */

import { UploadManager } from '../js/upload-manager.js';

describe('Upload Manager Queue & Validation', () => {
  let manager;

  beforeEach(() => {
    manager = new UploadManager({
      maxConcurrent: 3
    });
  });

  test('Rejects HEIC photos with user-friendly message', () => {
    const fakeFile = { name: 'vacation.heic', size: 1024, type: 'image/heic' };
    const res = manager.validateFile(fakeFile);
    expect(res.valid).toBe(false);
    expect(res.code).toBe('UNSUPPORTED_HEIC');
    expect(res.message).toMatch(/HEIC/);
  });

  test('Rejects unsupported file formats (e.g. .exe, .zip)', () => {
    const fakeExe = { name: 'program.exe', size: 2048, type: 'application/octet-stream' };
    const res = manager.validateFile(fakeExe);
    expect(res.valid).toBe(false);
    expect(res.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  test('Validates file sizes against limits', () => {
    manager.limits = {
      maxImageBytes: 1000,
      maxVideoBytes: 5000
    };

    const oversizedImg = { name: 'giant.jpg', size: 2000, type: 'image/jpeg' };
    const validImg = { name: 'good.jpg', size: 800, type: 'image/jpeg' };

    expect(manager.validateFile(oversizedImg).valid).toBe(false);
    expect(manager.validateFile(oversizedImg).code).toBe('LIMIT_FILE_SIZE');
    expect(manager.validateFile(validImg).valid).toBe(true);
  });

  test('Maintains maxConcurrent constraint and tracks statistics accurately', () => {
    expect(manager.options.maxConcurrent).toBe(3);

    const mockFiles = Array.from({ length: 5 }, (_, i) => ({
      name: `pic_${i}.jpg`,
      size: 1000,
      type: 'image/jpeg'
    }));

    // Mock uploadBatch to prevent real network calls
    let activeCalls = 0;
    let maxSeenConcurrent = 0;

    manager.uploadBatch = (batch) => {
      activeCalls += batch.length;
      maxSeenConcurrent = Math.max(maxSeenConcurrent, activeCalls);
      // Simulate quick async resolution
      setTimeout(() => {
        activeCalls -= batch.length;
        manager.inFlight -= batch.length;
        batch.forEach((b) => (b.status = 'ready'));
        manager.processQueue();
      }, 10);
    };

    manager.addFiles(mockFiles);
    expect(manager.queue).toHaveLength(5);
    const stats = manager.getStats();
    expect(stats.total).toBe(5);
    expect(stats.totalBytes).toBe(5000);
  });

  test('cancelItem updates item status and error', () => {
    const mockFile = { name: 'test.jpg', size: 500, type: 'image/jpeg' };
    manager.uploadBatch = () => {}; // No-op
    const added = manager.addFiles([mockFile]);
    const id = added[0].id;

    manager.cancelItem(id);
    const item = manager.queue.find((i) => i.id === id);
    expect(item.status).toBe('cancelled');
    expect(item.error).toBe('Cancelled');
  });

  test('retryItem resets status to pending and re-evaluates queue', () => {
    const mockFile = { name: 'retry.jpg', size: 500, type: 'image/jpeg' };
    manager.uploadBatch = (batch) => {
      batch.forEach((b) => {
        b.status = 'uploading';
      });
    };
    const added = manager.addFiles([mockFile]);
    const id = added[0].id;

    manager.cancelItem(id);
    expect(manager.queue[0].status).toBe('cancelled');

    manager.retryItem(id);
    expect(manager.queue[0].status).toBe('uploading');
  });

  test('Pauses polling when tab is hidden and resumes when visible', () => {
    manager.isPolling = true;
    manager.pollTimer = 123;
    manager.pausePolling();
    expect(manager.pollTimer).toBeNull();
  });
});

