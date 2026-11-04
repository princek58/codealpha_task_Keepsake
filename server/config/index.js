const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const parsePositiveInt = (name, val, defaultValue) => {
  if (val === undefined || val === '') return defaultValue;
  const parsed = Number(val);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid configuration: ${name} must be a positive integer, got "${val}"`);
  }
  return parsed;
};

const resolveStorageDir = (dirVal) => {
  if (!dirVal) {
    return path.resolve(__dirname, '..', 'storage');
  }
  return path.isAbsolute(dirVal) ? path.normalize(dirVal) : path.resolve(process.cwd(), dirVal);
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parsePositiveInt('PORT', process.env.PORT, 5000),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/keepsake',
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_key_keepsake_change_in_production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5000',

  storageDir: resolveStorageDir(process.env.STORAGE_DIR),
  maxImageMb: parsePositiveInt('MAX_IMAGE_MB', process.env.MAX_IMAGE_MB, 20),
  maxVideoMb: parsePositiveInt('MAX_VIDEO_MB', process.env.MAX_VIDEO_MB, 150),
  maxVideoSeconds: parsePositiveInt('MAX_VIDEO_SECONDS', process.env.MAX_VIDEO_SECONDS, 180),
  maxFilesPerRequest: parsePositiveInt('MAX_FILES_PER_REQUEST', process.env.MAX_FILES_PER_REQUEST, 10),
  maxItemsPerMoment: parsePositiveInt('MAX_ITEMS_PER_MOMENT', process.env.MAX_ITEMS_PER_MOMENT, 20),
  maxItemsPerAlbum: parsePositiveInt('MAX_ITEMS_PER_ALBUM', process.env.MAX_ITEMS_PER_ALBUM, 500),
  userQuotaMb: parsePositiveInt('USER_QUOTA_MB', process.env.USER_QUOTA_MB, 500),
  videoConcurrency: parsePositiveInt('VIDEO_CONCURRENCY', process.env.VIDEO_CONCURRENCY, 1),

  get maxImageBytes() {
    return this.maxImageMb * 1024 * 1024;
  },
  get maxVideoBytes() {
    return this.maxVideoMb * 1024 * 1024;
  },
  get userQuotaBytes() {
    return this.userQuotaMb * 1024 * 1024;
  }
};

module.exports = config;

