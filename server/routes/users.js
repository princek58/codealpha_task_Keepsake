const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, query, param } = require('express-validator');
const storage = require('../services/storage');
const config = require('../config');
const {
  searchUsers,
  getSuggestions,
  getProfile,
  getFollowers,
  getFollowing,
  updateMe,
  getAvatar,
  toggleFollow
} = require('../controllers/usersController');
const { getUserStorage } = require('../controllers/mediaController');
const { protect, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { actionLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, storage.getTmpDir());
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar_${Date.now()}_${Math.random().toString(36).substring(2)}${ext}`);
  }
});

const avatarUpload = multer({
  storage: multerStorage,
  limits: {
    fileSize: config.maxImageBytes
  }
});

const updateMeValidation = [
  body('displayName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage('Display name must be between 1 and 30 characters'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage('Bio cannot exceed 160 characters')
];

router.get('/me/storage', protect, getUserStorage);

router.get(
  '/search',
  optionalAuth,
  [
    query('q')
      .trim()
      .isLength({ min: 2 })
      .withMessage('Search query must be at least 2 characters')
  ],
  validate,
  searchUsers
);

router.get('/suggestions', protect, getSuggestions);

router.put(
  '/me',
  protect,
  (req, res, next) => {
    avatarUpload.single('avatar')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'Avatar exceeds maximum allowed size' });
        }
        return res.status(400).json({ message: err.message || 'Avatar upload error' });
      }
      next();
    });
  },
  updateMeValidation,
  validate,
  updateMe
);

router.post(
  '/:id/follow',
  protect,
  actionLimiter,
  [param('id').isMongoId().withMessage('Invalid user id')],
  validate,
  toggleFollow
);

router.get(
  '/:username/avatar',
  optionalAuth,
  [param('username').trim().notEmpty().withMessage('Username is required')],
  validate,
  getAvatar
);

router.get(
  '/:username/followers',
  optionalAuth,
  [param('username').trim().notEmpty().withMessage('Username is required')],
  validate,
  getFollowers
);

router.get(
  '/:username/following',
  optionalAuth,
  [param('username').trim().notEmpty().withMessage('Username is required')],
  validate,
  getFollowing
);

router.get(
  '/:username',
  optionalAuth,
  [param('username').trim().notEmpty().withMessage('Username is required')],
  validate,
  getProfile
);

module.exports = router;
