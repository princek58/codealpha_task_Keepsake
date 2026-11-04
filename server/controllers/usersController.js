const fs = require('fs');
const mongoose = require('mongoose');
const sharp = require('sharp');
const User = require('../models/User');
const Moment = require('../models/Moment');
const Album = require('../models/Album');
const storage = require('../services/storage');
const { formatPublicUser, getPagination } = require('../utils/formatters');
const { createNotification, removeNotification } = require('../utils/notificationHelper');

const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const getUserCounts = async (targetUserId, viewer) => {
  const viewerId = viewer?._id ? viewer._id.toString() : viewer ? viewer.toString() : null;
  const targetIdStr = targetUserId.toString();
  const isMe = viewerId && viewerId === targetIdStr;

  let visibilityFilter;
  if (isMe) {
    visibilityFilter = {};
  } else if (viewer) {
    const isFollowing = Array.isArray(viewer.following)
      ? viewer.following.some((id) => id.toString() === targetIdStr)
      : await User.exists({ _id: viewerId, following: targetUserId });

    if (isFollowing) {
      visibilityFilter = { visibility: { $in: ['public', 'followers'] } };
    } else {
      visibilityFilter = { visibility: 'public' };
    }
  } else {
    visibilityFilter = { visibility: 'public' };
  }

  const [momentsCount, albumsCount] = await Promise.all([
    Moment.countDocuments({ owner: targetUserId, ...visibilityFilter }),
    Album.countDocuments({ owner: targetUserId, ...visibilityFilter })
  ]);

  return { momentsCount, albumsCount };
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

    const viewer = req.user;
    const items = await Promise.all(
      pageUsers.map(async (u) => {
        const isMe = viewer ? viewer._id.toString() === u._id.toString() : false;
        const isFollowing =
          viewer && Array.isArray(u.followers)
            ? u.followers.some((f) => f.toString() === viewer._id.toString())
            : false;
        const { momentsCount, albumsCount } = await getUserCounts(u._id, viewer);
        return formatPublicUser(u, momentsCount, albumsCount, isFollowing, isMe);
      })
    );

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
    const viewer = req.user;

    const items = await Promise.all(
      combined.map(async (u) => {
        const isFollowing =
          Array.isArray(u.followers)
            ? u.followers.some((f) => f.toString() === viewerId.toString())
            : false;
        const { momentsCount, albumsCount } = await getUserCounts(u._id, viewer);
        return formatPublicUser(u, momentsCount, albumsCount, isFollowing, false);
      })
    );

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

    const viewer = req.user;
    const isMe = viewer ? viewer._id.toString() === user._id.toString() : false;
    const isFollowing =
      viewer && Array.isArray(user.followers)
        ? user.followers.some((f) => f.toString() === viewer._id.toString())
        : false;

    const { momentsCount, albumsCount } = await getUserCounts(user._id, viewer);

    res.status(200).json({
      user: formatPublicUser(user, momentsCount, albumsCount, isFollowing, isMe)
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

    const viewer = req.user;
    const items = await Promise.all(
      orderedFollowers.map(async (u) => {
        const isMe = viewer ? viewer._id.toString() === u._id.toString() : false;
        const isFollowing =
          viewer && Array.isArray(u.followers)
            ? u.followers.some((f) => f.toString() === viewer._id.toString())
            : false;
        const { momentsCount, albumsCount } = await getUserCounts(u._id, viewer);
        return formatPublicUser(u, momentsCount, albumsCount, isFollowing, isMe);
      })
    );

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

    const viewer = req.user;
    const items = await Promise.all(
      orderedFollowing.map(async (u) => {
        const isMe = viewer ? viewer._id.toString() === u._id.toString() : false;
        const isFollowing =
          viewer && Array.isArray(u.followers)
            ? u.followers.some((f) => f.toString() === viewer._id.toString())
            : false;
        const { momentsCount, albumsCount } = await getUserCounts(u._id, viewer);
        return formatPublicUser(u, momentsCount, albumsCount, isFollowing, isMe);
      })
    );

    res.status(200).json({ items, page, hasMore });
  } catch (err) {
    next(err);
  }
};

const updateMe = async (req, res, next) => {
  try {
    const user = req.user;
    const { displayName, bio, removeAvatar } = req.body;

    if (displayName !== undefined) {
      user.displayName = displayName.trim();
    }

    if (bio !== undefined) {
      user.bio = bio.trim();
    }

    if (req.file) {
      try {
        const avatarBuf = await sharp(req.file.path, { failOn: 'error' })
          .rotate()
          .resize(256, 256, { fit: 'cover' })
          .webp({ quality: 85 })
          .toBuffer();

        const avatarRelPath = `avatars/${user._id}_${Date.now()}.webp`;
        await storage.writeBuffer(avatarRelPath, avatarBuf);

        if (user.avatarPath) {
          await storage.remove(user.avatarPath);
        }
        user.avatarPath = avatarRelPath;
      } finally {
        try {
          await fs.promises.unlink(req.file.path);
        } catch {}
      }
    } else if (removeAvatar === 'true' || removeAvatar === true) {
      if (user.avatarPath) {
        await storage.remove(user.avatarPath);
        user.avatarPath = null;
      }
    }

    await user.save();
    const { momentsCount, albumsCount } = await getUserCounts(user._id, user);

    res.status(200).json({
      user: formatPublicUser(user, momentsCount, albumsCount, false, true)
    });
  } catch (err) {
    next(err);
  }
};

const getAvatar = async (req, res, next) => {
  try {
    const username = req.params.username.toLowerCase();
    const user = await User.findOne({ username });
    if (!user || !user.avatarPath) {
      return res.status(404).json({ message: 'Avatar not found' });
    }

    let absPath;
    try {
      absPath = storage.resolveSafePath(user.avatarPath);
    } catch {
      return res.status(404).json({ message: 'Avatar not found' });
    }

    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ message: 'Avatar not found' });
    }

    const stat = await fs.promises.stat(absPath);
    const etag = `"${stat.mtime.getTime()}-${stat.size}"`;

    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    res.set({
      'Content-Type': 'image/webp',
      'Content-Length': stat.size,
      'Cache-Control': 'private, max-age=86400',
      ETag: etag,
      'Last-Modified': stat.mtime.toUTCString()
    });

    storage.createReadStream(user.avatarPath).pipe(res);
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
  getAvatar,
  toggleFollow
};
