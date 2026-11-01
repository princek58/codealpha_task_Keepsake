const express = require('express');
const { body, param } = require('express-validator');
const {
  createPost,
  getFeed,
  getExplore,
  getUserPosts,
  getPostById,
  deletePost,
  toggleLike
} = require('../controllers/postsController');
const {
  createComment,
  getComments
} = require('../controllers/commentsController');
const protect = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { actionLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.get('/feed', protect, getFeed);
router.get('/explore', optionalAuth, getExplore);
router.get(
  '/user/:username',
  optionalAuth,
  [param('username').trim().notEmpty().withMessage('Username is required')],
  validate,
  getUserPosts
);

router.post(
  '/',
  protect,
  actionLimiter,
  upload.single('image'),
  [
    body('text')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Text cannot exceed 500 characters')
  ],
  validate,
  createPost
);

router.post(
  '/:id/like',
  protect,
  actionLimiter,
  [param('id').isMongoId().withMessage('Invalid post id')],
  validate,
  toggleLike
);

router.get(
  '/:id/comments',
  optionalAuth,
  [param('id').isMongoId().withMessage('Invalid post id')],
  validate,
  getComments
);

router.post(
  '/:id/comments',
  protect,
  actionLimiter,
  [
    param('id').isMongoId().withMessage('Invalid post id'),
    body('text')
      .trim()
      .notEmpty()
      .withMessage('Comment text is required')
      .isLength({ max: 300 })
      .withMessage('Comment cannot exceed 300 characters')
  ],
  validate,
  createComment
);

router.delete(
  '/:id',
  protect,
  deletePost
);

router.get(
  '/:id',
  optionalAuth,
  getPostById
);

module.exports = router;
