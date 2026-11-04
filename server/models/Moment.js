const mongoose = require('mongoose');
const config = require('../config');

const momentSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    trim: true,
    maxlength: [80, 'Title cannot exceed 80 characters'],
    default: ''
  },
  caption: {
    type: String,
    trim: true,
    maxlength: [1000, 'Caption cannot exceed 1000 characters'],
    default: ''
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
        return Array.isArray(val) && val.length >= 1 && val.length <= (config.maxItemsPerMoment || 20);
      },
      message: `Media array must contain between 1 and ${config.maxItemsPerMoment || 20} items`
    },
    required: true
  },
  layout: {
    type: {
      type: String,
      enum: ['collage', 'grid', 'carousel'],
      default: 'grid'
    },
    template: {
      type: String,
      maxlength: 30,
      default: 'grid'
    },
    gap: {
      type: Number,
      min: 0,
      max: 24,
      default: 8
    },
    background: {
      type: String,
      match: [/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Background must be a valid hex color'],
      default: '#ffffff'
    }
  },
  takenOn: {
    type: Date,
    default: Date.now
  },
  place: {
    type: String,
    trim: true,
    maxlength: [80, 'Place cannot exceed 80 characters'],
    default: ''
  },
  tags: {
    type: [
      {
        type: String,
        trim: true,
        lowercase: true,
        minlength: 1,
        maxlength: 24
      }
    ],
    validate: {
      validator: function (val) {
        return !val || val.length <= 8;
      },
      message: 'A moment can have at most 8 tags'
    },
    default: []
  },
  visibility: {
    type: String,
    enum: ['public', 'followers', 'private'],
    default: 'followers',
    index: true
  },
  likes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  ],
  commentsCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

momentSchema.index({ owner: 1, createdAt: -1 });
momentSchema.index({ visibility: 1, createdAt: -1 });
momentSchema.index({ takenOn: -1 });
momentSchema.index({ media: 1 });

momentSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Moment', momentSchema);

