const fs = require('fs');
const path = require('path');
const config = require('../config');
const storage = require('../services/storage');
const Media = require('../models/Media');
const User = require('../models/User');
const Moment = require('../models/Moment');
const Album = require('../models/Album');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const { detectFileType } = require('../services/media/fileType');
const { processImage } = require('../services/media/imageProcessor');
const mediaQueue = require('../services/media/queue');
const { canViewMedia } = require('../services/visibility');
const { formatMedia, getPagination } = require('../utils/formatters');

const deleteMediaCascade = async (mediaItems, userId) => {
  let deletedCount = 0;

  for (const media of mediaItems) {
    const mediaId = media._id;

    // 1. Remove physical files
    await storage.remove(`${userId}/${mediaId}`);

    // 2. Refund quota
    if (media.sizeBytes > 0) {
      await User.findByIdAndUpdate(userId, {
        $inc: { storageUsedBytes: -media.sizeBytes }
      });
    }

    // 3. Remove from Moments
    const moments = await Moment.find({ media: mediaId });
    for (const moment of moments) {
      moment.media = moment.media.filter((m) => m.toString() !== mediaId.toString());
      if (moment.media.length === 0) {
        // Cascade delete moment if zero media left
        await Moment.findByIdAndDelete(moment._id);
        await Comment.deleteMany({ moment: moment._id });
        await Notification.deleteMany({ moment: moment._id });
      } else {
        await moment.save();
      }
    }

    // 4. Remove from Albums
    const albums = await Album.find({
      $or: [{ media: mediaId }, { cover: mediaId }]
    });
    for (const album of albums) {
      album.media = album.media.filter((m) => m.toString() !== mediaId.toString());
      if (album.cover && album.cover.toString() === mediaId.toString()) {
        album.cover = album.media.length > 0 ? album.media[0] : null;
      }
      await album.save();
    }

    // 5. Delete document
    await Media.findByIdAndDelete(mediaId);
    deletedCount++;
  }

  return deletedCount;
};

const uploadMedia = async (req, res, next) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ message: 'No files provided' });
    }

    const items = [];
    const errors = [];

    for (const file of files) {
      const originalName = file.originalname;

      try {
        const detected = await detectFileType(file.path);
        if (!detected.ok) {
          errors.push({
            originalName,
            code: detected.code,
            message: detected.message
          });
          try {
            await fs.promises.unlink(file.path);
          } catch {}
          continue;
        }

        // Check file size limit by detected type
        if (detected.type === 'image' && file.size > config.maxImageBytes) {
          errors.push({
            originalName,
            code: 'FILE_TOO_LARGE',
            message: `Image size exceeds limit of ${config.maxImageMb}MB`
          });
          try {
            await fs.promises.unlink(file.path);
          } catch {}
          continue;
        }

        if (detected.type === 'video' && file.size > config.maxVideoBytes) {
          errors.push({
            originalName,
            code: 'FILE_TOO_LARGE',
            message: `Video size exceeds limit of ${config.maxVideoMb}MB`
          });
          try {
            await fs.promises.unlink(file.path);
          } catch {}
          continue;
        }

        // Check user quota pre-processing
        const user = await User.findById(req.user._id);
        if ((user.storageUsedBytes || 0) + file.size > config.userQuotaBytes) {
          errors.push({
            originalName,
            code: 'QUOTA_EXCEEDED',
            message: 'Storage quota exceeded'
          });
          try {
            await fs.promises.unlink(file.path);
          } catch {}
          continue;
        }

        if (detected.type === 'image') {
          const media = await Media.create({
            owner: req.user._id,
            type: 'image',
            status: 'processing',
            originalName,
            mime: detected.mime,
            sizeBytes: file.size
          });

          try {
            const result = await processImage({
              userId: req.user._id,
              mediaId: media._id,
              sourcePath: file.path,
              ext: detected.ext
            });

            // Check quota post-processing
            const currentUser = await User.findById(req.user._id);
            if ((currentUser.storageUsedBytes || 0) + result.sizeBytes > config.userQuotaBytes) {
              await storage.remove(`${req.user._id}/${media._id}`);
              await Media.findByIdAndUpdate(media._id, {
                status: 'failed',
                failureReason: 'QUOTA_EXCEEDED'
              });
              errors.push({
                originalName,
                code: 'QUOTA_EXCEEDED',
                message: 'Storage quota exceeded after image processing'
              });
              continue;
            }

            media.status = 'ready';
            media.width = result.width;
            media.height = result.height;
            media.takenAt = result.takenAt;
            media.blurDataUrl = result.blurDataUrl;
            media.sizeBytes = result.sizeBytes;
            media.paths = result.paths;
            await media.save();

            await User.findByIdAndUpdate(req.user._id, {
              $inc: { storageUsedBytes: result.sizeBytes }
            });

            items.push(formatMedia(media, true));
          } catch (imgErr) {
            await Media.findByIdAndUpdate(media._id, {
              status: 'failed',
              failureReason: imgErr.message
            });
            errors.push({
              originalName,
              code: 'PROCESSING_ERROR',
              message: imgErr.message || 'Image processing failed'
            });
          } finally {
            try {
              await fs.promises.unlink(file.path);
            } catch {}
          }
        } else if (detected.type === 'video') {
          const media = await Media.create({
            owner: req.user._id,
            type: 'video',
            status: 'processing',
            originalName,
            mime: detected.mime,
            sizeBytes: file.size
          });

          // Reserve upload size in quota
          await User.findByIdAndUpdate(req.user._id, {
            $inc: { storageUsedBytes: file.size }
          });

          // Queue video job (queue will unlink file.path when done)
          mediaQueue.addJob({
            mediaId: media._id,
            userId: req.user._id,
            sourcePath: file.path,
            ext: detected.ext,
            uploadedSizeBytes: file.size
          });

          items.push(formatMedia(media, true));
        }
      } catch (err) {
        errors.push({
          originalName,
          code: 'UPLOAD_ERROR',
          message: err.message || 'Upload failed'
        });
        try {
          await fs.promises.unlink(file.path);
        } catch {}
      }
    }

    res.status(200).json({ items, errors });
  } catch (err) {
    next(err);
  }
};

