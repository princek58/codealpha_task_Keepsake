// Keepsake UI Component Controller & Element Builders
import { icon, sticker } from './icons.js';
import { getMediaUrl } from './media-url.js';

// 1. Toast Controller
let toastContainer = null;
function getToastContainer() {
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.setAttribute('role', 'region');
    toastContainer.setAttribute('aria-label', 'Notifications');
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(message, type = 'info', duration = 3500) {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');

  const textSpan = document.createElement('span');
  textSpan.textContent = message; // Safe text
  toast.appendChild(textSpan);

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 200ms ease';
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

// 2. Focus Trap Helper
export function setupFocusTrap(container, onEscape) {
  const focusable = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  const handleKeydown = (e) => {
    if (e.key === 'Escape' && onEscape) {
      e.preventDefault();
      onEscape();
      return;
    }
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === first) {
        last?.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === last) {
        first?.focus();
        e.preventDefault();
      }
    }
  };

  container.addEventListener('keydown', handleKeydown);
  first?.focus();

  return () => {
    container.removeEventListener('keydown', handleKeydown);
  };
}

// 3. Modal Controller
let previousFocusedElement = null;

export function openModal(modalBackdrop, { onClose } = {}) {
  if (!modalBackdrop) return;
  previousFocusedElement = document.activeElement;
  modalBackdrop.classList.add('open');
  modalBackdrop.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  const modal = modalBackdrop.querySelector('.modal') || modalBackdrop;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  const removeTrap = setupFocusTrap(modal, () => {
    closeModal(modalBackdrop);
    if (onClose) onClose();
  });

  modalBackdrop._cleanupTrap = removeTrap;
  modalBackdrop._onClose = onClose;

  const closeBtn = modalBackdrop.querySelector('[data-close-modal]');
  if (closeBtn) {
    closeBtn.onclick = () => {
      closeModal(modalBackdrop);
      if (onClose) onClose();
    };
  }
}

export function closeModal(modalBackdrop) {
  if (!modalBackdrop) return;
  modalBackdrop.classList.remove('open');
  modalBackdrop.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';

  if (modalBackdrop._cleanupTrap) {
    modalBackdrop._cleanupTrap();
    delete modalBackdrop._cleanupTrap;
  }

  if (previousFocusedElement && typeof previousFocusedElement.focus === 'function') {
    previousFocusedElement.focus();
    previousFocusedElement = null;
  }
}

// 4. Slide-up Sheet Controller
export function openSheet(sheetBackdrop, { onClose } = {}) {
  if (!sheetBackdrop) return;
  previousFocusedElement = document.activeElement;
  sheetBackdrop.classList.add('open');
  sheetBackdrop.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  const sheet = sheetBackdrop.querySelector('.sheet') || sheetBackdrop;
  const removeTrap = setupFocusTrap(sheet, () => {
    closeSheet(sheetBackdrop);
    if (onClose) onClose();
  });

  sheetBackdrop._cleanupTrap = removeTrap;
}

export function closeSheet(sheetBackdrop) {
  if (!sheetBackdrop) return;
  sheetBackdrop.classList.remove('open');
  sheetBackdrop.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';

  if (sheetBackdrop._cleanupTrap) {
    sheetBackdrop._cleanupTrap();
    delete sheetBackdrop._cleanupTrap;
  }

  if (previousFocusedElement) {
    previousFocusedElement.focus();
    previousFocusedElement = null;
  }
}

// 5. Confirm Dialog
export function confirmDialog({
  title = 'Are you sure?',
  message = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false
} = {}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'modal confirm-dialog';

    const header = document.createElement('div');
    header.className = 'modal-header';
    const h3 = document.createElement('h3');
    h3.textContent = title;
    header.appendChild(h3);

    const body = document.createElement('div');
    body.className = 'modal-body';
    const p = document.createElement('p');
    p.textContent = message;
    body.appendChild(p);

    const footer = document.createElement('div');
    footer.className = 'modal-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-sand';
    cancelBtn.textContent = cancelText;

    const confirmBtn = document.createElement('button');
    confirmBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
    confirmBtn.textContent = confirmText;

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const cleanup = (result) => {
      closeModal(backdrop);
      setTimeout(() => backdrop.remove(), 250);
      resolve(result);
    };

    cancelBtn.onclick = () => cleanup(false);
    confirmBtn.onclick = () => cleanup(true);
    backdrop.onclick = (e) => {
      if (e.target === backdrop) cleanup(false);
    };

    openModal(backdrop, { onClose: () => cleanup(false) });
  });
}

