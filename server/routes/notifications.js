const express = require('express');
const { param } = require('express-validator');
const {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markOneAsRead
} = require('../controllers/notificationsController');
const protect = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.get('/unread-count', protect, getUnreadCount);
router.put('/read', protect, markAllAsRead);
router.put(
  '/:id/read',
  protect,
  [param('id').isMongoId().withMessage('Invalid notification id')],
  validate,
  markOneAsRead
);
router.get('/', protect, getNotifications);

module.exports = router;
