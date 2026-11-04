const crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('../config');
const Album = require('../models/Album');
const Media = require('../models/Media');
const User = require('../models/User');
const { canViewAlbum } = require('../services/visibility');
const { formatAlbum, formatMedia, getPagination } = require('../utils/formatters');

const createAlbum = async (req, res, next) => {
  try {
    const { title, description, visibility, media, cover } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ message: 'Album title is required' });
    }

    const trimmedTitle = title.trim().slice(0, 80);
    const trimmedDesc = typeof description === 'string' ? description.trim().slice(0, 500) : '';
    const vis = ['public', 'followers', 'private'].includes(visibility) ? visibility : 'private';

    let mediaIds = [];
    if (Array.isArray(media) && media.length > 0) {
      if (media.length > config.maxItemsPerAlbum) {
        return res.status(400).json({
          message: `Cannot exceed ${config.maxItemsPerAlbum} items in an album`
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
      const failed = mediaDocs.find((m) => m.status === 'failed');
      if (failed) {
        return res.status(400).json({ message: 'Cannot use failed media items in albums' });
      }

      mediaIds = stringIds;
    }

    let coverId = null;
    if (cover && mongoose.Types.ObjectId.isValid(cover) && mediaIds.includes(cover.toString())) {
      coverId = cover;
    } else if (mediaIds.length > 0) {
      coverId = mediaIds[0];
    }

    const album = await Album.create({
      owner: req.user._id,
      title: trimmedTitle,
      description: trimmedDesc,
      visibility: vis,
      media: mediaIds,
      cover: coverId
    });

    await album.populate([
      { path: 'owner', select: 'username displayName avatarPath' },
      { path: 'cover' }
    ]);

    res.status(201).json({
      album: formatAlbum(album, req.user._id)
    });
  } catch (err) {
    next(err);
  }
};

const getMyAlbums = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const query = { owner: req.user._id };

    const [items, total] = await Promise.all([
      Album.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate([
          { path: 'owner', select: 'username displayName avatarPath' },
          { path: 'cover' }
        ]),
      Album.countDocuments(query)
    ]);

    res.status(200).json({
      items: items.map((a) => formatAlbum(a, req.user._id)),
      page,
      hasMore: skip + items.length < total
    });
  } catch (err) {
    next(err);
  }
};

const getUserAlbums = async (req, res, next) => {
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
      Album.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate([
          { path: 'owner', select: 'username displayName avatarPath' },
          { path: 'cover' }
        ]),
      Album.countDocuments(query)
    ]);

    res.status(200).json({
      items: items.map((a) => formatAlbum(a, viewer?._id)),
      page,
      hasMore: skip + items.length < total
    });
  } catch (err) {
    next(err);
  }
};

const getAlbumById = async (req, res, next) => {
  try {
    const album = await Album.findById(req.params.id).populate([
      { path: 'owner', select: 'username displayName avatarPath' },
      { path: 'cover' }
    ]);

    if (!album) {
      return res.status(404).json({ message: 'Album not found' });
    }

    const token = req.query.token;
    const allowed = await canViewAlbum(req.user, album, token);
    if (!allowed) {
      return res.status(404).json({ message: 'Album not found' });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 40));
    const skip = (page - 1) * limit;

    const totalMedia = album.media.length;
    const pagedIds = album.media.slice(skip, skip + limit);

    const mediaDocs = await Media.find({ _id: { $in: pagedIds } });
    const mediaMap = new Map(mediaDocs.map((m) => [m._id.toString(), m]));
    const orderedMedia = pagedIds.map((id) => mediaMap.get(id.toString())).filter(Boolean);

    const isOwner = Boolean(req.user && album.owner._id.toString() === req.user._id.toString());

    res.status(200).json({
      album: formatAlbum(album, req.user?._id, token),
      media: {
        items: orderedMedia.map((m) => {
          const isMediaOwner = Boolean(req.user && m.owner.toString() === req.user._id.toString());
          return formatMedia(m, isMediaOwner, token);
        }),
        page,
        hasMore: skip + pagedIds.length < totalMedia
      }
    });
  } catch (err) {
    next(err);
  }
};

const updateAlbum = async (req, res, next) => {
  try {
    const album = await Album.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!album) {
      return res.status(404).json({ message: 'Album not found' });
    }

    const { title, description, visibility, cover } = req.body;

    if (title !== undefined) {
      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ message: 'Album title cannot be empty' });
      }
      album.title = title.trim().slice(0, 80);
    }

    if (description !== undefined) {
      album.description = typeof description === 'string' ? description.trim().slice(0, 500) : '';
    }

    if (visibility !== undefined && ['public', 'followers', 'private'].includes(visibility)) {
      album.visibility = visibility;
    }

    if (cover !== undefined) {
      if (cover === null || cover === '') {
        album.cover = null;
      } else if (
        mongoose.Types.ObjectId.isValid(cover) &&
        album.media.some((id) => id.toString() === cover.toString())
      ) {
        album.cover = cover;
      } else {
        return res.status(400).json({ message: 'Cover must be an item in this album' });
      }
    }

    await album.save();
    await album.populate([
      { path: 'owner', select: 'username displayName avatarPath' },
      { path: 'cover' }
    ]);

    res.status(200).json({
      album: formatAlbum(album, req.user._id)
    });
  } catch (err) {
    next(err);
  }
};

