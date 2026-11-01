// Bloomly UI helper library

import { getStickerSvg } from './stickers.js';

export function formatTimeAgo(dateInput) {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 45) return 'just now';
  if (diffInSeconds < 3600) {
    const mins = Math.floor(diffInSeconds / 60);
    return `${mins}m ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  }
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d ago`;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}

export function toast(message, type = 'info', duration = 3200) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }

  const toastEl = document.createElement('div');
  toastEl.className = 'toast';
  if (type === 'error') toastEl.classList.add('toast--error');

  const iconSpan = document.createElement('span');
  iconSpan.style.width = '24px';
  iconSpan.style.height = '24px';
  iconSpan.style.flexShrink = '0';
  iconSpan.style.display = 'inline-flex';

  if (type === 'error') {
    iconSpan.innerHTML = getStickerSvg('sparkle', { size: 22 });
  } else if (type === 'success') {
    iconSpan.innerHTML = getStickerSvg('heart', { size: 22 });
  } else {
    iconSpan.innerHTML = getStickerSvg('flower', { size: 22 });
  }

  const textSpan = document.createElement('span');
  textSpan.style.flex = '1';
  textSpan.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn-ghost';
  closeBtn.style.padding = '2px 8px';
  closeBtn.style.minHeight = 'auto';
  closeBtn.style.fontSize = 'var(--text-lg)';
  closeBtn.style.lineHeight = '1';
  closeBtn.setAttribute('aria-label', 'Close toast');
  closeBtn.textContent = '×';

  const removeToast = () => {
    toastEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    toastEl.style.opacity = '0';
    toastEl.style.transform = 'translateY(-10px) scale(0.95)';
    setTimeout(() => {
      if (toastEl.parentNode) {
        toastEl.parentNode.removeChild(toastEl);
      }
    }, 200);
  };

  closeBtn.addEventListener('click', removeToast);

  toastEl.appendChild(iconSpan);
  toastEl.appendChild(textSpan);
  toastEl.appendChild(closeBtn);
  container.appendChild(toastEl);

  if (duration > 0) {
    setTimeout(removeToast, duration);
  }

  return toastEl;
}

export function createAvatar({ avatar, displayName = '', moodSticker = '', size = 'md' }) {
  const wrapper = document.createElement('div');
  wrapper.className = `avatar-wrapper avatar-wrapper--${size}`;
  wrapper.style.position = 'relative';
  wrapper.style.display = 'inline-flex';

  const avatarEl = document.createElement('div');
  avatarEl.className = `avatar avatar-${size}`;

  const initial = (displayName && displayName.trim().charAt(0).toUpperCase()) || '?';

  if (avatar) {
    const img = document.createElement('img');
    img.src = avatar;
    img.alt = displayName || 'User avatar';
    img.loading = 'lazy';
    img.onerror = () => {
      img.remove();
      avatarEl.textContent = initial;
    };
    avatarEl.appendChild(img);
  } else {
    avatarEl.textContent = initial;
  }

  wrapper.appendChild(avatarEl);

  if (moodSticker) {
    const badge = document.createElement('div');
    badge.className = 'avatar-sticker-badge';
    badge.style.position = 'absolute';
    badge.style.bottom = '-4px';
    badge.style.right = '-4px';
    badge.style.width = size === 'xl' ? '28px' : size === 'lg' ? '22px' : '18px';
    badge.style.height = size === 'xl' ? '28px' : size === 'lg' ? '22px' : '18px';
    badge.style.filter = 'drop-shadow(0 1px 2px rgba(74, 44, 79, 0.15))';
    badge.innerHTML = getStickerSvg(moodSticker);
    wrapper.appendChild(badge);
  }

  return wrapper;
}

let activeModal = null;
let lastFocusedElement = null;

export function openModal({ title = '', content = null, onClose = null }) {
  closeModal();

  lastFocusedElement = document.activeElement;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop active';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');

  const card = document.createElement('div');
  card.className = 'modal-card';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'modal-close';
  closeBtn.setAttribute('aria-label', 'Close dialog');
  closeBtn.textContent = '×';

  if (title) {
    const heading = document.createElement('h3');
    heading.className = 'modal-title';
    heading.textContent = title;
    card.appendChild(heading);
  }

  card.appendChild(closeBtn);

  if (content instanceof HTMLElement) {
    card.appendChild(content);
  } else if (typeof content === 'string') {
    const p = document.createElement('p');
    p.textContent = content;
    card.appendChild(p);
  }

  backdrop.appendChild(card);
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';

  const handleClose = () => {
    backdrop.classList.remove('active');
    setTimeout(() => {
      if (backdrop.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }
      document.body.style.overflow = '';
      if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        lastFocusedElement.focus();
      }
      if (onClose) onClose();
      activeModal = null;
    }, 200);
  };

  closeBtn.addEventListener('click', handleClose);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) handleClose();
  });

  const keyHandler = (e) => {
    if (e.key === 'Escape') {
      handleClose();
      document.removeEventListener('keydown', keyHandler);
    }
  };
  document.addEventListener('keydown', keyHandler);

  activeModal = { backdrop, close: handleClose };
  closeBtn.focus();
  return activeModal;
}

