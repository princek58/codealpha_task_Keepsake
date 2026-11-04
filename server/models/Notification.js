const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Recipient (to) is required']
  },
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender (from) is required']
  },
  type: {
    type: String,
    required: [true, 'Notification type is required'],
    enum: {
      values: ['like', 'comment', 'follow'],
      message: 'Type must be like, comment, or follow'
    }
  },
  moment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Moment',
    default: null
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

notificationSchema.index({ to: 1, createdAt: -1 });
notificationSchema.index({ to: 1, read: 1, createdAt: -1 });

notificationSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Notification', notificationSchema);