const deleteAlbum = async (req, res, next) => {
  try {
    const album = await Album.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!album) {
      return res.status(404).json({ message: 'Album not found' });
    }

    await Album.findByIdAndDelete(album._id);

    res.status(200).json({ success: true, message: 'Album deleted successfully' });
  } catch (err) {
    next(err);
  }
};

const addMedia = async (req, res, next) => {
  try {
    const album = await Album.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!album) {
      return res.status(404).json({ message: 'Album not found' });
    }

    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids array is required' });
    }

    const stringIds = ids.map((id) => id.toString());
    const existingIds = new Set(album.media.map((id) => id.toString()));
    const newIds = stringIds.filter((id) => !existingIds.has(id));

    if (newIds.length === 0) {
      await album.populate([
        { path: 'owner', select: 'username displayName avatarPath' },
        { path: 'cover' }
      ]);
      return res.status(200).json({ album: formatAlbum(album, req.user._id) });
    }

    if (album.media.length + newIds.length > config.maxItemsPerAlbum) {
      return res.status(400).json({
        message: `Adding these items would exceed the album limit of ${config.maxItemsPerAlbum}`
      });
    }

    const mediaDocs = await Media.find({
      _id: { $in: newIds },
      owner: req.user._id
    });

    if (mediaDocs.length !== newIds.length) {
      return res.status(400).json({
        message: 'All items must exist and belong to the album owner'
      });
    }

    const failed = mediaDocs.find((m) => m.status === 'failed');
    if (failed) {
      return res.status(400).json({ message: 'Cannot add failed media to album' });
    }

    album.media.push(...newIds);
    if (!album.cover) {
      album.cover = album.media[0];
    }

    await album.save();
    await album.populate([
      { path: 'owner', select: 'username displayName avatarPath' },
      { path: 'cover' }
    ]);

    res.status(200).json({
      album: formatAlbum(album, req.user._id)
    });
  } catch (err) {
    next(err);
  }
};

const removeMedia = async (req, res, next) => {
  try {
    const album = await Album.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!album) {
      return res.status(404).json({ message: 'Album not found' });
    }

    const mediaId = req.params.mediaId;
    album.media = album.media.filter((id) => id.toString() !== mediaId.toString());

    if (album.cover && album.cover.toString() === mediaId.toString()) {
      album.cover = album.media.length > 0 ? album.media[0] : null;
    }

    await album.save();
    await album.populate([
      { path: 'owner', select: 'username displayName avatarPath' },
      { path: 'cover' }
    ]);

    res.status(200).json({
      album: formatAlbum(album, req.user._id)
    });
  } catch (err) {
    next(err);
  }
};

const reorderMedia = async (req, res, next) => {
  try {
    const album = await Album.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!album) {
      return res.status(404).json({ message: 'Album not found' });
    }

    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ message: 'ids array is required' });
    }

    if (ids.length !== album.media.length) {
      return res.status(400).json({
        message: 'ids must be a permutation of the current album items'
      });
    }

    const currentSet = new Set(album.media.map((id) => id.toString()));
    const newSet = new Set(ids.map((id) => id.toString()));

    if (currentSet.size !== newSet.size) {
      return res.status(400).json({
        message: 'ids must be a permutation of the current album items'
      });
    }

    for (const id of newSet) {
      if (!currentSet.has(id)) {
        return res.status(400).json({
          message: 'ids must be a permutation of the current album items'
        });
      }
    }

    album.media = ids;
    await album.save();
    await album.populate([
      { path: 'owner', select: 'username displayName avatarPath' },
      { path: 'cover' }
    ]);

    res.status(200).json({
      album: formatAlbum(album, req.user._id)
    });
  } catch (err) {
    next(err);
  }
};

const createShareToken = async (req, res, next) => {
  try {
    const album = await Album.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!album) {
      return res.status(404).json({ message: 'Album not found' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    album.shareToken = token;
    await album.save();

    res.status(200).json({
      shareToken: album.shareToken,
      shareUrl: `/api/albums/shared/${album.shareToken}`
    });
  } catch (err) {
    next(err);
  }
};

const deleteShareToken = async (req, res, next) => {
  try {
    const album = await Album.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!album) {
      return res.status(404).json({ message: 'Album not found' });
    }

    album.shareToken = null;
    await album.save();

    res.status(200).json({
      success: true,
      message: 'Share link revoked'
    });
  } catch (err) {
    next(err);
  }
};

const getSharedAlbum = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token || typeof token !== 'string') {
      return res.status(404).json({ message: 'Album not found' });
    }

    const album = await Album.findOne({ shareToken: token }).populate([
      { path: 'owner', select: 'username displayName avatarPath' },
      { path: 'cover' },
      { path: 'media' }
    ]);

    if (!album) {
      return res.status(404).json({ message: 'Album not found' });
    }

    const mediaList = Array.isArray(album.media)
      ? album.media.map((m) => formatMedia(m, false, token))
      : [];

    res.status(200).json({
      album: formatAlbum(album, null, token),
      media: mediaList
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createAlbum,
  getMyAlbums,
  getUserAlbums,
  getAlbumById,
  updateAlbum,
  deleteAlbum,
  addMedia,
  removeMedia,
  reorderMedia,
  createShareToken,
  deleteShareToken,
  getSharedAlbum
};

