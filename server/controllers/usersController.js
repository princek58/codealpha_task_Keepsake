const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const { formatPublicUser, getPagination } = require('../utils/formatters');
const { deleteUploadFile } = require('../utils/fileHelper');
const { createNotification, removeNotification } = require('../utils/notificationHelper');

const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const searchUsers = async (req, res, next) => {
  try {
    const q = req.query.q ? req.query.q.trim() : '';
    if (!q || q.length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }

    const { page, limit, skip } = getPagination(req);
    const regex = new RegExp(escapeRegex(q), 'i');

    const users = await User.find({
      $or: [{ username: regex }, { displayName: regex }]
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1);

    const hasMore = users.length > limit;
    const pageUsers = hasMore ? users.slice(0, limit) : users;

    const userIds = pageUsers.map((u) => u._id);
    const postCounts = await Post.aggregate([
      { $match: { author: { $in: userIds } } },
      { $group: { _id: '$author', count: { $sum: 1 } } }
    ]);
    const postCountMap = new Map(postCounts.map((p) => [p._id.toString(), p.count]));

    const viewer = req.user;
    const items = pageUsers.map((u) => {
      const isMe = viewer ? viewer._id.toString() === u._id.toString() : false;
      const isFollowing = viewer && Array.isArray(u.followers)
        ? u.followers.some((f) => f.toString() === viewer._id.toString())
        : false;
      return formatPublicUser(u, postCountMap.get(u._id.toString()) || 0, isFollowing, isMe);
    });

    res.status(200).json({ items, page, hasMore });
  } catch (err) {
    next(err);
  }
};

const getSuggestions = async (req, res, next) => {
  try {
    const viewerId = req.user._id;
    const followingIds = (req.user.following || []).map((id) => id.toString());
    const excludedIds = [viewerId.toString(), ...followingIds];

    let secondDegreeUsers = [];
    if (followingIds.length > 0) {
      const followedUsers = await User.find({
        _id: { $in: followingIds }
      }).select('following');

      const countMap = new Map();
      followedUsers.forEach((u) => {
        (u.following || []).forEach((targetId) => {
          const str = targetId.toString();
          if (!excludedIds.includes(str)) {
            countMap.set(str, (countMap.get(str) || 0) + 1);
          }
        });
      });

      const sortedIds = Array.from(countMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map((entry) => new mongoose.Types.ObjectId(entry[0]));

      if (sortedIds.length > 0) {
        secondDegreeUsers = await User.find({ _id: { $in: sortedIds } });
      }
    }

    const selectedIds = secondDegreeUsers.map((u) => u._id.toString());
    const remainingCount = 6 - secondDegreeUsers.length;

    let newestUsers = [];
    if (remainingCount > 0) {
      newestUsers = await User.find({
        _id: {
          $nin: [...excludedIds, ...selectedIds].map((id) => new mongoose.Types.ObjectId(id))
        }
      })
        .sort({ createdAt: -1 })
        .limit(remainingCount);
    }

    const combined = [...secondDegreeUsers, ...newestUsers];
    const userIds = combined.map((u) => u._id);
    const postCounts = await Post.aggregate([
      { $match: { author: { $in: userIds } } },
      { $group: { _id: '$author', count: { $sum: 1 } } }
    ]);
    const postCountMap = new Map(postCounts.map((p) => [p._id.toString(), p.count]));

    const items = combined.map((u) => {
      const isFollowing = Array.isArray(u.followers)
        ? u.followers.some((f) => f.toString() === viewerId.toString())
        : false;
      return formatPublicUser(u, postCountMap.get(u._id.toString()) || 0, isFollowing, false);
    });

    res.status(200).json({ items });
  } catch (err) {
    next(err);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const username = req.params.username.toLowerCase();
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const postsCount = await Post.countDocuments({ author: user._id });
    const viewer = req.user;
    const isMe = viewer ? viewer._id.toString() === user._id.toString() : false;
    const isFollowing = viewer && Array.isArray(user.followers)
      ? user.followers.some((f) => f.toString() === viewer._id.toString())
      : false;

    res.status(200).json({
      user: formatPublicUser(user, postsCount, isFollowing, isMe)
    });
  } catch (err) {
    next(err);
  }
};

const getFollowers = async (req, res, next) => {
  try {
    const username = req.params.username.toLowerCase();
    const targetUser = await User.findOne({ username });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { page, limit, skip } = getPagination(req);
    const followerIds = targetUser.followers || [];
    const hasMore = followerIds.length > skip + limit;
    const slicedIds = followerIds.slice(skip, skip + limit);

    const followers = await User.find({ _id: { $in: slicedIds } });
    const userMap = new Map(followers.map((u) => [u._id.toString(), u]));

    const orderedFollowers = slicedIds
      .map((id) => userMap.get(id.toString()))
      .filter(Boolean);

    const postCounts = await Post.aggregate([
      { $match: { author: { $in: orderedFollowers.map((u) => u._id) } } },
      { $group: { _id: '$author', count: { $sum: 1 } } }
    ]);
    const postCountMap = new Map(postCounts.map((p) => [p._id.toString(), p.count]));

    const viewer = req.user;
    const items = orderedFollowers.map((u) => {
      const isMe = viewer ? viewer._id.toString() === u._id.toString() : false;
      const isFollowing = viewer && Array.isArray(u.followers)
        ? u.followers.some((f) => f.toString() === viewer._id.toString())
        : false;
      return formatPublicUser(u, postCountMap.get(u._id.toString()) || 0, isFollowing, isMe);
    });

    res.status(200).json({ items, page, hasMore });
  } catch (err) {
    next(err);
  }
};

const getFollowing = async (req, res, next) => {
  try {
    const username = req.params.username.toLowerCase();
    const targetUser = await User.findOne({ username });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { page, limit, skip } = getPagination(req);
    const followingIds = targetUser.following || [];
    const hasMore = followingIds.length > skip + limit;
    const slicedIds = followingIds.slice(skip, skip + limit);

    const followingUsers = await User.find({ _id: { $in: slicedIds } });
    const userMap = new Map(followingUsers.map((u) => [u._id.toString(), u]));

    const orderedFollowing = slicedIds
      .map((id) => userMap.get(id.toString()))
      .filter(Boolean);

    const postCounts = await Post.aggregate([
      { $match: { author: { $in: orderedFollowing.map((u) => u._id) } } },
      { $group: { _id: '$author', count: { $sum: 1 } } }
    ]);
    const postCountMap = new Map(postCounts.map((p) => [p._id.toString(), p.count]));

    const viewer = req.user;
    const items = orderedFollowing.map((u) => {
      const isMe = viewer ? viewer._id.toString() === u._id.toString() : false;
      const isFollowing = viewer && Array.isArray(u.followers)
        ? u.followers.some((f) => f.toString() === viewer._id.toString())
        : false;
      return formatPublicUser(u, postCountMap.get(u._id.toString()) || 0, isFollowing, isMe);
    });

    res.status(200).json({ items, page, hasMore });
  } catch (err) {
    next(err);
  }
};

const updateMe = async (req, res, next) => {
  try {
    const user = req.user;
    const { displayName, bio, moodSticker, removeAvatar } = req.body;

    if (displayName !== undefined) {
      user.displayName = displayName.trim();
    }

    if (bio !== undefined) {
      user.bio = bio.trim();
    }

    if (moodSticker) {
      user.moodSticker = moodSticker;
    }

    if (req.file) {
      deleteUploadFile(user.avatar);
      user.avatar = `/uploads/${req.file.filename}`;
    } else if (removeAvatar === 'true' || removeAvatar === true) {
      deleteUploadFile(user.avatar);
      user.avatar = '';
    }

    await user.save();
    const postsCount = await Post.countDocuments({ author: user._id });

    res.status(200).json({
      user: formatPublicUser(user, postsCount, false, true)
    });
  } catch (err) {
    next(err);
  }
};

const toggleFollow = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isFollowing = (req.user.following || []).some(
      (id) => id.toString() === targetId
    );

    if (isFollowing) {
      await User.findByIdAndUpdate(req.user._id, { $pull: { following: targetId } });
      const updatedTarget = await User.findByIdAndUpdate(
        targetId,
        { $pull: { followers: req.user._id } },
        { new: true }
      );
      await removeNotification({ to: targetId, from: req.user._id, type: 'follow' });

      return res.status(200).json({
        following: false,
        followersCount: updatedTarget.followers.length
      });
    }

    await User.findByIdAndUpdate(req.user._id, { $addToSet: { following: targetId } });
    const updatedTarget = await User.findByIdAndUpdate(
      targetId,
      { $addToSet: { followers: req.user._id } },
      { new: true }
    );
    await createNotification({ to: targetId, from: req.user._id, type: 'follow' });

    res.status(200).json({
      following: true,
      followersCount: updatedTarget.followers.length
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  searchUsers,
  getSuggestions,
  getProfile,
  getFollowers,
  getFollowing,
  updateMe,
  toggleFollow
};

