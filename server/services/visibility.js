const User = require('../models/User');
const Moment = require('../models/Moment');
const Album = require('../models/Album');

const isViewerFollowing = async (viewer, targetUserId) => {
  if (!viewer || !targetUserId) return false;
  const targetIdStr = targetUserId.toString();

  if (Array.isArray(viewer.following)) {
    return viewer.following.some((id) => id.toString() === targetIdStr);
  }

  const viewerId = viewer._id || viewer;
  const exists = await User.exists({ _id: viewerId, following: targetUserId });
  return !!exists;
};

const getFollowingIds = async (viewer) => {
  if (!viewer) return [];
  if (Array.isArray(viewer.following)) {
    return viewer.following.map((id) => id._id || id);
  }
  const viewerId = viewer._id || viewer;
  const user = await User.findById(viewerId).select('following');
  return user ? user.following : [];
};

const canViewMoment = async (viewer, moment) => {
  if (!moment) return false;
  const ownerId = (moment.owner?._id || moment.owner).toString();
  const viewerId = viewer?._id ? viewer._id.toString() : viewer ? viewer.toString() : null;

  // Owner always
  if (viewerId && viewerId === ownerId) {
    return true;
  }

  // Moments require logged-in user
  if (!viewerId) {
    return false;
  }

  if (moment.visibility === 'public') {
    return true;
  }

  if (moment.visibility === 'followers') {
    return isViewerFollowing(viewer, ownerId);
  }

  // Private is only for owner
  return false;
};

const canViewAlbum = async (viewer, album, token = null) => {
  if (!album) return false;

  // Token access allows viewing without login
  if (token && album.shareToken && album.shareToken === token) {
    return true;
  }

  const ownerId = (album.owner?._id || album.owner).toString();
  const viewerId = viewer?._id ? viewer._id.toString() : viewer ? viewer.toString() : null;

  // Owner always
  if (viewerId && viewerId === ownerId) {
    return true;
  }

  // Without token, viewing requires login
  if (!viewerId) {
    return false;
  }

  if (album.visibility === 'public') {
    return true;
  }

  if (album.visibility === 'followers') {
    return isViewerFollowing(viewer, ownerId);
  }

  return false;
};

const canViewMedia = async (viewer, media, token = null) => {
  if (!media) return false;
  const ownerId = (media.owner?._id || media.owner).toString();
  const viewerId = viewer?._id ? viewer._id.toString() : viewer ? viewer.toString() : null;

  // Owner always
  if (viewerId && viewerId === ownerId) {
    return true;
  }

  // Token access if media is in an album with this share token
  if (token) {
    const albumWithToken = await Album.findOne({
      shareToken: token,
      media: media._id
    });
    if (albumWithToken) {
      return true;
    }
  }

  // If viewer is logged in, check if media is in any Moment or Album the viewer may see
  if (!viewerId) {
    return false;
  }

  const followingIds = await getFollowingIds(viewer);

  // Check Moments containing this media
  const momentMatch = await Moment.exists({
    media: media._id,
    $or: [
      { owner: viewerId },
      { visibility: 'public' },
      { visibility: 'followers', owner: { $in: followingIds } }
    ]
  });
  if (momentMatch) {
    return true;
  }

  // Check Albums containing this media
  const albumMatch = await Album.exists({
    media: media._id,
    $or: [
      { owner: viewerId },
      { visibility: 'public' },
      { visibility: 'followers', owner: { $in: followingIds } }
    ]
  });
  if (albumMatch) {
    return true;
  }

  return false;
};

const buildMomentVisibilityFilter = async (viewer) => {
  if (!viewer) {
    return { _id: { $in: [] } };
  }
  const viewerId = viewer._id || viewer;
  const followingIds = await getFollowingIds(viewer);

  return {
    $or: [
      { owner: viewerId },
      { visibility: 'public' },
      { visibility: 'followers', owner: { $in: followingIds } }
    ]
  };
};

const buildAlbumVisibilityFilter = async (viewer) => {
  if (!viewer) {
    return { _id: { $in: [] } };
  }
  const viewerId = viewer._id || viewer;
  const followingIds = await getFollowingIds(viewer);

  return {
    $or: [
      { owner: viewerId },
      { visibility: 'public' },
      { visibility: 'followers', owner: { $in: followingIds } }
    ]
  };
};

module.exports = {
  canViewMoment,
  canViewAlbum,
  canViewMedia,
  buildMomentVisibilityFilter,
  buildAlbumVisibilityFilter,
  isViewerFollowing
};

