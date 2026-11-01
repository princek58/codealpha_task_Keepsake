const express = require('express');
const { param } = require('express-validator');
const { deleteComment } = require('../controllers/commentsController');
const protect = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.delete(
  '/:id',
  protect,
  [param('id').isMongoId().withMessage('Invalid comment id')],
  validate,
  deleteComment
);

module.exports = router;
