const express = require('express');
const { protect, optionalAuth } = require('../middleware/auth');
const { actionLimiter } = require('../middleware/rateLimiters');
const albumsController = require('../controllers/albumsController');

const router = express.Router();

router.post('/', protect, actionLimiter, albumsController.createAlbum);
router.get('/', protect, albumsController.getMyAlbums);

router.get('/shared/:token', albumsController.getSharedAlbum);
router.get('/user/:username', optionalAuth, albumsController.getUserAlbums);

router.get('/:id', optionalAuth, albumsController.getAlbumById);
router.patch('/:id', protect, albumsController.updateAlbum);
router.delete('/:id', protect, albumsController.deleteAlbum);

router.post('/:id/media', protect, actionLimiter, albumsController.addMedia);
router.delete('/:id/media/:mediaId', protect, albumsController.removeMedia);
router.put('/:id/order', protect, albumsController.reorderMedia);

router.post('/:id/share', protect, actionLimiter, albumsController.createShareToken);
router.delete('/:id/share', protect, albumsController.deleteShareToken);

module.exports = router;

