const mongoose = require('mongoose');

const STICKER_ENUM = [
  'heart',
  'star',
  'sparkle',
  'flower',
  'cloud',
  'moon',
  'smiley_blob',
  'smiley blob',
  'smiley-blob',
  'butterfly',
  'bow',
  'cherry',
  'plant',
  'sprout',
  'tiny house plant',
  'tiny-house-plant'
];

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    lowercase: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [20, 'Username cannot exceed 20 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  passwordHash: {
    type: String,
    required: [true, 'Password hash is required'],
    select: false
  },
  displayName: {
    type: String,
    trim: true,
    maxlength: [50, 'Display name cannot exceed 50 characters'],
    default: function () {
      return this.username || '';
    }
  },
  bio: {
    type: String,
    trim: true,
    maxlength: [160, 'Bio cannot exceed 160 characters'],
    default: ''
  },
  avatar: {
    type: String,
    default: ''
  },
  moodSticker: {
    type: String,
    enum: {
      values: STICKER_ENUM,
      message: 'Invalid mood sticker'
    },
    default: 'flower'
  },
  followers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  ],
  following: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

userSchema.virtual('mood')
  .get(function () {
    return this.moodSticker;
  })
  .set(function (val) {
    this.moodSticker = val;
  });

userSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  }
});

userSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
module.exports.STICKER_ENUM = STICKER_ENUM;
