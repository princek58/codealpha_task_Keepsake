const fs = require('fs');
const EventEmitter = require('events');
const config = require('../../config');
const storage = require('../storage');
const Media = require('../../models/Media');
const User = require('../../models/User');
const { processVideo } = require('./videoProcessor');

class MediaQueue extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.runningCount = 0;
  }

  get concurrency() {
    return config.videoConcurrency || 1;
  }

  addJob(job) {
    this.queue.push(job);
    process.nextTick(() => this.next());
  }

  async next() {
    if (this.runningCount >= this.concurrency || this.queue.length === 0) {
      if (this.queue.length === 0 && this.runningCount === 0) {
        this.emit('idle');
      }
      return;
    }

    const job = this.queue.shift();
    this.runningCount++;

    try {
      await this.executeJob(job);
    } catch (err) {
      // Error handled inside executeJob
    } finally {
      this.runningCount--;
      process.nextTick(() => this.next());
    }
  }

  async executeJob(job) {
    const { mediaId, userId, sourcePath, ext, uploadedSizeBytes } = job;

    try {
      const media = await Media.findById(mediaId);
      if (!media) {
        // Media doc was deleted while queued
        try {
          await fs.promises.unlink(sourcePath);
        } catch {}
        return;
      }

      const result = await processVideo({
        userId,
        mediaId,
        sourcePath,
        ext
      });

      // Check quota post-processing: current storage used + new size - initially reserved uploaded size
      const user = await User.findById(userId);
      const userUsed = user?.storageUsedBytes || 0;
      const netSizeChange = result.sizeBytes - (uploadedSizeBytes || 0);

      if (userUsed + netSizeChange > config.userQuotaBytes) {
        // Quota exceeded
        await storage.remove(`${userId}/${mediaId}`);
        await Media.findByIdAndUpdate(mediaId, {
          status: 'failed',
          failureReason: 'QUOTA_EXCEEDED'
        });
        if (uploadedSizeBytes > 0) {
          await User.findByIdAndUpdate(userId, {
            $inc: { storageUsedBytes: -uploadedSizeBytes }
          });
        }
        return;
      }

      // Update media doc to ready
      await Media.findByIdAndUpdate(mediaId, {
        status: 'ready',
        width: result.width,
        height: result.height,
        durationSec: result.durationSec,
        takenAt: result.takenAt || media.takenAt || null,
        blurDataUrl: result.blurDataUrl,
        sizeBytes: result.sizeBytes,
        paths: result.paths,
        failureReason: null
      });

      // Update user storage atomically
      if (netSizeChange !== 0) {
        await User.findByIdAndUpdate(userId, {
          $inc: { storageUsedBytes: netSizeChange }
        });
      }
    } catch (err) {
      await Media.findByIdAndUpdate(mediaId, {
        status: 'failed',
        failureReason: err.message || 'Video processing failed'
      });

      // Quota refund of the uploaded reservation
      if (uploadedSizeBytes > 0) {
        await User.findByIdAndUpdate(userId, {
          $inc: { storageUsedBytes: -uploadedSizeBytes }
        });
      }

      // Clean up any partial files in storage
      await storage.remove(`${userId}/${mediaId}`);
    } finally {
      try {
        await fs.promises.unlink(sourcePath);
      } catch {}
    }
  }

  async recoverDanglingProcessing() {
    try {
      const dangling = await Media.find({ status: 'processing' });
      for (const item of dangling) {
        // Check if any temp file exists for this media
        const tmpDir = storage.getTmpDir();
        let foundSource = null;
        try {
          const files = await fs.promises.readdir(tmpDir);
          const match = files.find((f) => f.includes(item._id.toString()));
          if (match) {
            foundSource = require('path').join(tmpDir, match);
          }
        } catch {}

        if (foundSource && fs.existsSync(foundSource)) {
          const ext = require('path').extname(foundSource).replace('.', '') || 'mp4';
          this.addJob({
            mediaId: item._id,
            userId: item.owner,
            sourcePath: foundSource,
            ext,
            uploadedSizeBytes: item.sizeBytes || 0
          });
        } else {
          await Media.findByIdAndUpdate(item._id, {
            status: 'failed',
            failureReason: 'PROCESSING_INTERRUPTED'
          });
          if (item.sizeBytes > 0) {
            await User.findByIdAndUpdate(item.owner, {
              $inc: { storageUsedBytes: -item.sizeBytes }
            });
          }
        }
      }
    } catch {
      // Non-fatal error during recovery
    }
  }

  waitForQueueIdle() {
    if (this.queue.length === 0 && this.runningCount === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.once('idle', resolve);
    });
  }
}

const mediaQueue = new MediaQueue();

module.exports = mediaQueue;

