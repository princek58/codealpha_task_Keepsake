const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  moment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Moment',
    required: [true, 'Moment is required']
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Author is required']
  },
  text: {
    type: String,
    required: [true, 'Text is required'],
    trim: true,
    maxlength: [300, 'Text cannot exceed 300 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

commentSchema.index({ moment: 1, createdAt: -1 });
commentSchema.index({ moment: 1, createdAt: 1 });

commentSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Comment', commentSchema);
