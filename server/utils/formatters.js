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

  let momentPreview = notification.momentPreview || '';
  if (!momentPreview && moment && typeof moment === 'object') {
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
  formatPublicUser,
  formatComment,
  formatNotification,
  getPagination
};
