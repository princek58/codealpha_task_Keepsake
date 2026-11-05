const express = require('express');
const multer = require('multer');
const path = require('path');
const config = require('../config');
const storage = require('../services/storage');
const { protect, optionalAuth } = require('../middleware/auth');
const { actionLimiter, uploadLimiter } = require('../middleware/rateLimiters');
const mediaController = require('../controllers/mediaController');

const router = express.Router();

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, storage.getTmpDir());
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}_${Math.random().toString(36).substring(2)}${ext}`;
    cb(null, unique);
  }
});

const upload = multer({
  storage: multerStorage,
  limits: {
    fileSize: config.maxVideoBytes,
    files: config.maxFilesPerRequest
  }
});

const handleUpload = [
  protect,
  uploadLimiter,
  (req, res, next) => {
    upload.array('files', config.maxFilesPerRequest)(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File exceeds maximum upload size' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            message: `Cannot upload more than ${config.maxFilesPerRequest} files at once`
          });
        }
        return res.status(400).json({ message: err.message || 'Upload error' });
      }
      next();
    });
  },
  mediaController.uploadMedia
];

router.post('/', ...handleUpload);
router.post('/upload', ...handleUpload);

router.get('/limits', mediaController.getLimits);
router.get('/', protect, mediaController.getMediaLibrary);
router.get('/status', protect, mediaController.getMediaStatus);
router.post('/bulk-delete', protect, actionLimiter, mediaController.bulkDeleteMedia);

router.get('/:id/file', optionalAuth, mediaController.streamMediaFile);
router.get('/:id', optionalAuth, mediaController.getMediaById);
router.patch('/:id', protect, mediaController.updateMedia);
router.delete('/:id', protect, mediaController.deleteMedia);

module.exports = router;

