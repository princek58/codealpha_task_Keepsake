const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const parsePositiveInt = (name, val, defaultValue, max = Infinity) => {
  if (val === undefined || val === '') return defaultValue;
  const parsed = Number(val);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) {
    throw new Error(`Invalid configuration: ${name} must be a positive integer between 1 and ${max}, got "${val}"`);
  }
  return parsed;
};

const resolveStorageDir = (dirVal) => {
  if (!dirVal) {
    return path.resolve(__dirname, '..', 'storage');
  }
  return path.isAbsolute(dirVal) ? path.normalize(dirVal) : path.resolve(process.cwd(), dirVal);
};

const parseTrustProxy = (val, isProd) => {
  if (val === undefined || val === '') {
    return isProd ? 1 : false;
  }
  if (val === 'true' || val === '1') return 1;
  if (val === 'false' || val === '0') return false;
  const num = Number(val);
  if (!Number.isNaN(num) && num >= 0) return num;
  return val; // Allow string like 'loopback'
};

const env = process.env.NODE_ENV || 'development';
const isProduction = env === 'production';
const port = parsePositiveInt('PORT', process.env.PORT, 5000, 65535);

const publicUrl = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || process.env.CLIENT_ORIGIN || `http://localhost:${port}`;
const clientOrigin = process.env.CLIENT_ORIGIN || publicUrl;

const collectAllowedOrigins = () => {
  const origins = new Set();
  const add = (urlStr) => {
    if (!urlStr) return;
    try {
      const u = new URL(urlStr);
      origins.add(u.origin);
    } catch {
      origins.add(urlStr.trim());
    }
  };

  add(publicUrl);
  add(clientOrigin);
  add(process.env.RENDER_EXTERNAL_URL);

  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',').forEach((o) => add(o.trim()));
  }

  // Localhost defaults for development/test
  if (!isProduction) {
    origins.add(`http://localhost:${port}`);
    origins.add(`http://127.0.0.1:${port}`);
  }

  return Array.from(origins);
};

const config = {
  env,
  isProduction,
  port,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY, isProduction),
  publicUrl,
  clientOrigin,
  allowedOrigins: collectAllowedOrigins(),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/keepsake',
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_key_keepsake_change_in_production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  storageDir: resolveStorageDir(process.env.STORAGE_DIR),
  demoMode: process.env.DEMO_MODE === 'true',
  seedDemoOnBoot: process.env.SEED_DEMO_ON_BOOT === 'true',
  reconcileStorageOnBoot: process.env.RECONCILE_STORAGE_ON_BOOT === 'true',

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
