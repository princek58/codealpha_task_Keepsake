const mongoose = require('mongoose');
const config = require('../config');

const albumSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Album title is required'],
      trim: true,
      minlength: [1, 'Album title must be at least 1 character'],
      maxlength: [80, 'Album title cannot exceed 80 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: ''
    },
    cover: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Media',
      default: null
    },
    media: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Media'
        }
      ],
      validate: {
        validator: function (val) {
          return !val || val.length <= (config.maxItemsPerAlbum || 500);
        },
        message: `Album cannot contain more than ${config.maxItemsPerAlbum || 500} items`
      },
      default: []
    },
    visibility: {
      type: String,
      enum: ['public', 'followers', 'private'],
      default: 'private',
      index: true
    },
    shareToken: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

albumSchema.index({ owner: 1, updatedAt: -1 });
albumSchema.index({ media: 1 });
albumSchema.index(
  { shareToken: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { shareToken: { $type: 'string' } }
  }
);

albumSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Album', albumSchema);