export function closeModal() {
  if (activeModal) {
    activeModal.close();
  }
}

export function createSkeletonPost() {
  const card = document.createElement('div');
  card.className = 'post-card';
  card.innerHTML = `
    <div class="post-header">
      <div class="skeleton skeleton-avatar"></div>
      <div class="post-meta" style="flex:1;">
        <div class="skeleton skeleton-text skeleton-text--short"></div>
        <div class="skeleton skeleton-text" style="width: 25%;"></div>
      </div>
    </div>
    <div class="skeleton skeleton-text" style="width: 90%;"></div>
    <div class="skeleton skeleton-text" style="width: 75%;"></div>
    <div class="skeleton" style="height: 180px; border-radius: var(--radius-lg); margin-top: var(--space-2);"></div>
  `;
  return card;
}

export function createSkeletonUser() {
  const row = document.createElement('div');
  row.className = 'user-row';
  row.innerHTML = `
    <div class="skeleton skeleton-avatar"></div>
    <div class="user-row-info">
      <div class="skeleton skeleton-text skeleton-text--short"></div>
      <div class="skeleton skeleton-text" style="width: 30%;"></div>
    </div>
    <div class="skeleton" style="width: 70px; height: 32px; border-radius: var(--radius-full);"></div>
  `;
  return row;
}

export function buildEmptyState({
  title = 'Nothing here yet',
  subtitle = 'When little moments bloom, they will appear here.',
  stickerName = 'sprout',
  actionText = '',
  actionHref = '',
  onAction = null
}) {
  const box = document.createElement('div');
  box.className = 'empty-state';

  const sticker = document.createElement('div');
  sticker.className = 'empty-state-sticker';
  sticker.innerHTML = getStickerSvg(stickerName, { size: 72 });

  const h3 = document.createElement('h3');
  h3.className = 'empty-state-title';
  h3.textContent = title;

  const p = document.createElement('p');
  p.className = 'empty-state-desc';
  p.textContent = subtitle;

  box.appendChild(sticker);
  box.appendChild(h3);
  box.appendChild(p);

  if (actionText) {
    let btn;
    if (actionHref) {
      btn = document.createElement('a');
      btn.href = actionHref;
    } else {
      btn = document.createElement('button');
      btn.type = 'button';
    }
    btn.className = 'btn btn-primary';
    btn.textContent = actionText;
    if (onAction) {
      btn.addEventListener('click', onAction);
    }
    box.appendChild(btn);
  }

  return box;
}

export function openLightbox(src) {
  if (!src) return;
  const backdrop = document.createElement('div');
  backdrop.className = 'lightbox-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-label', 'Image preview');

  const img = document.createElement('img');
  img.src = src;
  img.className = 'lightbox-img';
  img.alt = 'Full size moment';

  backdrop.appendChild(img);
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';

  const close = () => {
    backdrop.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', keyHandler);
  };

  backdrop.addEventListener('click', close);
  const keyHandler = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', keyHandler);
}

