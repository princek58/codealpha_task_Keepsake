const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const { formatPost, getPagination } = require('../utils/formatters');
const { deleteUploadFile } = require('../utils/fileHelper');
const { createNotification, removeNotification } = require('../utils/notificationHelper');

const createPost = async (req, res, next) => {
  try {
    const text = req.body.text ? req.body.text.trim() : '';
    const hasImage = Boolean(req.file);

    if (!text && !hasImage) {
      return res.status(400).json({ message: 'Text or image is required' });
    }

    if (text.length > 500) {
      if (req.file) {
        deleteUploadFile(req.file.filename);
      }
      return res.status(400).json({ message: 'Text cannot exceed 500 characters' });
    }

    const image = req.file ? `/uploads/${req.file.filename}` : '';

    const post = await Post.create({
      author: req.user._id,
      text,
      image
    });

    await post.populate('author', 'username displayName avatar moodSticker');

    res.status(201).json({
      post: formatPost(post, req.user._id)
    });
  } catch (err) {
    next(err);
  }
};

const getFeed = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const feedAuthors = [...(req.user.following || []), req.user._id];

    const posts = await Post.find({ author: { $in: feedAuthors } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1)
      .populate('author', 'username displayName avatar moodSticker');

    const hasMore = posts.length > limit;
    const pagePosts = hasMore ? posts.slice(0, limit) : posts;

    const items = pagePosts.map((p) => formatPost(p, req.user._id));

    res.status(200).json({ items, page, hasMore });
  } catch (err) {
    next(err);
  }
};

const getExplore = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req);

    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1)
      .populate('author', 'username displayName avatar moodSticker');

    const hasMore = posts.length > limit;
    const pagePosts = hasMore ? posts.slice(0, limit) : posts;

    const viewerId = req.user ? req.user._id : null;
    const items = pagePosts.map((p) => formatPost(p, viewerId));

    res.status(200).json({ items, page, hasMore });
  } catch (err) {
    next(err);
  }
};

const getUserPosts = async (req, res, next) => {
  try {
    const identifier = req.params.username;
    let user;

    if (mongoose.Types.ObjectId.isValid(identifier)) {
      user = await User.findById(identifier);
    }
    if (!user) {
      user = await User.findOne({ username: identifier.toLowerCase() });
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { page, limit, skip } = getPagination(req);

    const posts = await Post.find({ author: user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1)
      .populate('author', 'username displayName avatar moodSticker');

    const hasMore = posts.length > limit;
    const pagePosts = hasMore ? posts.slice(0, limit) : posts;

    const viewerId = req.user ? req.user._id : null;
    const items = pagePosts.map((p) => formatPost(p, viewerId));

    res.status(200).json({ items, page, hasMore });
  } catch (err) {
    next(err);
  }
};

const getPostById = async (req, res, next) => {
  try {
    const postId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const post = await Post.findById(postId).populate(
      'author',
      'username displayName avatar moodSticker'
    );

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const viewerId = req.user ? req.user._id : null;
    res.status(200).json({
      post: formatPost(post, viewerId)
    });
  } catch (err) {
    next(err);
  }
};

const deletePost = async (req, res, next) => {
  try {
    const postId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    await Comment.deleteMany({ post: post._id });
    await Notification.deleteMany({ post: post._id });
    deleteUploadFile(post.image);
    await post.deleteOne();

    res.status(200).json({ message: 'Post deleted successfully' });
  } catch (err) {
    next(err);
  }
};

const toggleLike = async (req, res, next) => {
  try {
    const postId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const isLiked = (post.likes || []).some(
      (id) => id.toString() === req.user._id.toString()
    );

    if (isLiked) {
      const updated = await Post.findByIdAndUpdate(
        post._id,
        { $pull: { likes: req.user._id } },
        { new: true }
      );
      await removeNotification({
        to: post.author,
        from: req.user._id,
        type: 'like',
        post: post._id
      });

      return res.status(200).json({
        liked: false,
        likesCount: updated.likes.length
      });
    }

    const updated = await Post.findByIdAndUpdate(
      post._id,
      { $addToSet: { likes: req.user._id } },
      { new: true }
    );
    await createNotification({
      to: post.author,
      from: req.user._id,
      type: 'like',
      post: post._id
    });

    res.status(200).json({
      liked: true,
      likesCount: updated.likes.length
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createPost,
  getFeed,
  getExplore,
  getUserPosts,
  getPostById,
  deletePost,
  toggleLike
};

