const Notification = require('../models/Notification');

const createNotification = async ({ to, from, type, post = null }) => {
  if (!to || !from) return null;
  const toId = (to._id || to).toString();
  const fromId = (from._id || from).toString();

  if (toId === fromId) return null;

  const postId = post ? (post._id || post) : null;

  if (type === 'like' || type === 'follow') {
    const filter = { to: toId, from: fromId, type };
    if (type === 'like' && postId) {
      filter.post = postId;
    }
    await Notification.deleteMany(filter);
  }

  return await Notification.create({
    to: toId,
    from: fromId,
    type,
    post: postId,
    read: false
  });
};

const removeNotification = async ({ to, from, type, post = null }) => {
  const query = { type };
  if (to) query.to = (to._id || to).toString();
  if (from) query.from = (from._id || from).toString();
  if (post) query.post = (post._id || post).toString();

  await Notification.deleteMany(query);
};

module.exports = {
  createNotification,
  removeNotification
};

