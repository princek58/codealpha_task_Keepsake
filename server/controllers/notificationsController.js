const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { formatNotification, getPagination } = require('../utils/formatters');

const getNotifications = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req);

    const notifications = await Notification.find({ to: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1)
      .populate('from', 'username displayName avatar')
      .populate('post', 'text image');

    const hasMore = notifications.length > limit;
    const pageNotifs = hasMore ? notifications.slice(0, limit) : notifications;

    const items = pageNotifs.map(formatNotification);

    res.status(200).json({ items, page, hasMore });
  } catch (err) {
    next(err);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      to: req.user._id,
      read: false
    });

    res.status(200).json({ count });
  } catch (err) {
    next(err);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { to: req.user._id, read: false },
      { read: true }
    );

    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
};

const markOneAsRead = async (req, res, next) => {
  try {
    const notifId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(notifId)) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    const notification = await Notification.findOne({
      _id: notifId,
      to: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    notification.read = true;
    await notification.save();

    res.status(200).json({ message: 'Notification marked as read' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markOneAsRead
};

