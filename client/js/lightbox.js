// Keepsake Full-Screen Lightbox Module
import { icon } from './icons.js';
import { getMediaUrl } from './media-url.js';
import { isReducedMotion } from './animations.js';
import { formatDate } from './ui.js';

let activeLightbox = null;

export function openLightbox({
  items = [],
  startIndex = 0,
  getUrl = getMediaUrl,
  isOwner = false,
  token = null,
  originRect = null,
  onClose = null
} = {}) {
  if (activeLightbox) {
    activeLightbox.close();
  }

  if (!items || items.length === 0) return;

  const lb = new LightboxInstance({
    items,
    startIndex,
    getUrl,
    isOwner,
    token,
    originRect,
    onClose
  });

  activeLightbox = lb;
  return lb;
}

class LightboxInstance {
  constructor(config) {
    this.items = config.items;
    this.index = Math.max(0, Math.min(config.startIndex, this.items.length - 1));
    this.getUrl = config.getUrl;
    this.isOwner = config.isOwner;
    this.token = config.token;
    this.originRect = config.originRect;
    this.onClose = config.onClose;

    this.zoomLevel = 1;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchDeltaX = 0;
    this.touchDeltaY = 0;

    this.slideshowTimer = null;
    this.isSlideshowActive = false;

    this.previousFocus = document.activeElement;
    this.prevOverflow = document.body.style.overflow;

    this.build();
    this.bindEvents();
    this.render();
  }

  build() {
    this.el = document.createElement('div');
    this.el.className = 'lightbox-root';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-label', 'Media Viewer');

    // Controls Header
    this.header = document.createElement('div');
    this.header.className = 'lightbox-header';

    this.counter = document.createElement('span');
    this.counter.className = 'lightbox-counter';
    this.counter.setAttribute('aria-live', 'polite');

    const actions = document.createElement('div');
    actions.className = 'lightbox-actions';

    this.slideshowBtn = document.createElement('button');
    this.slideshowBtn.className = 'btn-icon lightbox-btn';
    this.slideshowBtn.setAttribute('aria-label', 'Play Slideshow');
    this.slideshowBtn.appendChild(icon('play', { size: 20 }));
    this.slideshowBtn.onclick = () => this.toggleSlideshow();
    actions.appendChild(this.slideshowBtn);

    this.downloadBtn = document.createElement('a');
    this.downloadBtn.className = 'btn-icon lightbox-btn';
    this.downloadBtn.setAttribute('aria-label', 'Download Original');
    this.downloadBtn.setAttribute('download', '');
    this.downloadBtn.appendChild(icon('download', { size: 20 }));
    actions.appendChild(this.downloadBtn);

    this.closeBtn = document.createElement('button');
    this.closeBtn.className = 'btn-icon lightbox-btn';
    this.closeBtn.setAttribute('aria-label', 'Close');
    this.closeBtn.appendChild(icon('close', { size: 22 }));
    this.closeBtn.onclick = () => this.close();
    actions.appendChild(this.closeBtn);

    this.header.appendChild(this.counter);
    this.header.appendChild(actions);
    this.el.appendChild(this.header);

    // Media Stage
    this.stage = document.createElement('div');
    this.stage.className = 'lightbox-stage';

    this.prevBtn = document.createElement('button');
    this.prevBtn.className = 'btn-icon lightbox-nav lightbox-prev';
    this.prevBtn.setAttribute('aria-label', 'Previous');
    this.prevBtn.appendChild(icon('chevron-left', { size: 28 }));
    this.prevBtn.onclick = () => this.prev();

    this.nextBtn = document.createElement('button');
    this.nextBtn.className = 'btn-icon lightbox-nav lightbox-next';
    this.nextBtn.setAttribute('aria-label', 'Next');
    this.nextBtn.appendChild(icon('chevron-right', { size: 28 }));
    this.nextBtn.onclick = () => this.next();

    this.contentContainer = document.createElement('div');
    this.contentContainer.className = 'lightbox-content';

    this.stage.appendChild(this.prevBtn);
    this.stage.appendChild(this.contentContainer);
    this.stage.appendChild(this.nextBtn);
    this.el.appendChild(this.stage);

    // Metadata Footer
    this.footer = document.createElement('div');
    this.footer.className = 'lightbox-footer';

    this.captionEl = document.createElement('div');
    this.captionEl.className = 'lightbox-caption';
    this.metaEl = document.createElement('div');
    this.metaEl.className = 'lightbox-meta';

    this.footer.appendChild(this.captionEl);
    this.footer.appendChild(this.metaEl);
    this.el.appendChild(this.footer);

    document.body.appendChild(this.el);
    document.body.style.overflow = 'hidden';

    // Shared-element open animation
    if (!isReducedMotion() && this.originRect) {
      this.animateOpenFromRect(this.originRect);
    } else {
      this.el.style.opacity = '0';
      requestAnimationFrame(() => {
        this.el.style.transition = 'opacity 250ms ease';
        this.el.style.opacity = '1';
      });
    }

    this.closeBtn.focus();
  }

