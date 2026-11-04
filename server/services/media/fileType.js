const FileType = require('file-type');
const fs = require('fs');

const ALLOWED_IMAGE_MIMES = {
  'image/jpeg': { type: 'image', ext: 'jpg' },
  'image/png': { type: 'image', ext: 'png' },
  'image/webp': { type: 'image', ext: 'webp' },
  'image/gif': { type: 'image', ext: 'gif' }
};

const ALLOWED_VIDEO_MIMES = {
  'video/mp4': { type: 'video', ext: 'mp4' },
  'video/quicktime': { type: 'video', ext: 'mov' },
  'video/webm': { type: 'video', ext: 'webm' }
};

const detectFileType = async (filePath) => {
  let detected = null;
  try {
    detected = await FileType.fromFile(filePath);
  } catch {
    // If fromFile fails, we will check magic bytes below
  }

  // Check magic bytes directly if needed (e.g. partial/small buffers)
  if (!detected) {
    try {
      const fd = await fs.promises.open(filePath, 'r');
      const buf = Buffer.alloc(32);
      await fd.read(buf, 0, 32, 0);
      await fd.close();
      detected = await FileType.fromBuffer(buf);
      if (!detected && buf.length >= 12) {
        const brand = buf.toString('latin1', 4, 12);
        if (brand.startsWith('ftyp') && (brand.includes('heic') || brand.includes('mif1') || brand.includes('hevc'))) {
          detected = { ext: 'heic', mime: 'image/heic' };
        }
      }
    } catch {
      // Ignored, fallback below
    }
  }

  if (detected && (detected.mime === 'image/heic' || detected.mime === 'image/heif' || detected.ext === 'heic' || detected.ext === 'heif')) {
    return {
      ok: false,
      code: 'UNSUPPORTED_HEIC',
      message: 'HEIC format is not supported. Please convert your photo to JPG or PNG before uploading.'
    };
  }

  if (detected && ALLOWED_IMAGE_MIMES[detected.mime]) {
    const meta = ALLOWED_IMAGE_MIMES[detected.mime];
    return {
      ok: true,
      type: meta.type,
      mime: detected.mime,
      ext: meta.ext
    };
  }

  if (detected && ALLOWED_VIDEO_MIMES[detected.mime]) {
    const meta = ALLOWED_VIDEO_MIMES[detected.mime];
    return {
      ok: true,
      type: meta.type,
      mime: detected.mime,
      ext: meta.ext
    };
  }

  return {
    ok: false,
    code: 'UNSUPPORTED_FILE_TYPE',
    message: 'File type not supported. Allowed formats: JPG, PNG, WebP, GIF, MP4, MOV, WebM.'
  };
};

module.exports = {
  detectFileType,
  ALLOWED_IMAGE_MIMES,
  ALLOWED_VIDEO_MIMES
};

