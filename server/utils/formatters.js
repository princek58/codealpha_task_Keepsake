const formatPublicUser = (user, postsCount = 0, isFollowing = false, isMe = false) => {
  return {
    id: (user._id || user.id).toString(),
    username: user.username,
    displayName: user.displayName || user.username,
    bio: user.bio || '',
    avatar: user.avatar || '',
    moodSticker: user.moodSticker || 'flower',
    followersCount: Array.isArray(user.followers) ? user.followers.length : (user.followersCount || 0),
    followingCount: Array.isArray(user.following) ? user.following.length : (user.followingCount || 0),
    postsCount: typeof postsCount === 'number' ? postsCount : 0,
    isFollowing: Boolean(isFollowing),
    isMe: Boolean(isMe),
    createdAt: user.createdAt
  };
};

const formatPost = (post, viewerId = null) => {
  const author = post.author || {};
  const likes = Array.isArray(post.likes) ? post.likes : [];
  const likedByMe = viewerId
    ? likes.some((id) => id.toString() === viewerId.toString())
    : false;

  return {
    id: (post._id || post.id).toString(),
    text: post.text || '',
    image: post.image || '',
    author: {
      id: (author._id || author.id || '').toString(),
      username: author.username || '',
      displayName: author.displayName || author.username || '',
      avatar: author.avatar || '',
      moodSticker: author.moodSticker || 'flower'
    },
    likesCount: likes.length,
    commentsCount: post.commentsCount || 0,
    likedByMe,
    createdAt: post.createdAt
  };
};

const formatComment = (comment) => {
  const author = comment.author || {};
  const postId = comment.post ? (comment.post._id || comment.post).toString() : '';

  return {
    id: (comment._id || comment.id).toString(),
    postId,
    text: comment.text,
    author: {
      id: (author._id || author.id || '').toString(),
      username: author.username || '',
      displayName: author.displayName || author.username || '',
      avatar: author.avatar || '',
      moodSticker: author.moodSticker || 'flower'
    },
    createdAt: comment.createdAt
  };
};

const formatNotification = (notification) => {
  const from = notification.from || {};
  const post = notification.post;
  let postPreview = '';
  if (post && typeof post === 'object' && post.text) {
    postPreview = post.text.length > 50 ? `${post.text.substring(0, 50)}...` : post.text;
  }

  return {
    id: (notification._id || notification.id).toString(),
    type: notification.type,
    from: {
      id: (from._id || from.id || '').toString(),
      username: from.username || '',
      displayName: from.displayName || from.username || '',
      avatar: from.avatar || ''
    },
    postId: post ? (post._id || post).toString() : null,
    postPreview,
    read: Boolean(notification.read),
    createdAt: notification.createdAt
  };
};

const getPagination = (req) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

module.exports = {
  formatPublicUser,
  formatPost,
  formatComment,
  formatNotification,
  getPagination
};

