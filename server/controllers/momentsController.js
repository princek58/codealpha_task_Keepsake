const mongoose = require('mongoose');
const config = require('../config');
const Moment = require('../models/Moment');
const Media = require('../models/Media');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const { canViewMoment } = require('../services/visibility');
const { formatMoment, formatComment, formatMedia, getPagination } = require('../utils/formatters');
const { createNotification, removeNotification } = require('../utils/notificationHelper');

const ALLOWED_COLLAGE_TEMPLATES = {
  'collage-1x2': [2],
  'collage-2x1': [2],
  'collage-1-2': [3],
  'collage-2-1': [3],
  'collage-3col': [3],
  'collage-2x2': [4],
  'collage-1-3': [4],
  'collage-2x3': [6],
  'collage-3x2': [6],
  'collage-1-4': [5],
  'collage-3x3': [9],
  'collage-mosaic': [3, 4, 5, 6, 7, 8, 9, 10]
};

const validateLayoutAndMedia = (layout, mediaCount) => {
  const effectiveLayout = layout ? { ...layout } : { type: 'grid', template: 'grid', gap: 8, background: '#ffffff' };
  let type = effectiveLayout.type || 'grid';
  if (type === 'single' || type === 'stack') {
    type = 'grid';
  }
  effectiveLayout.type = type;

  if (!['collage', 'grid', 'carousel'].includes(type)) {
    throw new Error('Invalid layout type. Allowed: collage, grid, carousel');
  }

  if (type === 'collage') {
    const template = effectiveLayout.template;
    if (!template || !ALLOWED_COLLAGE_TEMPLATES[template]) {
      throw new Error(`Invalid collage template "${template}"`);
    }
    const allowedCounts = ALLOWED_COLLAGE_TEMPLATES[template];
    if (!allowedCounts.includes(mediaCount)) {
      throw new Error(
        `Template "${template}" requires ${allowedCounts.join(' or ')} media items, got ${mediaCount}`
      );
    }
  } else if (!effectiveLayout.template) {
    effectiveLayout.template = type;
  }

  if (effectiveLayout.gap !== undefined) {
    const gap = Number(effectiveLayout.gap);
    if (isNaN(gap) || gap < 0 || gap > 24) {
      throw new Error('Layout gap must be a number between 0 and 24');
    }
    effectiveLayout.gap = gap;
  } else {
    effectiveLayout.gap = 8;
  }

  if (effectiveLayout.background) {
    const hexRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    if (!hexRegex.test(effectiveLayout.background)) {
      throw new Error('Layout background must be a valid hex color');
    }
  } else {
    effectiveLayout.background = '#ffffff';
  }

  return effectiveLayout;
};

const createMoment = async (req, res, next) => {
  try {
    const { title, caption, media, layout, takenOn, place, tags, visibility } = req.body;

    if (!Array.isArray(media) || media.length === 0) {
      return res.status(400).json({ message: 'At least one media item is required' });
    }

    if (media.length > config.maxItemsPerMoment) {
      return res.status(400).json({
        message: `Cannot add more than ${config.maxItemsPerMoment} media items to a moment`
      });
    }

    // Check duplicates
    const stringIds = media.map((id) => id.toString());
    if (new Set(stringIds).size !== stringIds.length) {
      return res.status(400).json({ message: 'Duplicate media items are not allowed' });
    }

    // Validate media ownership and status
    const mediaDocs = await Media.find({
      _id: { $in: media },
      owner: req.user._id
    });

    if (mediaDocs.length !== media.length) {
      return res.status(400).json({
        message: 'All media items must exist and belong to the creator'
      });
    }

    const failedItem = mediaDocs.find((m) => m.status === 'failed');
    if (failedItem) {
      return res.status(400).json({ message: 'Cannot use failed media items in moments' });
    }

    // Preserve media order as requested by user
    const mediaMap = new Map(mediaDocs.map((m) => [m._id.toString(), m]));
    const orderedMediaDocs = stringIds.map((id) => mediaMap.get(id)).filter(Boolean);

    let effectiveLayout;
    try {
      effectiveLayout = validateLayoutAndMedia(layout, media.length);
    } catch (valErr) {
      return res.status(400).json({ message: valErr.message });
    }

    const momentData = {
      owner: req.user._id,
      title: typeof title === 'string' ? title.trim().slice(0, 80) : '',
      caption: typeof caption === 'string' ? caption.trim().slice(0, 1000) : '',
      media: stringIds,
      layout: effectiveLayout,
      place: typeof place === 'string' ? place.trim().slice(0, 80) : '',
      visibility: ['public', 'followers', 'private'].includes(visibility) ? visibility : 'followers'
    };

    if (takenOn) {
      const d = new Date(takenOn);
      if (!isNaN(d.getTime())) {
        momentData.takenOn = d;
      }
    } else if (orderedMediaDocs[0]?.takenAt) {
      momentData.takenOn = orderedMediaDocs[0].takenAt;
    }

    if (Array.isArray(tags)) {
      momentData.tags = tags
        .map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
        .filter((t) => t.length >= 1 && t.length <= 24)
        .slice(0, 8);
    }

    const moment = await Moment.create(momentData);
    await moment.populate([
      { path: 'owner', select: 'username displayName avatarPath' },
      { path: 'media' }
    ]);

    res.status(201).json({
      moment: formatMoment(moment, req.user._id)
    });
  } catch (err) {
    next(err);
  }
};

