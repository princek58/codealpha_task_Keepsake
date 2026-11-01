const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const Post = require('../models/Post');
const { formatComment, getPagination } = require('../utils/formatters');
const { createNotification, removeNotification } = require('../utils/notificationHelper');

const createComment = async (req, res, next) => {
  try {
    const postId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const text = req.body.text ? req.body.text.trim() : '';
    if (!text || text.length > 300) {
      return res.status(400).json({ message: 'Comment text must be between 1 and 300 characters' });
    }

    const comment = await Comment.create({
      post: post._id,
      author: req.user._id,
      text
    });

    await Post.findByIdAndUpdate(post._id, { $inc: { commentsCount: 1 } });
    await createNotification({
      to: post.author,
      from: req.user._id,
      type: 'comment',
      post: post._id
    });

    await comment.populate('author', 'username displayName avatar moodSticker');

    res.status(201).json({
      comment: formatComment(comment)
    });
  } catch (err) {
    next(err);
  }
};

const getComments = async (req, res, next) => {
  try {
    const postId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const { page, limit, skip } = getPagination(req);

    const comments = await Comment.find({ post: post._id })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit + 1)
      .populate('author', 'username displayName avatar moodSticker');

    const hasMore = comments.length > limit;
    const pageComments = hasMore ? comments.slice(0, limit) : comments;

    const items = pageComments.map(formatComment);

    res.status(200).json({ items, page, hasMore });
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

    const post = await Post.findById(comment.post);

    const isCommentAuthor = comment.author.toString() === req.user._id.toString();
    const isPostAuthor = post && post.author.toString() === req.user._id.toString();

    if (!isCommentAuthor && !isPostAuthor) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    await Post.findByIdAndUpdate(comment.post, {
      $inc: { commentsCount: -1 }
    });

    await removeNotification({
      from: comment.author,
      type: 'comment',
      post: comment.post
    });

    await comment.deleteOne();

    res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createComment,
  getComments,
  deleteComment
};

