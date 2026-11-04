const express = require('express');
const { body, query, param } = require('express-validator');
const {
  searchUsers,
  getSuggestions,
  getProfile,
  getFollowers,
  getFollowing,
  updateMe,
  toggleFollow
} = require('../controllers/usersController');
const protect = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { actionLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

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