const getFeed = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const followingIds = req.user.following || [];

    const query = {
      $or: [
        { owner: req.user._id },
        { owner: { $in: followingIds }, visibility: { $in: ['public', 'followers'] } }
      ]
    };

    const [items, total] = await Promise.all([
      Moment.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate([
          { path: 'owner', select: 'username displayName avatarPath' },
          { path: 'media' }
        ]),
      Moment.countDocuments(query)
    ]);

    res.status(200).json({
      items: items.map((m) => formatMoment(m, req.user._id)),
      page,
      hasMore: skip + items.length < total
    });
  } catch (err) {
    next(err);
  }
};

const getExplore = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const query = { visibility: 'public' };

    const [items, total] = await Promise.all([
      Moment.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate([
          { path: 'owner', select: 'username displayName avatarPath' },
          { path: 'media' }
        ]),
      Moment.countDocuments(query)
    ]);

    const viewerId = req.user?._id;
    res.status(200).json({
      items: items.map((m) => formatMoment(m, viewerId)),
      page,
      hasMore: skip + items.length < total
    });
  } catch (err) {
    next(err);
  }
};

const getUserMoments = async (req, res, next) => {
  try {
    const username = req.params.username.toLowerCase();
    const targetUser = await User.findOne({ username });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { page, limit, skip } = getPagination(req);
    const viewer = req.user;
    const isMe = viewer && viewer._id.toString() === targetUser._id.toString();

    let query = { owner: targetUser._id };
    if (!isMe) {
      const isFollowing = viewer
        ? Array.isArray(viewer.following)
          ? viewer.following.some((id) => id.toString() === targetUser._id.toString())
          : await User.exists({ _id: viewer._id, following: targetUser._id })
        : false;

      if (isFollowing) {
        query.visibility = { $in: ['public', 'followers'] };
      } else {
        query.visibility = 'public';
      }
    }

    const [items, total] = await Promise.all([
      Moment.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate([
          { path: 'owner', select: 'username displayName avatarPath' },
          { path: 'media' }
        ]),
      Moment.countDocuments(query)
    ]);

    res.status(200).json({
      items: items.map((m) => formatMoment(m, viewer?._id)),
      page,
      hasMore: skip + items.length < total
    });
  } catch (err) {
    next(err);
  }
};

