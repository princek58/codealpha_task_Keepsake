const formatMedia = (media, isOwner = false, token = null) => {
  if (!media) return null;
  const id = (media._id || media.id).toString();
  const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : '';

  const urls = {
    thumb: media.paths?.thumb ? `/api/media/${id}/file?variant=thumb${tokenQuery}` : null,
    display: media.paths?.display ? `/api/media/${id}/file?variant=display${tokenQuery}` : null,
    video: media.paths?.video ? `/api/media/${id}/file?variant=video${tokenQuery}` : null,
    poster: media.paths?.poster ? `/api/media/${id}/file?variant=poster${tokenQuery}` : null
  };

  if (isOwner) {
    urls.original = media.paths?.original ? `/api/media/${id}/file?variant=original` : null;
  }

  const formatted = {
    id,
    type: media.type,
    status: media.status,
    failureReason: media.failureReason || null,
    width: media.width || null,
    height: media.height || null,
    durationSec: media.durationSec || null,
    takenAt: media.takenAt || null,
    caption: media.caption || '',
    place: media.place || '',
    blurDataUrl: media.blurDataUrl || null,
    urls
  };

  if (isOwner) {
    formatted.sizeBytes = media.sizeBytes || 0;
  }

  return formatted;
};

const formatMoment = (moment, currentUserId = null, token = null) => {
  if (!moment) return null;
  const id = (moment._id || moment.id).toString();
  const author = moment.owner || {};
  const authorId = (author._id || author.id || author).toString();
  const isOwner = Boolean(currentUserId && currentUserId.toString() === authorId);

  const avatarUrl = author.avatarPath ? `/api/users/${author.username}/avatar` : null;

  const formattedMedia = Array.isArray(moment.media)
    ? moment.media.map((m) => {
        if (m && typeof m === 'object' && (m._id || m.id)) {
          const mOwnerId = (m.owner?._id || m.owner || '').toString();
          const isMediaOwner = Boolean(currentUserId && currentUserId.toString() === mOwnerId);
          return formatMedia(m, isMediaOwner, token);
        }
        return m;
      })
    : [];

  const likes = Array.isArray(moment.likes) ? moment.likes : [];
  const likedByMe = Boolean(
    currentUserId &&
      likes.some((likeId) => (likeId._id || likeId).toString() === currentUserId.toString())
  );

  const rawLayout = moment.layout || {};
  let layoutType = rawLayout.type || 'grid';
  if (layoutType === 'single' || layoutType === 'stack' || !['collage', 'grid', 'carousel'].includes(layoutType)) {
    layoutType = 'grid';
  }

  const formatted = {
    id,
    title: moment.title || '',
    caption: moment.caption || '',
    media: formattedMedia,
    layout: {
      type: layoutType,
      template: rawLayout.template || layoutType,
      gap: typeof rawLayout.gap === 'number' ? rawLayout.gap : 8,
      background: rawLayout.background || '#ffffff'
    },
    takenOn: moment.takenOn || moment.createdAt,
    place: moment.place || '',
    tags: Array.isArray(moment.tags) ? moment.tags : [],
    author: {
      id: authorId,
      username: author.username || '',
      displayName: author.displayName || author.username || '',
      avatarUrl
    },
    likesCount: likes.length,
    commentsCount: moment.commentsCount || 0,
    likedByMe,
    createdAt: moment.createdAt
  };

  if (isOwner) {
    formatted.visibility = moment.visibility;
  }

  return formatted;
};

const formatAlbum = (album, currentUserId = null, token = null) => {
  if (!album) return null;
  const id = (album._id || album.id).toString();
  const author = album.owner || {};
  const authorId = (author._id || author.id || author).toString();
  const isOwner = Boolean(currentUserId && currentUserId.toString() === authorId);

  const avatarUrl = author.avatarPath ? `/api/users/${author.username}/avatar` : null;

  let formattedCover = null;
  if (album.cover && typeof album.cover === 'object' && (album.cover._id || album.cover.id)) {
    const cOwnerId = (album.cover.owner?._id || album.cover.owner || '').toString();
    const isCoverOwner = Boolean(currentUserId && currentUserId.toString() === cOwnerId);
    formattedCover = formatMedia(album.cover, isCoverOwner, token);
  }

  const mediaCount = Array.isArray(album.media) ? album.media.length : 0;

  const formatted = {
    id,
    title: album.title,
    description: album.description || '',
    cover: formattedCover,
    mediaCount,
    author: {
      id: authorId,
      username: author.username || '',
      displayName: author.displayName || author.username || '',
      avatarUrl
    },
    createdAt: album.createdAt,
    updatedAt: album.updatedAt
  };

  if (isOwner) {
    formatted.visibility = album.visibility;
    formatted.shared = Boolean(album.shareToken);
    formatted.shareToken = album.shareToken || null;
  }

  return formatted;
};

const formatPublicUser = (user, momentsCount = 0, albumsCount = 0, isFollowing = false, isMe = false) => {
  const avatarUrl = user.avatarPath ? `/api/users/${user.username}/avatar` : null;

  return {
    id: (user._id || user.id).toString(),
    username: user.username,
    displayName: user.displayName || user.username,
    bio: user.bio || '',
    avatarUrl,
    followersCount: Array.isArray(user.followers) ? user.followers.length : (user.followersCount || 0),
    followingCount: Array.isArray(user.following) ? user.following.length : (user.followingCount || 0),
    momentsCount: typeof momentsCount === 'number' ? momentsCount : 0,
    albumsCount: typeof albumsCount === 'number' ? albumsCount : 0,
    isFollowing: Boolean(isFollowing),
    isMe: Boolean(isMe),
    createdAt: user.createdAt
  };
};

const formatComment = (comment) => {
  const author = comment.author || {};
  const momentId = comment.moment ? (comment.moment._id || comment.moment).toString() : '';
  const avatarUrl = author.avatarPath ? `/api/users/${author.username}/avatar` : null;

  return {
    id: (comment._id || comment.id).toString(),
    momentId,
    text: comment.text,
    author: {
      id: (author._id || author.id || '').toString(),
      username: author.username || '',
      displayName: author.displayName || author.username || '',
      avatarUrl
    },
    createdAt: comment.createdAt
  };
};

const formatNotification = (notification) => {
  const from = notification.from || {};
  const moment = notification.moment;
  const avatarUrl = from.avatarPath ? `/api/users/${from.username}/avatar` : null;

  let momentPreview = '';
  if (moment && typeof moment === 'object') {
    const text = moment.title || moment.caption || '';
    momentPreview = text.length > 50 ? `${text.substring(0, 50)}...` : text;
  }

  return {
    id: (notification._id || notification.id).toString(),
    type: notification.type,
    from: {
      id: (from._id || from.id || '').toString(),
      username: from.username || '',
      displayName: from.displayName || from.username || '',
      avatarUrl
    },
    momentId: moment ? (moment._id || moment).toString() : null,
    momentPreview,
    read: Boolean(notification.read),
    createdAt: notification.createdAt
  };
};

const getPagination = (req) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(60, Math.max(1, parseInt(req.query.limit, 10) || 30));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

module.exports = {
  formatMedia,
  formatMoment,
  formatAlbum,
  formatPublicUser,
  formatComment,
  formatNotification,
  getPagination
};
