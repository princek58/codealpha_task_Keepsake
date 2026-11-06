// Keepsake Upload Manager & Drop Zone UI Component
import { getMediaLimits, uploadFilesWithProgress, getMediaStatus, getMyStorage } from './api.js';
import { formatBytes } from './ui.js';
import { icon } from './icons.js';

export class UploadManager {
  constructor(options = {}) {
    this.options = {
      maxConcurrent: 3,
      onQueueChange: null,
      onFileProgress: null,
      onFileStatus: null,
      onAllFinished: null,
      ...options
    };

    this.queue = []; // Array of UploadItem
    this.inFlight = 0;
    this.limits = null;
    this.isPolling = false;
    this.pollTimer = null;
    this.pollBackoff = 2000;

    this.initLimits();
    this.initTabVisibility();
  }

  async initLimits() {
    try {
      this.limits = await getMediaLimits();
    } catch {
      // Fallback defaults
      this.limits = {
        maxImageBytes: 20 * 1024 * 1024,
        maxVideoBytes: 150 * 1024 * 1024,
        maxVideoSeconds: 180,
        maxFilesPerRequest: 10,
        allowedImageMimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        allowedVideoMimes: ['video/mp4', 'video/quicktime', 'video/webm']
      };
    }
  }

  initTabVisibility() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.pausePolling();
        } else {
          this.resumePolling();
        }
      });
    }
  }

  validateFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const type = file.type.toLowerCase();

    if (ext === 'heic' || ext === 'heif') {
      return {
        valid: false,
        code: 'UNSUPPORTED_HEIC',
        message: 'HEIC photos are not directly supported yet. Please convert to JPG or PNG before uploading.'
      };
    }

    const isImageExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
    const isVideoExt = ['mp4', 'mov', 'webm'].includes(ext);

    if (!isImageExt && !isVideoExt) {
      return {
        valid: false,
        code: 'UNSUPPORTED_FILE_TYPE',
        message: `File "${file.name}" has an unsupported format. Allowed: JPG, PNG, WebP, GIF, MP4, MOV, WebM.`
      };
    }

    const maxImg = this.limits?.maxImageBytes || 20 * 1024 * 1024;
    const maxVid = this.limits?.maxVideoBytes || 150 * 1024 * 1024;

    if (isImageExt && file.size > maxImg) {
      return {
        valid: false,
        code: 'LIMIT_FILE_SIZE',
        message: `Image "${file.name}" exceeds maximum allowed size of ${formatBytes(maxImg)}.`
      };
    }

    if (isVideoExt && file.size > maxVid) {
      return {
        valid: false,
        code: 'LIMIT_FILE_SIZE',
        message: `Video "${file.name}" exceeds maximum allowed size of ${formatBytes(maxVid)}.`
      };
    }

    return { valid: true, isVideo: isVideoExt };
  }

  addFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    const addedItems = [];

    Array.from(fileList).forEach((file) => {
      const validation = this.validateFile(file);
      let previewUrl = null;
      if (validation.valid && file.type && file.type.startsWith('image/') && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        previewUrl = URL.createObjectURL(file);
      }

      const item = {
        id: `upload_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        file,
        name: file.name,
        size: file.size,
        isVideo: validation.isVideo || false,
        previewUrl,
        valid: validation.valid,
        status: validation.valid ? 'pending' : 'failed', // pending, uploading, processing, ready, failed, cancelled
        error: validation.valid ? null : validation.message,
        percent: 0,
        loaded: 0,
        mediaDoc: null,
        abortFn: null
      };

      this.queue.push(item);
      addedItems.push(item);
    });

    this.emitChange();
    this.processQueue();
    return addedItems;
  }

  processQueue() {
    const pending = this.queue.filter((i) => i.status === 'pending');
    if (pending.length === 0) {
      this.checkAllFinished();
      return;
    }

    while (this.inFlight < this.options.maxConcurrent && pending.length > 0) {
      const batchLimit = this.limits?.maxFilesPerRequest || 10;
      const batch = pending.splice(0, Math.min(batchLimit, this.options.maxConcurrent - this.inFlight));
      if (batch.length === 0) break;

      this.uploadBatch(batch);
    }
  }

  uploadBatch(items) {
    this.inFlight += items.length;
    items.forEach((item) => {
      item.status = 'uploading';
      item.percent = 0;
    });
    this.emitChange();

    const formData = new FormData();
    items.forEach((item) => {
      formData.append('files', item.file);
    });

    const { promise, abort } = uploadFilesWithProgress(
      '/api/media/upload',
      formData,
      ({ loaded, total, percent }) => {
        items.forEach((item) => {
          item.percent = percent;
          item.loaded = Math.round((item.size / total) * loaded);
          if (this.options.onFileProgress) this.options.onFileProgress(item);
        });
        this.emitChange();
      }
    );

    items.forEach((i) => {
      i.abortFn = abort;
    });

    promise
      .then((data) => {
        this.inFlight -= items.length;

        // Map responses back to items
        const returnedItems = data.items || [];
        const returnedErrors = data.errors || [];

        items.forEach((item) => {
          if (item.previewUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(item.previewUrl);
            item.previewUrl = null;
          }

          const matchedDoc = returnedItems.find((d) => d.originalName === item.name);
          const matchedErr = returnedErrors.find((e) => e.originalName === item.name);

          if (matchedDoc) {
            item.mediaDoc = matchedDoc;
            if (matchedDoc.status === 'ready') {
              item.status = 'ready';
              item.percent = 100;
            } else {
              item.status = 'processing';
            }
          } else if (matchedErr) {
            item.status = 'failed';
            item.error = matchedErr.message;
          } else {
            item.status = 'ready';
            item.percent = 100;
          }
        });

        this.emitChange();
        this.processQueue();
        this.checkVideoPolling();
      })
      .catch((err) => {
        this.inFlight -= items.length;
        items.forEach((item) => {
          if (item.status === 'uploading') {
            item.status = 'failed';
            item.error = err.message || 'Upload failed';
          }
        });
        this.emitChange();
        this.processQueue();
      });
  }

  cancelItem(id) {
    const item = this.queue.find((i) => i.id === id);
    if (!item) return;

    if (item.status === 'uploading' && item.abortFn) {
      item.abortFn();
    }
    item.status = 'cancelled';
    item.error = 'Cancelled';
    this.emitChange();
    this.processQueue();
  }

  retryItem(id) {
    const item = this.queue.find((i) => i.id === id);
    if (!item) return;

    item.status = 'pending';
    item.error = null;
    item.percent = 0;
    this.emitChange();
    this.processQueue();
  }

  checkVideoPolling() {
    const processingItems = this.queue.filter((i) => i.status === 'processing');
    if (processingItems.length > 0 && !this.isPolling) {
      this.isPolling = true;
      this.pollBackoff = 2000;
      this.pollVideos();
    }
  }

  async pollVideos() {
    if (!this.isPolling || document.hidden) return;

    const processingItems = this.queue.filter((i) => i.status === 'processing');
    if (processingItems.length === 0) {
      this.isPolling = false;
      this.checkAllFinished();
      return;
    }

    const ids = processingItems
      .map((i) => i.mediaDoc?.id)
      .filter(Boolean);

    if (ids.length === 0) {
      this.isPolling = false;
      return;
    }

    try {
      const res = await getMediaStatus(ids);
      const docs = res.items || [];

      docs.forEach((doc) => {
        const item = processingItems.find((i) => i.mediaDoc?.id === doc.id);
        if (item) {
          item.mediaDoc = doc;
          if (doc.status === 'ready') {
            item.status = 'ready';
            item.percent = 100;
          } else if (doc.status === 'failed') {
            item.status = 'failed';
            item.error = doc.failureReason || 'Processing failed';
          }
        }
      });

      this.emitChange();
      // Increase backoff slightly up to 8s
      this.pollBackoff = Math.min(8000, this.pollBackoff * 1.25);
    } catch {
      // Ignore polling transient errors
    }

    const stillProcessing = this.queue.some((i) => i.status === 'processing');
    if (stillProcessing) {
      this.pollTimer = setTimeout(() => this.pollVideos(), this.pollBackoff);
    } else {
      this.isPolling = false;
      this.checkAllFinished();
    }
  }

  pausePolling() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  resumePolling() {
    if (this.queue.some((i) => i.status === 'processing')) {
      this.isPolling = true;
      this.pollVideos();
    }
  }

  checkAllFinished() {
    const hasUnfinished = this.queue.some((i) => ['pending', 'uploading', 'processing'].includes(i.status));
    if (!hasUnfinished && this.queue.length > 0) {
      if (this.options.onAllFinished) {
        this.options.onAllFinished(this.queue);
      }
    }
  }

  emitChange() {
    if (this.options.onQueueChange) {
      this.options.onQueueChange(this.getStats());
    }
  }

  getStats() {
    const total = this.queue.length;
    const completed = this.queue.filter((i) => i.status === 'ready').length;
    const failed = this.queue.filter((i) => i.status === 'failed' || i.status === 'cancelled').length;
    const active = this.queue.filter((i) => ['uploading', 'processing'].includes(i.status)).length;
    const totalBytes = this.queue.reduce((acc, i) => acc + i.size, 0);
    const loadedBytes = this.queue.reduce((acc, i) => acc + i.loaded, 0);
    const overallPercent = totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : 0;

    return {
      queue: this.queue,
      total,
      completed,
      failed,
      active,
      totalBytes,
      loadedBytes,
      overallPercent
    };
  }
}

/**
 * Builds the Drop Zone UI component
 */
export function buildDropZone(uploader, container, options = {}) {
  container.innerHTML = '';
  container.className = 'dropzone-wrapper';

  const zone = document.createElement('div');
  zone.className = 'dropzone card card-paper';
  zone.style.display = 'flex';
  zone.style.flexDirection = 'column';
  zone.style.alignItems = 'center';
  zone.style.justifyContent = 'center';
  zone.style.padding = 'var(--space-2xl) var(--space-md)';
  zone.style.border = '2px dashed var(--color-sand-hover)';
  zone.style.borderRadius = 'var(--radius-xl)';
  zone.style.cursor = 'pointer';
  zone.style.textAlign = 'center';
  zone.style.transition = 'all var(--duration-fast) var(--ease-out)';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.accept = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm';
  fileInput.style.display = 'none';

  const uploadIcon = icon('upload', { size: 40 });
  uploadIcon.style.color = 'var(--color-terracotta)';
  uploadIcon.style.marginBottom = 'var(--space-md)';
  zone.appendChild(uploadIcon);

  const title = document.createElement('h3');
  title.style.fontSize = 'var(--text-lg)';
  title.style.marginBottom = 'var(--space-2xs)';
  title.textContent = 'Drag and drop your photos and videos';
  zone.appendChild(title);

  const subtitle = document.createElement('p');
  subtitle.className = 'text-muted';
  subtitle.style.fontSize = 'var(--text-sm)';
  subtitle.textContent = 'or click to browse from your device';
  zone.appendChild(subtitle);
  zone.appendChild(fileInput);

  zone.tabIndex = 0;
  zone.setAttribute('role', 'button');
  zone.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  };

  zone.onclick = () => fileInput.click();

  fileInput.onchange = (e) => {
    if (e.target.files?.length > 0) {
      uploader.addFiles(e.target.files);
      fileInput.value = '';
    }
  };

  zone.ondragover = (e) => {
    e.preventDefault();
    zone.style.borderColor = 'var(--color-teal)';
    zone.style.backgroundColor = 'var(--color-sand)';
  };

  zone.ondragleave = () => {
    zone.style.borderColor = 'var(--color-sand-hover)';
    zone.style.backgroundColor = 'var(--color-paper-light)';
  };

  zone.ondrop = (e) => {
    e.preventDefault();
    zone.style.borderColor = 'var(--color-sand-hover)';
    zone.style.backgroundColor = 'var(--color-paper-light)';
    if (e.dataTransfer.files?.length > 0) {
      uploader.addFiles(e.dataTransfer.files);
    }
  };

  container.appendChild(zone);

  // Queue List Container
  const listContainer = document.createElement('div');
  listContainer.className = 'upload-queue-list';
  listContainer.style.marginTop = 'var(--space-lg)';
  container.appendChild(listContainer);

  const renderQueueList = () => {
    listContainer.innerHTML = '';
    const stats = uploader.getStats();
    if (stats.total === 0) return;

    stats.queue.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'upload-row card';
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = 'var(--space-md)';
      row.style.padding = 'var(--space-sm) var(--space-md)';
      row.style.marginBottom = 'var(--space-xs)';

      const thumb = document.createElement('div');
      thumb.style.width = '44px';
      thumb.style.height = '44px';
      thumb.style.borderRadius = 'var(--radius-sm)';
      thumb.style.overflow = 'hidden';
      thumb.style.backgroundColor = 'var(--color-sand)';
      thumb.style.flexShrink = '0';

      if (item.previewUrl) {
        const img = document.createElement('img');
        img.src = item.previewUrl;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        thumb.appendChild(img);
      } else {
        const ic = icon(item.isVideo ? 'video' : 'image', { size: 24 });
        ic.style.margin = '10px';
        thumb.appendChild(ic);
      }
      row.appendChild(thumb);

      const info = document.createElement('div');
      info.style.flex = '1';

      const nameRow = document.createElement('div');
      nameRow.style.display = 'flex';
      nameRow.style.justifyContent = 'space-between';
      nameRow.style.fontSize = 'var(--text-sm)';
      nameRow.style.fontWeight = '600';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = item.name;
      nameSpan.style.overflow = 'hidden';
      nameSpan.style.textOverflow = 'ellipsis';
      nameSpan.style.whiteSpace = 'nowrap';
      nameSpan.style.maxWidth = '240px';

      const sizeSpan = document.createElement('span');
      sizeSpan.className = 'text-muted';
      sizeSpan.textContent = formatBytes(item.size);

      nameRow.appendChild(nameSpan);
      nameRow.appendChild(sizeSpan);
      info.appendChild(nameRow);

      // Progress bar or status text
      if (item.status === 'uploading') {
        const bar = document.createElement('div');
        bar.className = 'progress-bar';
        bar.style.marginTop = '6px';
        const fill = document.createElement('div');
        fill.className = 'progress-fill';
        fill.style.width = `${item.percent}%`;
        bar.appendChild(fill);
        info.appendChild(bar);
      } else if (item.status === 'processing') {
        const st = document.createElement('div');
        st.className = 'badge badge-mustard';
        st.style.marginTop = '4px';
        st.textContent = 'Transcoding video...';
        info.appendChild(st);
      } else if (item.status === 'ready') {
        const st = document.createElement('div');
        st.className = 'badge badge-teal';
        st.style.marginTop = '4px';
        st.textContent = 'Ready';
        info.appendChild(st);
      } else if (item.status === 'failed') {
        const st = document.createElement('div');
        st.className = 'field-error';
        st.textContent = item.error || 'Failed';
        info.appendChild(st);
      }
      row.appendChild(info);

      // Action buttons (Cancel / Retry)
      const actionCol = document.createElement('div');
      if (item.status === 'failed') {
        const retryBtn = document.createElement('button');
        retryBtn.className = 'btn-icon';
        retryBtn.setAttribute('aria-label', 'Retry upload');
        retryBtn.appendChild(icon('upload', { size: 16 }));
        retryBtn.onclick = () => uploader.retryItem(item.id);
        actionCol.appendChild(retryBtn);
      } else if (item.status === 'uploading' || item.status === 'pending') {
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-icon';
        cancelBtn.setAttribute('aria-label', 'Cancel upload');
        cancelBtn.appendChild(icon('close', { size: 16 }));
        cancelBtn.onclick = () => uploader.cancelItem(item.id);
        actionCol.appendChild(cancelBtn);
      }
      row.appendChild(actionCol);

      listContainer.appendChild(row);
    });
  };

  uploader.options.onQueueChange = () => renderQueueList();
  return { zone, listContainer };
}

/**
 * Storage Bar Component
 */
export async function mountStorageBar(container) {
  try {
    const data = await getMyStorage();
    container.innerHTML = '';
    container.className = 'storage-bar-card';

    const header = document.createElement('div');
    header.className = 'storage-bar-header';

    const title = document.createElement('span');
    title.textContent = 'Storage Usage';

    const stat = document.createElement('span');
    stat.className = 'text-muted';
    stat.textContent = `${formatBytes(data.usedBytes)} of ${formatBytes(data.quotaBytes)} (${data.percent}%)`;

    header.appendChild(title);
    header.appendChild(stat);
    container.appendChild(header);

    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    fill.style.width = `${Math.min(100, data.percent)}%`;
    if (data.percent > 90) {
      fill.style.backgroundColor = 'var(--color-brick)';
    }
    bar.appendChild(fill);
    container.appendChild(bar);

    const legend = document.createElement('div');
    legend.className = 'storage-bar-legend';
    legend.textContent = `${data.counts?.images || 0} photos · ${data.counts?.videos || 0} videos`;
    container.appendChild(legend);
  } catch {
    // If not logged in, silently leave container empty
  }
}

