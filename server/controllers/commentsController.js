const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const Moment = require('../models/Moment');
const { formatComment, getPagination } = require('../utils/formatters');
const { createNotification, removeNotification } = require('../utils/notificationHelper');
const { canViewMoment } = require('../services/visibility');

const createComment = async (req, res, next) => {
  try {
    const momentId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(momentId)) {
      return res.status(404).json({ message: 'Moment not found' });
    }

    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({ message: 'Moment not found' });
    }

    const allowed = await canViewMoment(req.user, moment);
    if (!allowed) {
      return res.status(404).json({ message: 'Moment not found' });
    }

    const text = req.body.text ? req.body.text.trim() : '';
    if (!text || text.length > 300) {
      return res.status(400).json({ message: 'Comment text must be between 1 and 300 characters' });
    }

    const comment = await Comment.create({
      moment: moment._id,
      author: req.user._id,
      text
    });

    await Moment.findByIdAndUpdate(moment._id, { $inc: { commentsCount: 1 } });
    if (moment.owner.toString() !== req.user._id.toString()) {
      await createNotification({
        to: moment.owner,
        from: req.user._id,
        type: 'comment',
        moment: moment._id
      });
    }

    await comment.populate('author', 'username displayName avatarPath');

    res.status(201).json({
      comment: formatComment(comment)
    });
  } catch (err) {
    next(err);
  }
};

const getComments = async (req, res, next) => {
  try {
    const momentId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(momentId)) {
      return res.status(404).json({ message: 'Moment not found' });
    }

    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({ message: 'Moment not found' });
    }

    const allowed = await canViewMoment(req.user, moment);
    if (!allowed) {
      return res.status(404).json({ message: 'Moment not found' });
    }

    const { page, limit, skip } = getPagination(req);

    const [comments, total] = await Promise.all([
      Comment.find({ moment: moment._id })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'username displayName avatarPath'),
      Comment.countDocuments({ moment: moment._id })
    ]);

    res.status(200).json({
      items: comments.map(formatComment),
      page,
      hasMore: skip + comments.length < total
    });
  } catch (err) {
    next(err);
  }
};

const deleteComment = async (req, res, next) => {
  try {
    const commentId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const moment = await Moment.findById(comment.moment);

    const isCommentAuthor = comment.author.toString() === req.user._id.toString();
    const isMomentOwner = moment && moment.owner.toString() === req.user._id.toString();

    if (!isCommentAuthor && !isMomentOwner) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    if (moment) {
      await Moment.findByIdAndUpdate(comment.moment, {
        $inc: { commentsCount: -1 }
      });
    }

    await removeNotification({
      from: comment.author,
      type: 'comment',
      moment: comment.moment
    });

    await comment.deleteOne();

    res.status(200).json({ success: true, message: 'Comment deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createComment,
  getComments,
  deleteComment
};