const getMediaLibrary = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const query = { owner: req.user._id };

    if (req.query.type && ['image', 'video'].includes(req.query.type)) {
      query.type = req.query.type;
    }

    if (req.query.from || req.query.to) {
      const conditions = [];
      if (req.query.from) {
        const fromDate = new Date(req.query.from);
        if (!isNaN(fromDate.getTime())) {
          conditions.push({
            $gte: [{ $ifNull: ['$takenAt', '$createdAt'] }, fromDate]
          });
        }
      }
      if (req.query.to) {
        const toDate = new Date(req.query.to);
        if (!isNaN(toDate.getTime())) {
          conditions.push({
            $lte: [{ $ifNull: ['$takenAt', '$createdAt'] }, toDate]
          });
        }
      }
      if (conditions.length > 0) {
        query.$expr = { $and: conditions };
      }
    }

    const sortOption = req.query.sort === 'taken' ? { takenAt: -1, createdAt: -1 } : { createdAt: -1 };

    const [items, total] = await Promise.all([
      Media.find(query).sort(sortOption).skip(skip).limit(limit),
      Media.countDocuments(query)
    ]);

    res.status(200).json({
      items: items.map((m) => formatMedia(m, true)),
      page,
      hasMore: skip + items.length < total
    });
  } catch (err) {
    next(err);
  }
};

const getMediaStatus = async (req, res, next) => {
  try {
    const ids = (req.query.ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 30);

    const items = await Media.find({
      owner: req.user._id,
      _id: { $in: ids }
    });

    res.status(200).json({
      items: items.map((m) => formatMedia(m, true))
    });
  } catch (err) {
    next(err);
  }
};

const getMediaById = async (req, res, next) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) {
      return res.status(404).json({ message: 'Media not found' });
    }

    const allowed = await canViewMedia(req.user, media, req.query.token);
    if (!allowed) {
      return res.status(404).json({ message: 'Media not found' });
    }

    const isOwner = Boolean(req.user && media.owner.toString() === req.user._id.toString());
    res.status(200).json({
      media: formatMedia(media, isOwner, req.query.token)
    });
  } catch (err) {
    next(err);
  }
};

