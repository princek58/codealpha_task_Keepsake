const sharp = require('sharp');
const exifr = require('exifr');
const storage = require('../storage');

sharp.cache(false);

const processImage = async ({ userId, mediaId, sourcePath, ext }) => {
  let exifData = null;
  try {
    exifData = await exifr.parse(sourcePath, ['DateTimeOriginal', 'CreateDate', 'Orientation']);
  } catch {
    // If EXIF parse fails, continue with null
  }

  let takenAt = null;
  if (exifData && (exifData.DateTimeOriginal || exifData.CreateDate)) {
    const rawDate = exifData.DateTimeOriginal || exifData.CreateDate;
    const parsedDate = new Date(rawDate);
    if (!isNaN(parsedDate.getTime())) {
      takenAt = parsedDate;
    }
  }

  const meta = await sharp(sourcePath, { failOn: 'error' }).metadata();
  if (!meta.width || !meta.height) {
    throw new Error('Unable to determine image dimensions');
  }

  let width = meta.width;
  let height = meta.height;
  if (meta.orientation && meta.orientation >= 5 && meta.orientation <= 8) {
    width = meta.height;
    height = meta.width;
  }

  // Generate variants
  // display: max 1600px longest side, webp quality 82, metadata stripped
  const displayBuf = await sharp(sourcePath, { failOn: 'error' })
    .rotate()
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  // thumb: max 480px longest side, webp quality 75, metadata stripped
  const thumbBuf = await sharp(sourcePath, { failOn: 'error' })
    .rotate()
    .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer({ resolveWithObject: true });

  // blurDataUrl: 16-24px wide, tiny webp, base64 data URL
  const blurBuf = await sharp(sourcePath, { failOn: 'error' })
    .rotate()
    .resize(20, 20, { fit: 'inside' })
    .webp({ quality: 20 })
    .toBuffer();
  const blurDataUrl = `data:image/webp;base64,${blurBuf.toString('base64')}`;

  const originalRelPath = `${userId}/${mediaId}/original.${ext || 'jpg'}`;
  const displayRelPath = `${userId}/${mediaId}/display.webp`;
  const thumbRelPath = `${userId}/${mediaId}/thumb.webp`;

  await storage.save(sourcePath, originalRelPath);
  await storage.writeBuffer(displayRelPath, displayBuf.data);
  await storage.writeBuffer(thumbRelPath, thumbBuf.data);

  const origStat = await storage.stat(originalRelPath);
  const totalSizeBytes = origStat.size + displayBuf.info.size + thumbBuf.info.size;

  return {
    width,
    height,
    takenAt,
    blurDataUrl,
    sizeBytes: totalSizeBytes,
    paths: {
      original: originalRelPath,
      display: displayRelPath,
      thumb: thumbRelPath,
      video: null,
      poster: null
    }
  };
};

module.exports = {
  processImage
};

