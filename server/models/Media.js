const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['image', 'video'],
    required: true
  },
  status: {
    type: String,
    enum: ['processing', 'ready', 'failed'],
    default: 'processing',
    index: true
  },
  failureReason: {
    type: String,
    default: null
  },
  originalName: {
    type: String,
    required: true
  },
  mime: {
    type: String,
    required: true
  },
  sizeBytes: {
    type: Number,
    default: 0
  },
  width: {
    type: Number,
    default: null
  },
  height: {
    type: Number,
    default: null
  },
  durationSec: {
    type: Number,
    default: null
  },
  takenAt: {
    type: Date,
    default: null
  },
  caption: {
    type: String,
    maxlength: 300,
    trim: true,
    default: ''
  },
  place: {
    type: String,
    maxlength: 80,
    trim: true,
    default: ''
  },
  blurDataUrl: {
    type: String,
    default: null
  },
  paths: {
    original: { type: String, default: null },
    display: { type: String, default: null },
    thumb: { type: String, default: null },
    video: { type: String, default: null },
    poster: { type: String, default: null }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

mediaSchema.index({ owner: 1, createdAt: -1 });
mediaSchema.index({ owner: 1, takenAt: -1 });

mediaSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Media', mediaSchema);