const updateMedia = async (req, res, next) => {
  try {
    const media = await Media.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!media) {
      return res.status(404).json({ message: 'Media not found' });
    }

    const { caption, place, takenAt } = req.body;

    if (caption !== undefined) {
      media.caption = typeof caption === 'string' ? caption.trim().slice(0, 300) : '';
    }

    if (place !== undefined) {
      media.place = typeof place === 'string' ? place.trim().slice(0, 80) : '';
    }

    if (takenAt !== undefined) {
      if (takenAt === null || takenAt === '') {
        media.takenAt = null;
      } else {
        const d = new Date(takenAt);
        if (!isNaN(d.getTime())) {
          media.takenAt = d;
        }
      }
    }

    await media.save();

    res.status(200).json({
      media: formatMedia(media, true)
    });
  } catch (err) {
    next(err);
  }
};

const deleteMedia = async (req, res, next) => {
  try {
    const media = await Media.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!media) {
      return res.status(404).json({ message: 'Media not found' });
    }

    const deletedCount = await deleteMediaCascade([media], req.user._id);

    res.status(200).json({ success: true, deletedCount });
  } catch (err) {
    next(err);
  }
};

const bulkDeleteMedia = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids array is required' });
    }

    const validIds = ids.slice(0, 100);
    const mediaItems = await Media.find({
      owner: req.user._id,
      _id: { $in: validIds }
    });

    const deletedCount = await deleteMediaCascade(mediaItems, req.user._id);

    res.status(200).json({ success: true, deletedCount });
  } catch (err) {
    next(err);
  }
};

const streamMediaFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const variant = req.query.variant || 'display';
    const token = req.query.token;

    const allowedVariants = ['thumb', 'display', 'video', 'poster', 'original'];
    if (!allowedVariants.includes(variant)) {
      return res.status(404).json({ message: 'File not found' });
    }

    const media = await Media.findById(id);
    if (!media) {
      return res.status(404).json({ message: 'File not found' });
    }

    const isOwner = Boolean(req.user && media.owner.toString() === req.user._id.toString());

    if (variant === 'original') {
      if (!isOwner) {
        return res.status(404).json({ message: 'File not found' });
      }
    } else {
      const allowed = await canViewMedia(req.user, media, token);
      if (!allowed) {
        return res.status(404).json({ message: 'File not found' });
      }
    }

    const relPath = media.paths?.[variant];
    if (!relPath) {
      return res.status(404).json({ message: 'File not found' });
    }

    let absPath;
    try {
      absPath = storage.resolveSafePath(relPath);
    } catch {
      return res.status(404).json({ message: 'File not found' });
    }

    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    const stat = await fs.promises.stat(absPath);
    const fileSize = stat.size;

    let contentType = 'application/octet-stream';
    if (variant === 'original') contentType = media.mime;
    else if (variant === 'display' || variant === 'thumb') contentType = 'image/webp';
    else if (variant === 'poster') contentType = 'image/jpeg';
    else if (variant === 'video') contentType = 'video/mp4';

    const etag = `"${stat.mtime.getTime()}-${fileSize}"`;
    const lastModified = stat.mtime.toUTCString();

    const cacheControl = token ? 'public, max-age=3600' : 'private, max-age=86400';

    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize || start > end) {
        res.status(416).set('Content-Range', `bytes */${fileSize}`);
        return res.end();
      }

      const chunkSize = end - start + 1;
      res.status(206);
      res.set({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        ETag: etag,
        'Last-Modified': lastModified,
        'Cache-Control': cacheControl
      });

      storage.createReadStream(relPath, { start, end }).pipe(res);
    } else {
      res.status(200);
      res.set({
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        ETag: etag,
        'Last-Modified': lastModified,
        'Cache-Control': cacheControl
      });

      storage.createReadStream(relPath).pipe(res);
    }
  } catch (err) {
    next(err);
  }
};

const getUserStorage = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const [images, videos] = await Promise.all([
      Media.countDocuments({ owner: req.user._id, type: 'image' }),
      Media.countDocuments({ owner: req.user._id, type: 'video' })
    ]);

    const usedBytes = user?.storageUsedBytes || 0;
    const quotaBytes = config.userQuotaBytes;
    const percent = Math.min(100, Math.round((usedBytes / quotaBytes) * 100));

    res.status(200).json({
      usedBytes,
      quotaBytes,
      percent,
      counts: {
        images,
        videos
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  uploadMedia,
  getMediaLibrary,
  getMediaStatus,
  getMediaById,
  updateMedia,
  deleteMedia,
  bulkDeleteMedia,
  streamMediaFile,
  getUserStorage
};