const getOnThisDay = async (req, res, next) => {
  try {
    const today = req.query.date ? new Date(req.query.date) : new Date();
    const utcYear = today.getUTCFullYear();
    const utcMonth = today.getUTCMonth() + 1;
    const utcDay = today.getUTCDate();

    const localYear = today.getFullYear();
    const localMonth = today.getMonth() + 1;
    const localDay = today.getDate();

    const momentExprConditions = [
      {
        $and: [
          { $eq: [{ $month: '$takenOn' }, utcMonth] },
          { $eq: [{ $dayOfMonth: '$takenOn' }, utcDay] },
          { $lt: [{ $year: '$takenOn' }, utcYear] }
        ]
      }
    ];

    if (localDay !== utcDay || localMonth !== utcMonth) {
      momentExprConditions.push({
        $and: [
          { $eq: [{ $month: '$takenOn' }, localMonth] },
          { $eq: [{ $dayOfMonth: '$takenOn' }, localDay] },
          { $lt: [{ $year: '$takenOn' }, localYear] }
        ]
      });
    }

    const moments = await Moment.find({
      owner: req.user._id,
      $expr: {
        $or: momentExprConditions
      }
    })
      .sort({ takenOn: -1 })
      .limit(20)
      .populate([
        { path: 'owner', select: 'username displayName avatarPath' },
        { path: 'media' }
      ]);

    const mediaExprConditions = [
      {
        $and: [
          { $eq: [{ $month: '$takenAt' }, utcMonth] },
          { $eq: [{ $dayOfMonth: '$takenAt' }, utcDay] },
          { $lt: [{ $year: '$takenAt' }, utcYear] }
        ]
      }
    ];

    if (localDay !== utcDay || localMonth !== utcMonth) {
      mediaExprConditions.push({
        $and: [
          { $eq: [{ $month: '$takenAt' }, localMonth] },
          { $eq: [{ $dayOfMonth: '$takenAt' }, localDay] },
          { $lt: [{ $year: '$takenAt' }, localYear] }
        ]
      });
    }

    const mediaItems = await Media.find({
      owner: req.user._id,
      status: 'ready',
      takenAt: { $ne: null },
      $expr: {
        $or: mediaExprConditions
      }
    })
      .sort({ takenAt: -1 })
      .limit(20);

    const yearGroups = {};

    moments.forEach((m) => {
      const year = new Date(m.takenOn).getFullYear();
      if (!yearGroups[year]) {
        yearGroups[year] = { year, moments: [], media: [] };
      }
      yearGroups[year].moments.push(formatMoment(m, req.user._id));
    });

    mediaItems.forEach((m) => {
      const year = new Date(m.takenAt).getFullYear();
      if (!yearGroups[year]) {
        yearGroups[year] = { year, moments: [], media: [] };
      }
      yearGroups[year].media.push(formatMedia(m, true));
    });

    const groups = Object.values(yearGroups).sort((a, b) => b.year - a.year);

    res.status(200).json({ groups });
  } catch (err) {
    next(err);
  }
};

const getMomentById = async (req, res, next) => {
  try {
    const moment = await Moment.findById(req.params.id).populate([
      { path: 'owner', select: 'username displayName avatarPath' },
      { path: 'media' }
    ]);

    if (!moment) {
      return res.status(404).json({ message: 'Moment not found' });
    }

    const allowed = await canViewMoment(req.user, moment);
    if (!allowed) {
      return res.status(404).json({ message: 'Moment not found' });
    }

    res.status(200).json({
      moment: formatMoment(moment, req.user?._id)
    });
  } catch (err) {
    next(err);
  }
};

const updateMoment = async (req, res, next) => {
  try {
    const moment = await Moment.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!moment) {
      return res.status(404).json({ message: 'Moment not found' });
    }

    const { title, caption, media, layout, takenOn, place, tags, visibility } = req.body;

    if (media !== undefined) {
      if (!Array.isArray(media) || media.length === 0) {
        return res.status(400).json({ message: 'At least one media item is required' });
      }
      if (media.length > config.maxItemsPerMoment) {
        return res.status(400).json({
          message: `Cannot add more than ${config.maxItemsPerMoment} media items to a moment`
        });
      }
      const stringIds = media.map((id) => id.toString());
      if (new Set(stringIds).size !== stringIds.length) {
        return res.status(400).json({ message: 'Duplicate media items are not allowed' });
      }

      const mediaDocs = await Media.find({
        _id: { $in: media },
        owner: req.user._id
      });
      if (mediaDocs.length !== media.length) {
        return res.status(400).json({
          message: 'All media items must exist and belong to the creator'
        });
      }
      const failedItem = mediaDocs.find((m) => m.status === 'failed');
      if (failedItem) {
        return res.status(400).json({ message: 'Cannot use failed media items in moments' });
      }

      moment.media = stringIds;
    }

    if (layout !== undefined) {
      const effectiveLayout = validateLayoutAndMedia(layout, moment.media.length);
      moment.layout = effectiveLayout;
    }

    if (title !== undefined) {
      moment.title = typeof title === 'string' ? title.trim().slice(0, 80) : '';
    }

    if (caption !== undefined) {
      moment.caption = typeof caption === 'string' ? caption.trim().slice(0, 1000) : '';
    }

    if (place !== undefined) {
      moment.place = typeof place === 'string' ? place.trim().slice(0, 80) : '';
    }

    if (visibility !== undefined && ['public', 'followers', 'private'].includes(visibility)) {
      moment.visibility = visibility;
    }

    if (takenOn !== undefined) {
      const d = new Date(takenOn);
      if (!isNaN(d.getTime())) {
        moment.takenOn = d;
      }
    }

    if (tags !== undefined && Array.isArray(tags)) {
      moment.tags = tags
        .map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
        .filter((t) => t.length >= 1 && t.length <= 24)
        .slice(0, 8);
    }

    await moment.save();
    await moment.populate([
      { path: 'owner', select: 'username displayName avatarPath' },
      { path: 'media' }
    ]);

    res.status(200).json({
      moment: formatMoment(moment, req.user._id)
    });
  } catch (err) {
    next(err);
  }
};

