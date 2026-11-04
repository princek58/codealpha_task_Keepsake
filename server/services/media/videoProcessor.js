const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const config = require('../../config');
const storage = require('../storage');

const runProcess = (command, args, timeoutMs = 60000) => {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const proc = spawn(command, args);

    let isDone = false;
    const timer = setTimeout(() => {
      if (!isDone) {
        isDone = true;
        try {
          proc.kill('SIGKILL');
        } catch {
          // Ignore kill error
        }
        reject(new Error(`Process timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    proc.stdout.on('data', (d) => {
      stdout += d;
    });

    proc.stderr.on('data', (d) => {
      stderr += d;
    });

    proc.on('error', (err) => {
      if (!isDone) {
        isDone = true;
        clearTimeout(timer);
        reject(err);
      }
    });

    proc.on('close', (code) => {
      if (!isDone) {
        isDone = true;
        clearTimeout(timer);
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Process exited with code ${code}: ${stderr || stdout}`));
        }
      }
    });
  });
};

const probeVideo = async (filePath) => {
  const args = [
    '-v',
    'error',
    '-show_entries',
    'format=duration:format_tags=creation_time:stream=width,height,codec_type,duration:stream_tags=creation_time',
    '-of',
    'json',
    filePath
  ];

  let res;
  try {
    res = await runProcess(ffprobePath, args, 15000);
  } catch (err) {
    throw new Error(`Video probe failed: ${err.message}`);
  }

  let data;
  try {
    data = JSON.parse(res.stdout);
  } catch {
    throw new Error('Unable to parse video probe metadata');
  }

  const videoStream = data.streams?.find((s) => s.codec_type === 'video');
  if (!videoStream) {
    throw new Error('No video stream found in file');
  }

  const rawDuration = parseFloat(data.format?.duration || videoStream.duration || 0);
  if (!rawDuration || isNaN(rawDuration) || rawDuration <= 0) {
    throw new Error('Video duration could not be determined');
  }

  const durationSec = Math.round(rawDuration);
  if (durationSec > config.maxVideoSeconds) {
    throw new Error(`Video duration of ${durationSec}s exceeds the maximum limit of ${config.maxVideoSeconds}s`);
  }

  const hasAudio = !!data.streams?.some((s) => s.codec_type === 'audio');

  let creationTime = null;
  const rawCreation = data.format?.tags?.creation_time || videoStream.tags?.creation_time;
  if (rawCreation) {
    const parsed = new Date(rawCreation);
    if (!isNaN(parsed.getTime())) {
      creationTime = parsed;
    }
  }

  return {
    durationSec,
    width: videoStream.width || null,
    height: videoStream.height || null,
    hasAudio,
    creationTime
  };
};

const processVideo = async ({ userId, mediaId, sourcePath, ext }) => {
  const probe = await probeVideo(sourcePath);

  const tmpDir = storage.getTmpDir();
  const tmpVideoOut = path.join(tmpDir, `transcode_${mediaId}.mp4`);
  const tmpPosterOut = path.join(tmpDir, `poster_${mediaId}.jpg`);

  const cleanupPartial = async () => {
    try {
      await fs.promises.unlink(tmpVideoOut);
    } catch {}
    try {
      await fs.promises.unlink(tmpPosterOut);
    } catch {}
  };

  try {
    // 1. Transcode video: H.264 capped at 720p, CRF 26, preset veryfast, AAC 128k, faststart, stripped metadata
    const transcodeArgs = [
      '-i',
      sourcePath,
      '-vf',
      "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2",
      '-c:v',
      'libx264',
      '-crf',
      '26',
      '-preset',
      'veryfast',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-map_metadata',
      '-1'
    ];

    if (probe.hasAudio) {
      transcodeArgs.push('-c:a', 'aac', '-b:a', '128k');
    } else {
      transcodeArgs.push('-an');
    }

    transcodeArgs.push('-y', tmpVideoOut);

    // Dynamic timeout based on duration (minimum 60s, up to 300s)
    const timeoutMs = Math.max(60000, probe.durationSec * 3000);
    await runProcess(ffmpegPath, transcodeArgs, timeoutMs);

    // 2. Extract poster frame at 1s (or 0s if very short)
    const seekTime = probe.durationSec <= 1 ? '00:00:00' : '00:00:01';
    const posterArgs = [
      '-ss',
      seekTime,
      '-i',
      sourcePath,
      '-vframes',
      '1',
      '-vf',
      "scale='min(960,iw)':'min(960,ih)':force_original_aspect_ratio=decrease",
      '-y',
      tmpPosterOut
    ];

    await runProcess(ffmpegPath, posterArgs, 20000);

    // 3. Process poster with sharp to strip metadata and create blurDataUrl
    const posterMeta = await sharp(tmpPosterOut).metadata();
    const width = posterMeta.width || probe.width;
    const height = posterMeta.height || probe.height;

    const blurBuf = await sharp(tmpPosterOut)
      .resize(20, 20, { fit: 'inside' })
      .webp({ quality: 20 })
      .toBuffer();
    const blurDataUrl = `data:image/webp;base64,${blurBuf.toString('base64')}`;

    // 4. Move files to permanent storage
    const originalRelPath = `${userId}/${mediaId}/original.${ext || 'mp4'}`;
    const videoRelPath = `${userId}/${mediaId}/video.mp4`;
    const posterRelPath = `${userId}/${mediaId}/poster.jpg`;

    await storage.save(sourcePath, originalRelPath);
    await storage.save(tmpVideoOut, videoRelPath);
    await storage.save(tmpPosterOut, posterRelPath);

    const origStat = await storage.stat(originalRelPath);
    const videoStat = await storage.stat(videoRelPath);
    const posterStat = await storage.stat(posterRelPath);
    const totalSizeBytes = origStat.size + videoStat.size + posterStat.size;

    return {
      width,
      height,
      durationSec: probe.durationSec,
      takenAt: probe.creationTime,
      blurDataUrl,
      sizeBytes: totalSizeBytes,
      paths: {
        original: originalRelPath,
        display: null,
        thumb: null,
        video: videoRelPath,
        poster: posterRelPath
      }
    };
  } catch (err) {
    await cleanupPartial();
    throw err;
  }
};

module.exports = {
  probeVideo,
  processVideo
};

