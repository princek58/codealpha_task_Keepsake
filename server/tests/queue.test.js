const path = require('path');
const fs = require('fs');
const Media = require('../models/Media');
const User = require('../models/User');
const storage = require('../services/storage');
const mediaQueue = require('../services/media/queue');
const { connectTestDB, clearTestDB, closeTestDB } = require('./setup');
const { createTestUser } = require('./testHelper');

jest.setTimeout(30000);

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await connectTestDB();
});

afterEach(async () => {
  await clearTestDB();
  await storage.cleanTmp();
});

afterAll(async () => {
  await closeTestDB();
});

const generateTestVideoFile = (destPath) => {
  return new Promise((resolve, reject) => {
    const ffmpeg = require('ffmpeg-static');
    const { spawn } = require('child_process');
    const proc = spawn(ffmpeg, [
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=1:size=320x240:rate=30',
      '-c:v',
      'libx264',
      '-y',
      destPath
    ]);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Failed to generate video: code ${code}`));
    });
  });
};

describe('Queue Recovery at Boot', () => {
  test('Recovers dangling processing media if source exists, or marks failed otherwise', async () => {
    const { user } = await createTestUser();

    // 1. Media item with existing source file
    const itemWithFile = await Media.create({
      owner: user.id,
      type: 'video',
      status: 'processing',
      originalName: 'requeue_test.mp4',
      mime: 'video/mp4',
      sizeBytes: 5000
    });

    const tmpSource = path.join(
      storage.getTmpDir(),
      `upload_${itemWithFile._id}_test.mp4`
    );
    await generateTestVideoFile(tmpSource);

    // 2. Media item with missing source file
    const itemWithoutFile = await Media.create({
      owner: user.id,
      type: 'video',
      status: 'processing',
      originalName: 'lost_test.mp4',
      mime: 'video/mp4',
      sizeBytes: 3000
    });

    // Record reserved quota
    await User.findByIdAndUpdate(user.id, {
      storageUsedBytes: 8000
    });

    // Trigger boot recovery
    await mediaQueue.recoverDanglingProcessing();
    await mediaQueue.waitForQueueIdle();

    // Check item without file -> marked failed and quota refunded
    const updatedWithout = await Media.findById(itemWithoutFile._id);
    expect(updatedWithout.status).toBe('failed');
    expect(updatedWithout.failureReason).toBe('PROCESSING_INTERRUPTED');

    // Check item with file -> recovered, transcoded, and marked ready
    const updatedWith = await Media.findById(itemWithFile._id);
    expect(updatedWith.status).toBe('ready');
    expect(updatedWith.paths.video).toBeDefined();

    // Verify user storage was adjusted properly
    const updatedUser = await User.findById(user.id);
    expect(updatedUser.storageUsedBytes).toBe(updatedWith.sizeBytes);
  });
});