// 6. Formatters
export function formatTimeAgo(dateInput) {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

export function formatDate(dateInput, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

export function formatBytes(bytes) {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem < 10 ? '0' : ''}${rem}`;
}

// 7. Safe Element Builders
export function createAvatar(user = {}, size = 'md') {
  const container = document.createElement('div');
  container.className = `avatar avatar-${size}`;

  if (user && user.avatarUrl) {
    const img = document.createElement('img');
    img.src = user.avatarUrl;
    img.alt = user.displayName || user.username || 'Avatar';
    img.loading = 'lazy';
    container.appendChild(img);
  } else {
    const initial = (user?.displayName || user?.username || '?').charAt(0).toUpperCase();
    const span = document.createElement('span');
    span.textContent = initial;
    container.appendChild(span);
  }

  return container;
}

export function buildMediaTile(media, options = {}) {
  const tile = document.createElement('div');
  tile.className = 'media-tile';
  tile.setAttribute('tabindex', '0');
  tile.setAttribute('role', 'button');

  const id = media.id || media._id;
  tile.dataset.id = id;

  if (media.blurDataUrl) {
    tile.style.backgroundImage = `url("${media.blurDataUrl}")`;
    tile.style.backgroundSize = 'cover';
  }

  const thumbUrl = getMediaUrl(media, 'thumb', options.token);
  const img = document.createElement('img');
  img.alt = media.caption || 'Media';
  img.loading = options.lazy !== false ? 'lazy' : 'eager';
  img.style.opacity = '0';
  img.style.transition = 'opacity 300ms ease';

  const markLoaded = () => {
    img.style.opacity = '1';
    tile.classList.add('media-loaded');
  };

  img.onload = markLoaded;
  img.onerror = () => {
    tile.classList.add('media-error');
    tile.style.backgroundImage = 'none';
  };

  img.src = thumbUrl;
  if (img.complete && img.naturalWidth > 0) {
    markLoaded();
  }

  tile.appendChild(img);

  if (media.type === 'video') {
    const badge = document.createElement('div');
    badge.className = 'media-badge';
    badge.appendChild(icon('play', { size: 12 }));
    if (media.durationSec) {
      const dur = document.createElement('span');
      dur.textContent = formatDuration(media.durationSec);
      badge.appendChild(dur);
    }
    tile.appendChild(badge);
  }

  if (media.status === 'processing') {
    const overlay = document.createElement('div');
    overlay.className = 'media-overlay';
    overlay.textContent = 'Processing...';
    tile.appendChild(overlay);
  } else if (media.status === 'failed') {
    const overlay = document.createElement('div');
    overlay.className = 'media-overlay';
    overlay.textContent = 'Failed';
    tile.appendChild(overlay);
  }

  if (options.selectable) {
    const check = document.createElement('div');
    check.className = 'media-check';
    check.appendChild(icon('check', { size: 14 }));
    tile.appendChild(check);

    if (options.selected) {
      tile.classList.add('selected');
    }
  }

  return tile;
}

export function buildMomentCard(moment, options = {}) {
  const card = document.createElement('article');
  card.className = 'moment-card';
  card.dataset.id = moment.id || moment._id;

  // Header
  const header = document.createElement('div');
  header.className = 'moment-header';

  const authorLink = document.createElement('a');
  authorLink.className = 'moment-author';
  authorLink.href = `/profile.html?user=${encodeURIComponent(moment.author?.username || '')}`;
  authorLink.appendChild(createAvatar(moment.author, 'sm'));

  const authorName = document.createElement('strong');
  authorName.textContent = moment.author?.displayName || moment.author?.username || 'Anonymous';
  authorLink.appendChild(authorName);
  header.appendChild(authorLink);

  const timeSpan = document.createElement('span');
  timeSpan.className = 'text-muted';
  timeSpan.style.fontSize = 'var(--text-xs)';
  timeSpan.textContent = formatTimeAgo(moment.createdAt);
  header.appendChild(timeSpan);

  card.appendChild(header);

  // Content Container for Renderers
  const content = document.createElement('div');
  content.className = 'moment-content';
  card.appendChild(content);

  // Meta Section
  const meta = document.createElement('div');
  meta.className = 'moment-meta';

  if (moment.title) {
    const h3 = document.createElement('h3');
    h3.className = 'moment-title';
    h3.textContent = moment.title;
    meta.appendChild(h3);
  }

  if (moment.caption) {
    const p = document.createElement('p');
    p.className = 'moment-caption readable';
    p.textContent = moment.caption;
    meta.appendChild(p);
  }

  if (moment.place) {
    const placeDiv = document.createElement('div');
    placeDiv.className = 'text-muted';
    placeDiv.style.fontSize = 'var(--text-xs)';
    placeDiv.style.display = 'flex';
    placeDiv.style.alignItems = 'center';
    placeDiv.style.gap = '4px';
    placeDiv.appendChild(icon('map-pin', { size: 14 }));
    const placeSpan = document.createElement('span');
    placeSpan.textContent = moment.place;
    placeDiv.appendChild(placeSpan);
    meta.appendChild(placeDiv);
  }

  card.appendChild(meta);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'moment-actions';

  const likeBtn = document.createElement('button');
  likeBtn.className = 'btn-icon';
  likeBtn.setAttribute('aria-label', moment.likedByMe ? 'Unlike moment' : 'Like moment');
  likeBtn.appendChild(icon(moment.likedByMe ? 'heart-filled' : 'heart', { size: 20 }));
  actions.appendChild(likeBtn);

  const commentBtn = document.createElement('button');
  commentBtn.className = 'btn-icon';
  commentBtn.setAttribute('aria-label', 'Comments');
  commentBtn.appendChild(icon('comment', { size: 20 }));
  actions.appendChild(commentBtn);

  card.appendChild(actions);

  return card;
}

export function buildAlbumCard(album, options = {}) {
  const card = document.createElement('div');
  card.className = 'album-card';
  card.dataset.id = album.id || album._id;

  const cover = document.createElement('div');
  cover.className = 'album-cover';
  if (album.cover) {
    const img = document.createElement('img');
    img.src = getMediaUrl(album.cover, 'display', options.token);
    img.alt = album.title;
    img.loading = 'lazy';
    cover.appendChild(img);
  }
  card.appendChild(cover);

  const info = document.createElement('div');
  info.className = 'album-info';

  const title = document.createElement('h4');
  title.className = 'album-title';
  title.textContent = album.title;
  info.appendChild(title);

  const count = document.createElement('span');
  count.className = 'album-count';
  count.textContent = `${album.mediaCount || 0} moments`;
  info.appendChild(count);

  card.appendChild(info);
  return card;
}

export function buildUserRow(user, options = {}) {
  const row = document.createElement('div');
  row.className = 'user-row';

  const infoLink = document.createElement('a');
  infoLink.className = 'user-info';
  infoLink.href = `/profile.html?user=${encodeURIComponent(user.username)}`;
  infoLink.appendChild(createAvatar(user, 'md'));

  const details = document.createElement('div');
  const name = document.createElement('div');
  name.style.fontWeight = '600';
  name.textContent = user.displayName || user.username;
  details.appendChild(name);

  const handle = document.createElement('div');
  handle.className = 'text-muted';
  handle.style.fontSize = 'var(--text-xs)';
  handle.textContent = `@${user.username}`;
  details.appendChild(handle);

  infoLink.appendChild(details);
  row.appendChild(infoLink);

  if (!user.isMe && options.showFollowButton) {
    const followBtn = document.createElement('button');
    followBtn.className = user.isFollowing ? 'btn btn-sand btn-sm' : 'btn btn-primary btn-sm';
    followBtn.textContent = user.isFollowing ? 'Following' : 'Follow';
    if (options.onFollowToggle) {
      followBtn.onclick = () => options.onFollowToggle(user, followBtn);
    }
    row.appendChild(followBtn);
  }

  return row;
}

export function buildCommentItem(comment) {
  const item = document.createElement('div');
  item.className = 'comment-item';

  item.appendChild(createAvatar(comment.author, 'sm'));

  const body = document.createElement('div');
  body.className = 'comment-body';

  const author = document.createElement('div');
  author.className = 'comment-author';
  author.textContent = comment.author?.displayName || comment.author?.username || 'Anonymous';
  body.appendChild(author);

  const text = document.createElement('div');
  text.className = 'comment-text';
  text.textContent = comment.text; // Text only, never innerHTML
  body.appendChild(text);

  item.appendChild(body);
  return item;
}

export function buildNotificationItem(notification) {
  const item = document.createElement('div');
  item.className = `notification-item ${notification.read ? '' : 'unread'}`;

  item.appendChild(createAvatar(notification.from, 'sm'));

  const textDiv = document.createElement('div');
  textDiv.style.flex = '1';
  textDiv.style.fontSize = 'var(--text-sm)';

  const strong = document.createElement('strong');
  strong.textContent = notification.from?.displayName || notification.from?.username || 'Someone';
  textDiv.appendChild(strong);

  const actionSpan = document.createElement('span');
  if (notification.type === 'like') {
    actionSpan.textContent = ' liked your moment ';
  } else if (notification.type === 'comment') {
    actionSpan.textContent = ' commented on ';
  } else if (notification.type === 'follow') {
    actionSpan.textContent = ' started following you.';
  }
  textDiv.appendChild(actionSpan);

  if (notification.momentPreview) {
    const preview = document.createElement('em');
    preview.textContent = `"${notification.momentPreview}"`;
    textDiv.appendChild(preview);
  }

  item.appendChild(textDiv);
  return item;
}

export function buildEmptyState({ iconName = 'bookmark', title = 'Nothing here yet', description = '', actionButton = null } = {}) {
  const empty = document.createElement('div');
  empty.className = 'empty-state';

  const stickerIcon = sticker(iconName, { size: 72, className: 'empty-state-icon' });
  empty.appendChild(stickerIcon);

  const h3 = document.createElement('h3');
  h3.className = 'empty-state-title';
  h3.textContent = title;
  empty.appendChild(h3);

  if (description) {
    const p = document.createElement('p');
    p.className = 'empty-state-desc';
    p.textContent = description;
    empty.appendChild(p);
  }

  if (actionButton) {
    empty.appendChild(actionButton);
  }

  return empty;
}

export function buildSkeletonTile() {
  const tile = document.createElement('div');
  tile.className = 'skeleton skeleton-tile';
  return tile;
}

export function buildSkeletonCard() {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.marginBottom = 'var(--space-md)';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.gap = 'var(--space-sm)';
  header.style.alignItems = 'center';
  header.style.marginBottom = 'var(--space-md)';

  const avatar = document.createElement('div');
  avatar.className = 'skeleton skeleton-avatar';
  avatar.style.width = '36px';
  avatar.style.height = '36px';
  header.appendChild(avatar);

  const name = document.createElement('div');
  name.className = 'skeleton skeleton-text';
  name.style.width = '120px';
  name.style.height = '14px';
  header.appendChild(name);
  card.appendChild(header);

  const body = document.createElement('div');
  body.className = 'skeleton skeleton-tile';
  card.appendChild(body);

  return card;
}

// 8. Utilities
export function debounce(fn, delay = 250) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

export function createAbortHelper() {
  let controller = null;
  return {
    getSignal: () => {
      if (controller) controller.abort();
      controller = new AbortController();
      return controller.signal;
    },
    abort: () => {
      if (controller) {
        controller.abort();
        controller = null;
      }
    }
  };
}

export const buildAvatar = createAvatar;
export const showConfirmDialog = confirmDialog;


