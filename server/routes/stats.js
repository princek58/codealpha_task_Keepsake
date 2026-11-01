const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');

let cachedStats = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000;

function resetStatsCache() {
  cachedStats = null;
  cacheTimestamp = 0;
}

router.get('/', async (req, res, next) => {
  try {
    const now = Date.now();
    if (cachedStats && now - cacheTimestamp < CACHE_TTL_MS) {
      return res.status(200).json(cachedStats);
    }

    const [users, posts] = await Promise.all([
      User.countDocuments(),
      Post.countDocuments()
    ]);

    cachedStats = { users, posts };
    cacheTimestamp = now;

    res.status(200).json(cachedStats);
  } catch (err) {
    next(err);
  }
});

router.resetStatsCache = resetStatsCache;

module.exports = router;
