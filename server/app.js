require('dotenv').config();

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const mediaRoutes = require('./routes/media');
const momentsRoutes = require('./routes/moments');
const albumsRoutes = require('./routes/albums');
const commentsRoutes = require('./routes/comments');
const notificationsRoutes = require('./routes/notifications');
const statsRoutes = require('./routes/stats');
const csrfCheck = require('./middleware/csrfCheck');
const errorHandler = require('./middleware/errorHandler');
const config = require('./config');

const app = express();

let demoReadyState = !config.demoMode;
const setDemoReady = (ready) => {
  demoReadyState = Boolean(ready);
};
app.setDemoReady = setDemoReady;

if (config.trustProxy !== false) {
  app.set('trust proxy', config.trustProxy);
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdnjs.cloudflare.com", "'unsafe-inline'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        mediaSrc: ["'self'", "blob:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
      }
    },
    crossOriginResourcePolicy: { policy: 'same-origin' }
  })
);

app.use(compression());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.use(cookieParser());

app.use(mongoSanitize());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed = config.allowedOrigins.some((allowed) => {
        try {
          return new URL(origin).host === new URL(allowed).host;
        } catch {
          return false;
        }
      });
      if (isAllowed || (!config.isProduction && (origin.includes('localhost') || origin.includes('127.0.0.1')))) {
        return callback(null, true);
      }
      callback(null, false);
    },
    credentials: true
  })
);

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isProduction ? 200 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later' }
});

app.use('/api', csrfCheck);
app.use('/api', generalLimiter);

app.get('/api/health', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  const isReady = isConnected && demoReadyState;
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ok' : 'degraded',
    uptime: Math.round(process.uptime() * 10) / 10,
    database: isConnected ? 'connected' : 'disconnected',
    demoReady: demoReadyState,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    demoMode: config.demoMode,
    limits: {
      maxImageMb: config.maxImageMb,
      maxVideoMb: config.maxVideoMb,
      maxVideoSeconds: config.maxVideoSeconds,
      userQuotaMb: config.userQuotaMb,
      maxFilesPerRequest: config.maxFilesPerRequest
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/moments', momentsRoutes);
app.use('/api/albums', albumsRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/stats', statsRoutes);

if (process.env.NODE_ENV === 'production') {
  app.use('/dev', (req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../client/404.html'));
  });
}

app.use(express.static(path.join(__dirname, '../client')));

app.all('/api/*', (req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

app.use((req, res, next) => {
  if (req.method === 'GET' && req.accepts('html')) {
    return res.status(404).sendFile(path.join(__dirname, '../client/404.html'));
  }
  next();
});

app.use(errorHandler);

module.exports = app;