  animateOpenFromRect(rect) {
    this.el.style.opacity = '1';
    const targetW = rect.width;
    const targetH = rect.height;
    const targetX = rect.left;
    const targetY = rect.top;

    this.contentContainer.style.transformOrigin = `${targetX}px ${targetY}px`;
    this.contentContainer.style.transform = 'scale(0.85)';
    this.contentContainer.style.opacity = '0';

    requestAnimationFrame(() => {
      this.contentContainer.style.transition = 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 250ms ease';
      this.contentContainer.style.transform = 'none';
      this.contentContainer.style.opacity = '1';
    });
  }

  render() {
    const item = this.items[this.index];
    if (!item) return;

    this.resetZoom();
    this.counter.textContent = `${this.index + 1} / ${this.items.length}`;

    // Download button visibility (owner original)
    if (this.isOwner || (item.urls && item.urls.original)) {
      this.downloadBtn.style.display = 'inline-flex';
      this.downloadBtn.href = this.getUrl(item, 'original', this.token);
    } else {
      this.downloadBtn.style.display = 'none';
    }

    // Prev / Next button visibility
    this.prevBtn.style.visibility = this.index > 0 ? 'visible' : 'hidden';
    this.nextBtn.style.visibility = this.index < this.items.length - 1 ? 'visible' : 'hidden';

    // Content rendering
    this.contentContainer.innerHTML = '';

    if (item.type === 'video') {
      const video = document.createElement('video');
      video.className = 'lightbox-media';
      video.controls = true;
      video.autoplay = false;
      video.preload = 'metadata';
      video.src = this.getUrl(item, 'video', this.token);
      if (item.urls?.poster || item.paths?.poster) {
        video.poster = this.getUrl(item, 'poster', this.token);
      }
      this.contentContainer.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.className = 'lightbox-media';
      img.alt = item.caption || 'Image preview';
      img.src = this.getUrl(item, 'display', this.token);

      if (this.isSlideshowActive && !isReducedMotion()) {
        img.classList.add('ken-burns');
      }

      this.contentContainer.appendChild(img);
    }

    // Metadata
    this.captionEl.textContent = item.caption || '';
    const metaParts = [];
    if (item.takenAt) metaParts.push(formatDate(item.takenAt));
    if (item.place) metaParts.push(item.place);
    this.metaEl.textContent = metaParts.join(' · ');

    this.preloadAdjacent();
  }

  preloadAdjacent() {
    if (this.index < this.items.length - 1) {
      const nextItem = this.items[this.index + 1];
      if (nextItem.type !== 'video') {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = this.getUrl(nextItem, 'display', this.token);
        document.head.appendChild(link);
      }
    }
    if (this.index > 0) {
      const prevItem = this.items[this.index - 1];
      if (prevItem.type !== 'video') {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = this.getUrl(prevItem, 'display', this.token);
        document.head.appendChild(link);
      }
    }
  }

  next() {
    if (this.index < this.items.length - 1) {
      this.index++;
      this.render();
    } else if (this.isSlideshowActive) {
      // Loop slideshow
      this.index = 0;
      this.render();
    }
  }

  prev() {
    if (this.index > 0) {
      this.index--;
      this.render();
    }
  }

  resetZoom() {
    this.zoomLevel = 1;
    this.panX = 0;
    this.panY = 0;
    this.updateTransform();
  }

  setZoom(level, clientX = window.innerWidth / 2, clientY = window.innerHeight / 2) {
    const clamped = Math.max(1, Math.min(level, 4));
    this.zoomLevel = clamped;
    if (this.zoomLevel === 1) {
      this.panX = 0;
      this.panY = 0;
    }
    this.updateTransform();
  }

  updateTransform() {
    const media = this.contentContainer.querySelector('.lightbox-media');
    if (!media) return;

    if (this.zoomLevel > 1) {
      media.style.transform = `translate3d(${this.panX}px, ${this.panY}px, 0) scale(${this.zoomLevel})`;
      media.style.cursor = 'grab';
    } else {
      media.style.transform = '';
      media.style.cursor = '';
    }
  }