export function buildPostCard(post, handlers = {}) {
  const card = document.createElement('article');
  card.className = 'post-card';
  card.setAttribute('data-id', post.id);

  // 1. Header
  const header = document.createElement('div');
  header.className = 'post-header';

  const author = post.author || {};
  const avatarWrapper = createAvatar({
    avatar: author.avatar,
    displayName: author.displayName || author.username,
    moodSticker: author.moodSticker,
    size: 'md'
  });

  const meta = document.createElement('div');
  meta.className = 'post-meta';

  const nameLink = document.createElement('a');
  nameLink.href = `/profile.html?u=${encodeURIComponent(author.username || '')}`;
  nameLink.className = 'post-author-name';
  nameLink.textContent = author.displayName || author.username || 'Bloom Friend';

  const handle = document.createElement('span');
  handle.className = 'post-author-handle';
  handle.textContent = `@${author.username || 'user'}`;

  meta.appendChild(nameLink);
  meta.appendChild(handle);

  const timeEl = document.createElement('time');
  timeEl.className = 'post-time';
  timeEl.dateTime = post.createdAt || '';
  timeEl.textContent = formatTimeAgo(post.createdAt);

  header.appendChild(avatarWrapper);
  header.appendChild(meta);
  header.appendChild(timeEl);

  // Author Delete action menu
  const currentUser = window.currentUser;
  const isAuthor = currentUser && (
    author.id === currentUser.id ||
    author.id === currentUser._id ||
    author.username === currentUser.username
  );

  if (isAuthor && handlers.onDelete) {
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-ghost btn-sm';
    deleteBtn.style.padding = '2px 8px';
    deleteBtn.style.color = 'var(--color-text-light)';
    deleteBtn.title = 'Delete bloom';
    deleteBtn.innerHTML = '•••';
    deleteBtn.addEventListener('click', () => {
      openModal({
        title: 'Prune this Bloom?',
        content: `
          <p style="color: var(--color-text-muted); margin-bottom: var(--space-4);">
            Are you sure you want to remove this moment from the garden? This action cannot be undone.
          </p>
          <div style="display: flex; justify-content: flex-end; gap: var(--space-2);">
            <button class="btn btn-secondary" id="confirm-cancel-btn">Cancel</button>
            <button class="btn btn-primary" id="confirm-delete-btn" style="background-color: var(--color-danger);">Prune Bloom</button>
          </div>
        `
      });

      const confirmBtn = document.getElementById('confirm-delete-btn');
      const cancelBtn = document.getElementById('confirm-cancel-btn');
      if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          closeModal();
          handlers.onDelete(post, card);
        });
      }
    });
    header.appendChild(deleteBtn);
  }

  card.appendChild(header);

  // 2. Text body
  if (post.text) {
    const textEl = document.createElement('p');
    textEl.className = 'post-text';
    textEl.textContent = post.text;
    card.appendChild(textEl);
  }

  // 3. Image with click-to-zoom
  if (post.image) {
    const imgContainer = document.createElement('div');
    imgContainer.className = 'post-image-container';
    imgContainer.style.cursor = 'zoom-in';

    const img = document.createElement('img');
    img.src = post.image;
    img.alt = 'Bloom moment';
    img.loading = 'lazy';
    img.addEventListener('click', () => openLightbox(post.image));

    imgContainer.appendChild(img);
    card.appendChild(imgContainer);
  }

  // 4. Actions
  const actions = document.createElement('div');
  actions.className = 'post-actions';

  // Like button
  const likeBtn = document.createElement('button');
  likeBtn.type = 'button';
  likeBtn.className = `action-btn ${post.likedByMe ? 'active' : ''}`;
  likeBtn.setAttribute('aria-label', post.likedByMe ? 'Unlike post' : 'Like post');

  const heartIcon = document.createElement('span');
  heartIcon.style.width = '20px';
  heartIcon.style.height = '20px';
  heartIcon.style.display = 'inline-flex';
  heartIcon.innerHTML = getStickerSvg('heart', { size: 20 });

  const likeCount = document.createElement('span');
  likeCount.className = 'like-count';
  likeCount.textContent = String(post.likesCount || 0);

  likeBtn.appendChild(heartIcon);
  likeBtn.appendChild(likeCount);

  if (handlers.onLike) {
    likeBtn.addEventListener('click', (e) => handlers.onLike(post, likeBtn, e));
  }

  // Comment button
  const commentBtn = document.createElement(handlers.onComment ? 'button' : 'a');
  if (!handlers.onComment) {
    commentBtn.href = `/post.html?id=${post.id}`;
  } else {
    commentBtn.type = 'button';
  }
  commentBtn.className = 'action-btn';
  commentBtn.setAttribute('aria-label', 'View comments');

  const commentIcon = document.createElement('span');
  commentIcon.style.width = '18px';
  commentIcon.style.height = '18px';
  commentIcon.style.display = 'inline-flex';
  commentIcon.innerHTML = getStickerSvg('sparkle', { size: 18 });

  const commentCount = document.createElement('span');
  commentCount.textContent = String(post.commentsCount || 0);

  commentBtn.appendChild(commentIcon);
  commentBtn.appendChild(commentCount);

  if (handlers.onComment) {
    commentBtn.addEventListener('click', () => handlers.onComment(post));
  }

  // Share button
  const shareBtn = document.createElement('button');
  shareBtn.type = 'button';
  shareBtn.className = 'action-btn';
  shareBtn.setAttribute('aria-label', 'Share bloom link');

  const shareIcon = document.createElement('span');
  shareIcon.style.width = '18px';
  shareIcon.style.height = '18px';
  shareIcon.style.display = 'inline-flex';
  shareIcon.innerHTML = getStickerSvg('sprout', { size: 18 });

  shareBtn.appendChild(shareIcon);
  shareBtn.appendChild(document.createTextNode('Share'));

  shareBtn.addEventListener('click', async () => {
    const postUrl = `${window.location.origin}/post.html?id=${post.id}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(postUrl);
        toast('Bloom link copied to clipboard!', 'info');
      } catch {
        toast(postUrl, 'info');
      }
    } else {
      toast(postUrl, 'info');
    }
  });

  actions.appendChild(likeBtn);
  actions.appendChild(commentBtn);
  actions.appendChild(shareBtn);
  card.appendChild(actions);

  return card;
}

export function buildUserRow(user, handlers = {}) {
  const row = document.createElement('div');
  row.className = 'user-row';
  row.setAttribute('data-id', user.id);

  const avatar = createAvatar({
    avatar: user.avatar,
    displayName: user.displayName || user.username,
    moodSticker: user.moodSticker,
    size: 'md'
  });

  const info = document.createElement('div');
  info.className = 'user-row-info';

  const nameLink = document.createElement('a');
  nameLink.href = `/profile.html?u=${encodeURIComponent(user.username)}`;
  nameLink.className = 'user-row-name';
  nameLink.textContent = user.displayName || user.username;

  const handle = document.createElement('div');
  handle.className = 'user-row-handle';
  handle.textContent = `@${user.username}`;

  info.appendChild(nameLink);
  info.appendChild(handle);

  row.appendChild(avatar);
  row.appendChild(info);

  if (!user.isMe) {
    const followBtn = document.createElement('button');
    followBtn.type = 'button';
    followBtn.className = `btn btn-sm ${user.isFollowing ? 'btn-secondary' : 'btn-primary'}`;
    followBtn.innerHTML = `
      <span class="btn-icon-slot" style="width: 14px; height: 14px; display: inline-flex;">${getStickerSvg(user.isFollowing ? 'flower' : 'sprout', { size: 14 })}</span>
      <span class="follow-text">${user.isFollowing ? 'Planted' : 'Plant'}</span>
    `;

    if (handlers.onFollow) {
      followBtn.addEventListener('click', (e) => handlers.onFollow(user, followBtn, e));
    }
    row.appendChild(followBtn);
  }

  return row;
}

export function buildCommentItem(comment, handlers = {}) {
  const item = document.createElement('div');
  item.className = 'comment-item';
  item.setAttribute('data-id', comment.id);

  const author = comment.author || {};
  const avatar = createAvatar({
    avatar: author.avatar,
    displayName: author.displayName || author.username,
    moodSticker: author.moodSticker,
    size: 'sm'
  });

  const content = document.createElement('div');
  content.className = 'comment-content';

  const header = document.createElement('div');
  header.className = 'comment-header';

  const authorLink = document.createElement('a');
  authorLink.href = `/profile.html?u=${encodeURIComponent(author.username || '')}`;
  authorLink.className = 'comment-author';
  authorLink.textContent = author.displayName || author.username || 'User';

  const timeEl = document.createElement('time');
  timeEl.className = 'comment-time';
  timeEl.textContent = formatTimeAgo(comment.createdAt);

  header.appendChild(authorLink);
  header.appendChild(timeEl);

  const text = document.createElement('p');
  text.className = 'comment-text';
  text.textContent = comment.text;

  content.appendChild(header);
  content.appendChild(text);

  item.appendChild(avatar);
  item.appendChild(content);

  return item;
}

export function buildNotificationItem(notification) {
  const item = document.createElement('div');
  item.className = `notification-item ${notification.read ? '' : 'unread'}`;
  item.setAttribute('data-id', notification.id);

  const fromUser = notification.from || {};
  const avatar = createAvatar({
    avatar: fromUser.avatar,
    displayName: fromUser.displayName || fromUser.username,
    size: 'sm'
  });

  const textDiv = document.createElement('div');
  textDiv.className = 'notification-text';

  const senderName = fromUser.displayName || fromUser.username || 'Someone';
  let actionDesc = 'interacted with you';
  if (notification.type === 'like') actionDesc = 'liked your bloom';
  if (notification.type === 'comment') actionDesc = 'commented on your bloom';
  if (notification.type === 'follow') actionDesc = 'started following you';

  textDiv.innerHTML = `<strong>${escapeSafe(senderName)}</strong> ${escapeSafe(actionDesc)}`;

  if (notification.postPreview) {
    const preview = document.createElement('span');
    preview.style.display = 'block';
    preview.style.fontSize = 'var(--text-xs)';
    preview.style.color = 'var(--color-text-light)';
    preview.style.fontStyle = 'italic';
    preview.textContent = `"${notification.postPreview}"`;
    textDiv.appendChild(preview);
  }

  const timeEl = document.createElement('time');
  timeEl.className = 'notification-time';
  timeEl.textContent = formatTimeAgo(notification.createdAt);

  item.appendChild(avatar);
  item.appendChild(textDiv);
  item.appendChild(timeEl);

  return item;
}

function escapeSafe(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const ui = {
  formatTimeAgo,
  toast,
  createAvatar,
  openModal,
  closeModal,
  createSkeletonPost,
  createSkeletonUser,
  buildEmptyState,
  buildPostCard,
  buildUserRow,
  buildCommentItem,
  buildNotificationItem
};

export default ui;

