const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateTokenAndSetCookie = (res, userId) => {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });

  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  };

  res.cookie('token', token, cookieOptions);
  return token;
};

const register = async (req, res, next) => {
  try {
    const { username, email, password, displayName, bio } = req.body;

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(409).json({
        message: 'Registration failed',
        errors: { email: 'Email is already in use' }
      });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(409).json({
        message: 'Registration failed',
        errors: { username: 'Username is already in use' }
      });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      username,
      email,
      passwordHash,
      displayName: displayName || username,
      bio: bio || '',
      avatarPath: null,
      storageUsedBytes: 0
    });

    generateTokenAndSetCookie(res, user._id);

    res.status(201).json({
      message: 'Registration successful',
      user
    });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const identifier = req.body.identifier || req.body.email || req.body.username;
    const { password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Identifier and password are required' });
    }

    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier.toLowerCase() }
      ]
    }).select('+passwordHash');

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    generateTokenAndSetCookie(res, user._id);

    res.status(200).json({
      message: 'Login successful',
      user
    });
  } catch (err) {
    next(err);
  }
};

const logout = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });

  res.status(200).json({ message: 'Logged out successfully' });
};

const getMe = async (req, res) => {
  res.status(200).json({ user: req.user });
};

module.exports = {
  register,
  login,
  logout,
  getMe
};
