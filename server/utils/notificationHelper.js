const Notification = require('../models/Notification');

const createNotification = async ({ to, from, type, moment = null }) => {
  if (!to || !from) return null;
  const toId = (to._id || to).toString();
  const fromId = (from._id || from).toString();

  if (toId === fromId) return null;

  const momentId = moment ? (moment._id || moment) : null;

  if (type === 'like' || type === 'follow') {
    const filter = { to: toId, from: fromId, type };
    if (type === 'like' && momentId) {
      filter.moment = momentId;
    }
    await Notification.deleteMany(filter);
  }

  return await Notification.create({
    to: toId,
    from: fromId,
    type,
    moment: momentId,
    read: false
  });
};

const removeNotification = async ({ to, from, type, moment = null }) => {
  const query = { type };
  if (to) query.to = (to._id || to).toString();
  if (from) query.from = (from._id || from).toString();
  if (moment) query.moment = (moment._id || moment).toString();

  await Notification.deleteMany(query);
};

module.exports = {
  createNotification,
  removeNotification
};
