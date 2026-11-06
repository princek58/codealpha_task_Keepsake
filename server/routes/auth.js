const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { register, login, logout, getMe } = require('../controllers/authController');
const protect = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many registration attempts, please try again later' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') ? 10 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts, please try again later' }
});

const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one letter and one number'),
  body('displayName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Display name cannot exceed 50 characters'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage('Bio cannot exceed 160 characters')
];

const loginValidation = [
  body('identifier')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Identifier cannot be empty if provided'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  body().custom((value, { req }) => {
    if (!req.body.identifier && !req.body.email && !req.body.username) {
      throw new Error('Please provide an email or username');
    }
    return true;
  })
];

router.post('/register', registerLimiter, registerValidation, validate, register);
router.post('/login', loginLimiter, loginValidation, validate, login);
router.post('/logout', logout);
router.get('/me', protect, getMe);

router.loginLimiter = loginLimiter;
router.registerLimiter = registerLimiter;

module.exports = router;
