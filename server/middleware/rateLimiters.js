const rateLimit = require('express-rate-limit');

const actionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many actions, please slow down' }
});

module.exports = {
  actionLimiter
};

