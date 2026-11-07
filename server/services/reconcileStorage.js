const fs = require('fs');
const path = require('path');
const config = require('../config');
const Media = require('../models/Media');
const Moment = require('../models/Moment');
const Album = require('../models/Album');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');

async function reconcileStorage() {
  if (!fs.existsSync(config.storageDir)) {
    fs.mkdirSync(config.storageDir, { recursive: true });
    console.warn('[StorageReconcile] Storage directory did not exist. Initialized fresh storage directory.');
    return { purgedMedia: 0, deletedMoments: 0 };
  }

  const allMedia = await Media.find({});
  let purgedMediaCount = 0;
  const missingMediaIds = [];

  for (const mediaDoc of allMedia) {
    const checkRel = mediaDoc.paths?.display || mediaDoc.paths?.video || mediaDoc.paths?.original;
    if (!checkRel) {
      continue;
    }

    const fullPath = path.resolve(config.storageDir, checkRel);
    if (!fs.existsSync(fullPath)) {
      missingMediaIds.push(mediaDoc._id);
      purgedMediaCount++;

      // Adjust user storage used
      if (mediaDoc.owner && mediaDoc.sizeBytes) {
        await User.findByIdAndUpdate(mediaDoc.owner, {
          $inc: { storageUsedBytes: -mediaDoc.sizeBytes }
        });
      }

      // Remove from albums
      await Album.updateMany(
        { media: mediaDoc._id },
        { $pull: { media: mediaDoc._id } }
      );
      await Album.updateMany(
        { cover: mediaDoc._id },
        { $set: { cover: null } }
      );

      // Remove from moments
      await Moment.updateMany(
        { media: mediaDoc._id },
        { $pull: { media: mediaDoc._id } }
      );

      await Media.deleteOne({ _id: mediaDoc._id });
    }
  }

  // Delete moments that now have zero media attached
  const emptyMoments = await Moment.find({ media: { $size: 0 } });
  const emptyMomentIds = emptyMoments.map((m) => m._id);

  if (emptyMomentIds.length > 0) {
    await Comment.deleteMany({ moment: { $in: emptyMomentIds } });
    await Notification.deleteMany({ moment: { $in: emptyMomentIds } });
    await Moment.deleteMany({ _id: { $in: emptyMomentIds } });
  }

  console.log(`[StorageReconcile] Storage reconciled: ${purgedMediaCount} orphan media records purged, ${emptyMomentIds.length} empty moments deleted.`);
  return { purgedMedia: purgedMediaCount, deletedMoments: emptyMomentIds.length };
}

module.exports = { reconcileStorage };

