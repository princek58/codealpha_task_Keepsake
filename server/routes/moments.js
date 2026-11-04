const express = require('express');
const { body, param } = require('express-validator');
const { protect, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { actionLimiter } = require('../middleware/rateLimiters');
const momentsController = require('../controllers/momentsController');

const router = express.Router();

router.post('/', protect, actionLimiter, momentsController.createMoment);
router.get('/feed', protect, momentsController.getFeed);
router.get('/explore', optionalAuth, momentsController.getExplore);
router.get('/on-this-day', protect, momentsController.getOnThisDay);
router.get('/user/:username', optionalAuth, momentsController.getUserMoments);

router.get('/:id', optionalAuth, momentsController.getMomentById);
router.patch('/:id', protect, momentsController.updateMoment);
router.delete('/:id', protect, momentsController.deleteMoment);

router.post('/:id/like', protect, actionLimiter, momentsController.toggleLike);

router.post(
  '/:id/comments',
  protect,
  actionLimiter,
  [
    body('text')
      .trim()
      .notEmpty()
      .withMessage('Comment text is required')
      .isLength({ max: 300 })
      .withMessage('Comment cannot exceed 300 characters')
  ],
  validate,
  momentsController.addComment
);

router.get('/:id/comments', optionalAuth, momentsController.getComments);

module.exports = router;