const deleteMoment = async (req, res, next) => {
  try {
    const moment = await Moment.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!moment) {
      return res.status(404).json({ message: 'Moment not found' });
    }

    await Moment.findByIdAndDelete(moment._id);
    await Comment.deleteMany({ moment: moment._id });
    await Notification.deleteMany({ moment: moment._id });

    res.status(200).json({ success: true, message: 'Moment deleted successfully' });
  } catch (err) {
    next(err);
  }
};

const toggleLike = async (req, res, next) => {
  try {
    const moment = await Moment.findById(req.params.id);
    if (!moment) {
      return res.status(404).json({ message: 'Moment not found' });
    }

    const allowed = await canViewMoment(req.user, moment);
    if (!allowed) {
      return res.status(404).json({ message: 'Moment not found' });
    }

    const userIdStr = req.user._id.toString();
    const alreadyLiked = moment.likes.some((id) => id.toString() === userIdStr);

    if (alreadyLiked) {
      moment.likes = moment.likes.filter((id) => id.toString() !== userIdStr);
      await moment.save();
      await removeNotification({
        to: moment.owner,
        from: req.user._id,
        type: 'like',
        moment: moment._id
      });
      return res.status(200).json({
        liked: false,
        likesCount: moment.likes.length
      });
    }

    moment.likes.push(req.user._id);
    await moment.save();

    if (moment.owner.toString() !== userIdStr) {
      await createNotification({
        to: moment.owner,
        from: req.user._id,
        type: 'like',
        moment: moment._id
      });
    }

    res.status(200).json({
      liked: true,
      likesCount: moment.likes.length
    });
  } catch (err) {
    next(err);
  }
};

const addComment = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const moment = await Moment.findById(req.params.id);
    if (!moment) {
      return res.status(404).json({ message: 'Moment not found' });
    }

    const allowed = await canViewMoment(req.user, moment);
    if (!allowed) {
      return res.status(404).json({ message: 'Moment not found' });
    }

    const trimmed = text.trim().slice(0, 300);
    const comment = await Comment.create({
      moment: moment._id,
      author: req.user._id,
      text: trimmed
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

    await comment.populate({
      path: 'author',
      select: 'username displayName avatarPath'
    });

    res.status(201).json({
      comment: formatComment(comment)
    });
  } catch (err) {
    next(err);
  }
};

const getComments = async (req, res, next) => {
  try {
    const moment = await Moment.findById(req.params.id);
    if (!moment) {
      return res.status(404).json({ message: 'Moment not found' });
    }

    const allowed = await canViewMoment(req.user, moment);
    if (!allowed) {
      return res.status(404).json({ message: 'Moment not found' });
    }

    const { page, limit, skip } = getPagination(req);
    const [items, total] = await Promise.all([
      Comment.find({ moment: moment._id })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'author',
          select: 'username displayName avatarPath'
        }),
      Comment.countDocuments({ moment: moment._id })
    ]);

    res.status(200).json({
      items: items.map(formatComment),
      page,
      hasMore: skip + items.length < total
    });
  } catch (err) {
    next(err);
  }
};

const deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const moment = await Moment.findById(comment.moment);
    const isCommentAuthor = comment.author.toString() === req.user._id.toString();
    const isMomentOwner = moment && moment.owner.toString() === req.user._id.toString();

    if (!isCommentAuthor && !isMomentOwner) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    await Comment.findByIdAndDelete(comment._id);
    if (moment) {
      await Moment.findByIdAndUpdate(moment._id, {
        $inc: { commentsCount: -1 }
      });
    }

    res.status(200).json({ success: true, message: 'Comment deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createMoment,
  getFeed,
  getExplore,
  getUserMoments,
  getOnThisDay,
  getMomentById,
  updateMoment,
  deleteMoment,
  toggleLike,
  addComment,
  getComments,
  deleteComment
};