  toggleSlideshow() {
    if (this.isSlideshowActive) {
      this.stopSlideshow();
    } else {
      this.startSlideshow();
    }
  }

  startSlideshow() {
    this.isSlideshowActive = true;
    this.slideshowBtn.innerHTML = '';
    this.slideshowBtn.appendChild(icon('pause', { size: 20 }));
    this.slideshowBtn.setAttribute('aria-label', 'Pause Slideshow');

    this.slideshowTimer = setInterval(() => {
      this.next();
    }, 4000);
  }

  stopSlideshow() {
    this.isSlideshowActive = false;
    if (this.slideshowTimer) {
      clearInterval(this.slideshowTimer);
      this.slideshowTimer = null;
    }
    this.slideshowBtn.innerHTML = '';
    this.slideshowBtn.appendChild(icon('play', { size: 20 }));
    this.slideshowBtn.setAttribute('aria-label', 'Play Slideshow');

    const media = this.contentContainer.querySelector('.lightbox-media');
    if (media) media.classList.remove('ken-burns');
  }

  bindEvents() {
    this.handleKeyDown = (e) => {
      this.stopSlideshow();

      if (e.key === 'Escape') {
        this.close();
      } else if (e.key === 'Tab') {
        const focusable = Array.from(this.el.querySelectorAll('button:not([disabled]), [tabindex]:not([tabindex="-1"]), video[controls]'));
        if (focusable.length > 0) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && (document.activeElement === first || !this.el.contains(document.activeElement))) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      } else if (e.key === 'ArrowRight') {
        this.next();
      } else if (e.key === 'ArrowLeft') {
        this.prev();
      } else if (e.key === '+' || e.key === '=') {
        this.setZoom(this.zoomLevel + 0.5);
      } else if (e.key === '-') {
        this.setZoom(this.zoomLevel - 0.5);
      } else if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          this.el.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      } else if (e.key === ' ') {
        const video = this.contentContainer.querySelector('video');
        if (video) {
          e.preventDefault();
          if (video.paused) video.play();
          else video.pause();
        }
      }
    };
    window.addEventListener('keydown', this.handleKeyDown);

    // Mouse wheel zoom
    this.handleWheel = (e) => {
      const media = this.contentContainer.querySelector('.lightbox-media');
      if (!media || media.tagName === 'VIDEO') return;

      e.preventDefault();
      this.stopSlideshow();
      const delta = e.deltaY < 0 ? 0.25 : -0.25;
      this.setZoom(this.zoomLevel + delta, e.clientX, e.clientY);
    };
    this.stage.addEventListener('wheel', this.handleWheel, { passive: false });

    // Mouse drag pan
    this.stage.addEventListener('mousedown', (e) => {
      if (this.zoomLevel > 1) {
        this.isDragging = true;
        this.dragStartX = e.clientX - this.panX;
        this.dragStartY = e.clientY - this.panY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.panX = e.clientX - this.dragStartX;
        this.panY = e.clientY - this.dragStartY;
        this.updateTransform();
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Touch swipe left/right/down
    this.stage.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    this.stage.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 1) {
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const diffX = endX - this.touchStartX;
        const diffY = endY - this.touchStartY;

        if (Math.abs(diffX) > 60 && Math.abs(diffY) < 50) {
          if (diffX < 0) this.next();
          else this.prev();
        } else if (diffY > 100 && Math.abs(diffX) < 60) {
          // Swipe down to close
          this.close();
        }
      }
    }, { passive: true });

    // Double tap to zoom
    let lastTap = 0;
    this.contentContainer.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTap < 300) {
        e.preventDefault();
        this.setZoom(this.zoomLevel === 1 ? 2.5 : 1);
      }
      lastTap = now;
    });
  }

  close() {
    this.stopSlideshow();
    window.removeEventListener('keydown', this.handleKeyDown);
    this.stage.removeEventListener('wheel', this.handleWheel);

    document.body.style.overflow = this.prevOverflow;

    if (!isReducedMotion()) {
      this.el.style.transition = 'opacity 200ms ease';
      this.el.style.opacity = '0';
      setTimeout(() => {
        this.el.remove();
        if (this.onClose) this.onClose();
        if (this.previousFocus?.focus) this.previousFocus.focus();
        activeLightbox = null;
      }, 200);
    } else {
      this.el.remove();
      if (this.onClose) this.onClose();
      if (this.previousFocus?.focus) this.previousFocus.focus();
      activeLightbox = null;
    }
  }
}

