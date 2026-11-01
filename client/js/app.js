// Bloomly Unified App Shell, Auth Guard, and Shared Navigation

import { api, setUnauthorizedHandler } from './api.js';
import { getStickerSvg, STICKER_NAMES } from './stickers.js';
import { toast, openModal, closeModal, createAvatar, formatTimeAgo } from './ui.js';
import { createHeartBurst } from './animations.js';

let currentUser = null;
let unreadPollTimer = null;
let lastKeyTime = 0;
let lastKey = '';

export function getCurrentUser() {
  return currentUser;
}

export async function initApp(options = {}) {
  const {
    activeTab = '',
    protectedPage = false,
    isAuthPage = false,
    onReady = null
  } = options;

  // 1. Soft Page Entrance & Link Transitions
  document.body.classList.add('page-enter');
  setupPageTransitions();

  // 2. Global Keyboard Shortcuts & Network Resilience
  setupKeyboardShortcuts();
  setupNetworkResilience();

  // 3. Global 401 Interceptor
  setUnauthorizedHandler(() => {
    if (!window.location.pathname.includes('auth.html') && !window.location.pathname.endsWith('/')) {
      toast('Your session has expired. Please sign in again.', 'info');
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      setTimeout(() => {
        window.location.href = `/auth.html?next=${next}`;
      }, 500);
    }
  });

  // 4. Check Auth Status
  try {
    const data = await api.getMe();
    currentUser = data.user;
    window.currentUser = currentUser;
  } catch {
    currentUser = null;
    window.currentUser = null;
  }

  // 5. Auth Guards
  if (currentUser && isAuthPage) {
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next');
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      window.location.href = next;
    } else {
      window.location.href = '/feed.html';
    }
    return;
  }

  if (!currentUser && protectedPage) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/auth.html?next=${next}`;
    return;
  }

  // 6. Build App Shell (Navbar, Mobile Tabbar, Notifications Panel)
  if (!isAuthPage) {
    renderAppShell(activeTab);
    if (currentUser) {
      startUnreadPolling();
    }
  }

  if (typeof onReady === 'function') {
    onReady(currentUser);
  }
}

// Render Header & Navigation
function renderAppShell(activeTab) {
  let navWrapper = document.querySelector('.navbar-wrapper');
  if (!navWrapper) {
    navWrapper = document.createElement('div');
    navWrapper.className = 'navbar-wrapper';
    document.body.prepend(navWrapper);
  }

  // Skip to content for accessibility
  if (!document.querySelector('.skip-to-content')) {
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.className = 'skip-to-content';
    skipLink.textContent = 'Skip to content';
    document.body.prepend(skipLink);
  }

  if (!currentUser) {
    // Guest Navbar
    navWrapper.innerHTML = `
      <nav class="navbar" aria-label="Main Navigation">
        <a href="/" class="nav-brand" aria-label="Bloomly Home">
          <span style="width: 32px; height: 32px; display: inline-flex;">${getStickerSvg('logo')}</span>
          <span class="nav-brand-text">Bloomly</span>
        </a>
        <div class="nav-links">
          <a href="/explore.html" class="nav-link ${activeTab === 'explore' ? 'active' : ''}">Explore</a>
          <a href="/styleguide.html" class="nav-link">Styleguide</a>
        </div>
        <div class="nav-actions">
          <a href="/auth.html?mode=login" class="btn btn-ghost btn-sm">Sign in</a>
          <a href="/auth.html?mode=register" class="btn btn-primary btn-sm">Get Started</a>
        </div>
      </nav>
    `;
    return;
  }

  // Authenticated Navbar
  navWrapper.innerHTML = `
    <nav class="navbar" aria-label="Main Navigation">
      <a href="/feed.html" class="nav-brand" aria-label="Bloomly Home">
        <span style="width: 32px; height: 32px; display: inline-flex;">${getStickerSvg('logo')}</span>
        <span class="nav-brand-text">Bloomly</span>
      </a>

      <!-- Live Search Box -->
      <div class="nav-search-wrap">
        <span class="nav-search-icon" aria-hidden="true">${getStickerSvg('sparkle', { size: 16 })}</span>
        <input type="search" class="nav-search-input" id="nav-search-input" placeholder="Search gardeners..." aria-label="Search gardeners" autocomplete="off">
        <div class="search-results-dropdown" id="search-dropdown" role="listbox" aria-label="Search results"></div>
      </div>

      <div class="nav-links">
        <a href="/feed.html" class="nav-link ${activeTab === 'feed' ? 'active' : ''}">Home</a>
        <a href="/explore.html" class="nav-link ${activeTab === 'explore' ? 'active' : ''}">Explore</a>
      </div>

      <div class="nav-actions">
        <!-- Prominent New Bloom button -->
        <button type="button" class="btn btn-primary btn-sm" id="nav-new-bloom-btn">
          <span style="width: 16px; height: 16px; display: inline-flex;">${getStickerSvg('flower', { size: 16 })}</span>
          <span>New Bloom</span>
        </button>

        <!-- Notifications Bell -->
        <div class="notif-btn-wrap">
          <button type="button" class="btn-icon" id="nav-notif-btn" aria-label="Notifications">
            <span style="width: 20px; height: 20px; display: inline-flex;">${getStickerSvg('heart', { size: 20 })}</span>
          </button>
          <span class="notif-badge hidden" id="nav-notif-badge" aria-label="Unread notifications count">0</span>
        </div>

        <!-- Avatar Menu Dropdown -->
        <div class="avatar-menu-wrap">
          <button type="button" class="btn-ghost" id="nav-avatar-btn" style="padding: 2px; border-radius: var(--radius-full);" aria-expanded="false" aria-haspopup="true" aria-label="Account menu">
            <div id="nav-avatar-slot"></div>
          </button>

          <div class="avatar-dropdown-menu" id="nav-avatar-menu" role="menu">
            <a href="/profile.html?u=${encodeURIComponent(currentUser.username)}" class="dropdown-item" role="menuitem">
              <span style="width: 18px; height: 18px; display: inline-flex;">${getStickerSvg('plant', { size: 18 })}</span>
              <span>My Garden</span>
            </a>
            <button type="button" class="dropdown-item" id="menu-edit-profile-btn" role="menuitem">
              <span style="width: 18px; height: 18px; display: inline-flex;">${getStickerSvg('sprout', { size: 18 })}</span>
              <span>Edit Profile</span>
            </button>
            <button type="button" class="dropdown-item" id="menu-shortcuts-btn" role="menuitem">
              <span style="width: 18px; height: 18px; display: inline-flex;">${getStickerSvg('star', { size: 18 })}</span>
              <span>Shortcuts (?)</span>
            </button>
            <div class="dropdown-divider"></div>
            <button type="button" class="dropdown-item" id="menu-logout-btn" role="menuitem" style="color: var(--color-danger);">
              <span style="width: 18px; height: 18px; display: inline-flex;">${getStickerSvg('cloud', { size: 18 })}</span>
              <span>Log out</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  `;

  // Render current user avatar into avatar slot
  const avatarSlot = document.getElementById('nav-avatar-slot');
  if (avatarSlot) {
    avatarSlot.appendChild(
      createAvatar({
        avatar: currentUser.avatar,
        displayName: currentUser.displayName || currentUser.username,
        moodSticker: currentUser.moodSticker,
        size: 'sm'
      })
    );
  }

  // Render Mobile Bottom Tab Bar
  let mobileTabbar = document.querySelector('.tabbar-mobile');
  if (!mobileTabbar) {
    mobileTabbar = document.createElement('nav');
    mobileTabbar.className = 'tabbar-mobile';
    mobileTabbar.setAttribute('aria-label', 'Mobile Navigation');
    document.body.appendChild(mobileTabbar);
  }

  mobileTabbar.innerHTML = `
    <a href="/feed.html" class="tabbar-item ${activeTab === 'feed' ? 'active' : ''}" aria-label="Home Feed">
      <span style="width: 22px; height: 22px; display: inline-flex;">${getStickerSvg('flower', { size: 22 })}</span>
      <span>Home</span>
    </a>
    <a href="/explore.html" class="tabbar-item ${activeTab === 'explore' ? 'active' : ''}" aria-label="Explore Garden">
      <span style="width: 22px; height: 22px; display: inline-flex;">${getStickerSvg('sparkle', { size: 22 })}</span>
      <span>Explore</span>
    </a>
    <button type="button" class="tabbar-item" id="mobile-create-btn" aria-label="New Bloom" style="background: none; border: none; cursor: pointer; color: var(--color-primary-strong);">
      <span style="width: 26px; height: 26px; display: inline-flex; filter: drop-shadow(0 2px 4px rgba(255, 111, 145, 0.4));">${getStickerSvg('sprout', { size: 26 })}</span>
      <span style="font-weight: 700;">Bloom</span>
    </button>
    <button type="button" class="tabbar-item ${activeTab === 'notifications' ? 'active' : ''}" id="mobile-notif-btn" aria-label="Notifications" style="background: none; border: none; cursor: pointer; position: relative;">
      <span style="width: 22px; height: 22px; display: inline-flex;">${getStickerSvg('heart', { size: 22 })}</span>
      <span>Alerts</span>
      <span class="notif-badge hidden" id="mobile-notif-badge" style="top: -2px; right: 12px;">0</span>
    </button>
    <a href="/profile.html?u=${encodeURIComponent(currentUser.username)}" class="tabbar-item ${activeTab === 'profile' ? 'active' : ''}" aria-label="My Profile">
      <span style="width: 22px; height: 22px; display: inline-flex;">${getStickerSvg('plant', { size: 22 })}</span>
      <span>Garden</span>
    </a>
  `;

  // Attach navbar events
  setupNavbarEvents();
}

function setupNavbarEvents() {
  // New bloom button click
  const newBloomBtn = document.getElementById('nav-new-bloom-btn');
  const mobileCreateBtn = document.getElementById('mobile-create-btn');
  if (newBloomBtn) newBloomBtn.addEventListener('click', () => openComposerModal());
  if (mobileCreateBtn) mobileCreateBtn.addEventListener('click', () => openComposerModal());

  // Avatar Menu toggle
  const avatarBtn = document.getElementById('nav-avatar-btn');
  const avatarMenu = document.getElementById('nav-avatar-menu');
  if (avatarBtn && avatarMenu) {
    avatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = avatarMenu.classList.toggle('active');
      avatarBtn.setAttribute('aria-expanded', String(isActive));
    });

    document.addEventListener('click', (e) => {
      if (!avatarMenu.contains(e.target) && e.target !== avatarBtn) {
        avatarMenu.classList.remove('active');
        avatarBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Edit profile button in menu
  const editProfileBtn = document.getElementById('menu-edit-profile-btn');
  if (editProfileBtn) {
    editProfileBtn.addEventListener('click', () => {
      if (avatarMenu) avatarMenu.classList.remove('active');
      openEditProfileModal();
    });
  }

  // Shortcuts button in menu
  const shortcutsBtn = document.getElementById('menu-shortcuts-btn');
  if (shortcutsBtn) {
    shortcutsBtn.addEventListener('click', () => {
      if (avatarMenu) avatarMenu.classList.remove('active');
      openShortcutsModal();
    });
  }

  // Logout button in menu
  const logoutBtn = document.getElementById('menu-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await api.logout();
        toast('Logged out safely. See you soon!', 'info');
        setTimeout(() => {
          window.location.href = '/';
        }, 600);
      } catch (err) {
        toast(err.message || 'Logout failed', 'error');
      }
    });
  }

  // Notifications Bell click
  const notifBtn = document.getElementById('nav-notif-btn');
  const mobileNotifBtn = document.getElementById('mobile-notif-btn');
  if (notifBtn) notifBtn.addEventListener('click', () => toggleNotificationsPanel());
  if (mobileNotifBtn) mobileNotifBtn.addEventListener('click', () => toggleNotificationsPanel());

  // Search input live dropdown
  setupLiveSearch();
}

function setupLiveSearch() {
  const searchInput = document.getElementById('nav-search-input');
  const dropdown = document.getElementById('search-dropdown');
  if (!searchInput || !dropdown) return;

  let debounceTimer = null;
  let activeAbortController = null;

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    clearTimeout(debounceTimer);

    if (q.length < 2) {
      dropdown.classList.remove('active');
      dropdown.innerHTML = '';
      return;
    }

    debounceTimer = setTimeout(async () => {
      if (activeAbortController) {
        activeAbortController.abort();
      }
      activeAbortController = new AbortController();

      dropdown.innerHTML = `<div style="padding: var(--space-3); font-size: var(--text-xs); color: var(--color-text-light);">Searching for gardeners...</div>`;
      dropdown.classList.add('active');

      try {
        const res = await api.searchUsers(q);
        const users = res.items || [];

        dropdown.innerHTML = '';
        if (!users.length) {
          dropdown.innerHTML = `<div style="padding: var(--space-3); font-size: var(--text-xs); color: var(--color-text-muted);">No gardeners found matching "${escapeText(q)}"</div>`;
          return;
        }

        users.forEach((u) => {
          const item = document.createElement('a');
          item.href = `/profile.html?u=${encodeURIComponent(u.username)}`;
          item.className = 'search-result-item';
          item.setAttribute('role', 'option');

          const av = createAvatar({
            avatar: u.avatar,
            displayName: u.displayName || u.username,
            moodSticker: u.moodSticker,
            size: 'sm'
          });

          const meta = document.createElement('div');
          meta.style.flex = '1';
          meta.style.minWidth = '0';

          const nameEl = document.createElement('div');
          nameEl.style.fontFamily = 'var(--font-heading)';
          nameEl.style.fontSize = 'var(--text-sm)';
          nameEl.style.fontWeight = '600';
          nameEl.textContent = u.displayName || u.username;

          const handleEl = document.createElement('div');
          handleEl.style.fontSize = 'var(--text-xs)';
          handleEl.style.color = 'var(--color-text-muted)';
          handleEl.textContent = `@${u.username}`;

          meta.appendChild(nameEl);
          meta.appendChild(handleEl);

          item.appendChild(av);
          item.appendChild(meta);
          dropdown.appendChild(item);
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          dropdown.innerHTML = `<div style="padding: var(--space-3); font-size: var(--text-xs); color: var(--color-danger);">Error searching gardeners</div>`;
        }
      }
    }, 300);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = searchInput.value.trim();
      if (q.length >= 2) {
        dropdown.classList.remove('active');
        window.location.href = `/explore.html?q=${encodeURIComponent(q)}`;
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== searchInput) {
      dropdown.classList.remove('active');
    }
  });
}

// Notifications Slide Panel
let notifPanelBackdrop = null;
let notifPanel = null;

function ensureNotificationsPanel() {
  if (notifPanelBackdrop) return;

  notifPanelBackdrop = document.createElement('div');
  notifPanelBackdrop.className = 'slide-panel-backdrop';

  notifPanel = document.createElement('div');
  notifPanel.className = 'slide-panel';
  notifPanel.innerHTML = `
    <div class="slide-panel-header">
      <h3 class="slide-panel-title">
        <span style="width: 22px; height: 22px; display: inline-flex;">${getStickerSvg('heart', { size: 22 })}</span>
        <span>Garden Alerts</span>
      </h3>
      <div style="display: flex; align-items: center; gap: var(--space-2);">
        <button type="button" class="btn btn-ghost btn-sm" id="notif-mark-all-btn" style="font-size: var(--text-xs);">Mark all read</button>
        <button type="button" class="modal-close" id="notif-close-btn" aria-label="Close alerts">×</button>
      </div>
    </div>
    <div class="slide-panel-body" id="notif-list-slot">
      <div style="padding: var(--space-6); text-align: center; color: var(--color-text-light);">Loading alerts...</div>
    </div>
  `;

  notifPanelBackdrop.appendChild(notifPanel);
  document.body.appendChild(notifPanelBackdrop);

  const closeBtn = notifPanel.querySelector('#notif-close-btn');
  closeBtn.addEventListener('click', closeNotificationsPanel);
  notifPanelBackdrop.addEventListener('click', (e) => {
    if (e.target === notifPanelBackdrop) closeNotificationsPanel();
  });

  const markAllBtn = notifPanel.querySelector('#notif-mark-all-btn');
  markAllBtn.addEventListener('click', async () => {
    try {
      await api.markAllNotificationsAsRead();
      updateUnreadBadge(0);
      loadNotificationsList();
      toast('All notifications marked as read', 'info');
    } catch {
      toast('Failed to mark notifications read', 'error');
    }
  });
}

export function openNotificationsPanel() {
  ensureNotificationsPanel();
  notifPanelBackdrop.classList.add('active');
  document.body.style.overflow = 'hidden';
  loadNotificationsList();
}

export function closeNotificationsPanel() {
  if (notifPanelBackdrop) {
    notifPanelBackdrop.classList.remove('active');
    document.body.style.overflow = '';
  }
}

export function toggleNotificationsPanel() {
  if (notifPanelBackdrop && notifPanelBackdrop.classList.contains('active')) {
    closeNotificationsPanel();
  } else {
    openNotificationsPanel();
  }
}

async function loadNotificationsList() {
  const slot = document.getElementById('notif-list-slot');
  if (!slot) return;

  try {
    const res = await api.getNotifications(1, 20);
    const items = res.items || [];
    slot.innerHTML = '';

    if (!items.length) {
      slot.innerHTML = `
        <div class="empty-state" style="padding: var(--space-8) var(--space-4); border: none;">
          <div style="width: 56px; height: 56px; margin-bottom: var(--space-3);">${getStickerSvg('sparkle', { size: 56 })}</div>
          <h4 style="font-family: var(--font-heading); margin-bottom: var(--space-1);">Quiet in the garden</h4>
          <p style="font-size: var(--text-xs); color: var(--color-text-muted);">When others like your blooms or plant with you, alerts will appear here.</p>
        </div>
      `;
      return;
    }

    items.forEach((notif) => {
      const row = document.createElement('div');
      row.className = `notification-item ${notif.read ? '' : 'unread'}`;
      row.style.cursor = 'pointer';

      const fromUser = notif.from || {};
      const av = createAvatar({
        avatar: fromUser.avatar,
        displayName: fromUser.displayName || fromUser.username,
        size: 'sm'
      });

      const body = document.createElement('div');
      body.className = 'notification-body';

      let stickerKey = 'heart';
      let actionText = 'interacted with your bloom';
      if (notif.type === 'like') {
        stickerKey = 'heart';
        actionText = 'sent you a heart';
      } else if (notif.type === 'comment') {
        stickerKey = 'sparkle';
        actionText = 'commented on your bloom';
      } else if (notif.type === 'follow') {
        stickerKey = 'sprout';
        actionText = 'planted you in their garden';
      }

      body.innerHTML = `
        <div><strong>${escapeText(fromUser.displayName || fromUser.username || 'A gardener')}</strong> ${actionText}</div>
        ${notif.postPreview ? `<div style="font-size: var(--text-xs); color: var(--color-text-light); font-style: italic; margin-top: 2px;">"${escapeText(notif.postPreview)}"</div>` : ''}
      `;

      const rightCol = document.createElement('div');
      rightCol.style.display = 'flex';
      rightCol.style.flexDirection = 'column';
      rightCol.style.alignItems = 'flex-end';
      rightCol.style.gap = '4px';

      const timeEl = document.createElement('time');
      timeEl.className = 'notification-time';
      timeEl.textContent = formatTimeAgo(notif.createdAt);

      const stickerEl = document.createElement('span');
      stickerEl.style.width = '16px';
      stickerEl.style.height = '16px';
      stickerEl.style.display = 'inline-flex';
      stickerEl.innerHTML = getStickerSvg(stickerKey, { size: 16 });

      rightCol.appendChild(timeEl);
      rightCol.appendChild(stickerEl);

      row.appendChild(av);
      row.appendChild(body);
      row.appendChild(rightCol);

      row.addEventListener('click', async () => {
        if (!notif.read) {
          try {
            await api.markNotificationAsRead(notif.id);
            row.classList.remove('unread');
            decrementUnreadBadge();
          } catch {}
        }
        closeNotificationsPanel();
        if (notif.postId) {
          window.location.href = `/post.html?id=${notif.postId}`;
        } else if (fromUser.username) {
          window.location.href = `/profile.html?u=${encodeURIComponent(fromUser.username)}`;
        }
      });

      slot.appendChild(row);
    });
  } catch {
    slot.innerHTML = `<div style="padding: var(--space-6); text-align: center; color: var(--color-danger); font-size: var(--text-sm);">Failed to load alerts</div>`;
  }
}

// Unread Badge and Polling
function startUnreadPolling() {
  fetchUnreadCount();
  if (unreadPollTimer) clearInterval(unreadPollTimer);

  unreadPollTimer = setInterval(() => {
    if (!document.hidden && currentUser) {
      fetchUnreadCount();
    }
  }, 30000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentUser) {
      fetchUnreadCount();
    }
  });
}

async function fetchUnreadCount() {
  try {
    const res = await api.getUnreadCount();
    updateUnreadBadge(res.count || 0);
  } catch {}
}

export function updateUnreadBadge(count) {
  const desktopBadge = document.getElementById('nav-notif-badge');
  const mobileBadge = document.getElementById('mobile-notif-badge');

  [desktopBadge, mobileBadge].forEach((b) => {
    if (!b) return;
    if (count > 0) {
      b.textContent = count > 99 ? '99+' : String(count);
      b.classList.remove('hidden');
    } else {
      b.textContent = '0';
      b.classList.add('hidden');
    }
  });
}

function decrementUnreadBadge() {
  const desktopBadge = document.getElementById('nav-notif-badge');
  if (desktopBadge && !desktopBadge.classList.contains('hidden')) {
    const current = parseInt(desktopBadge.textContent, 10) || 1;
    updateUnreadBadge(Math.max(0, current - 1));
  }
}

// Global Composer Modal
export function openComposerModal(onSuccessCallback = null) {
  if (!currentUser) {
    window.location.href = `/auth.html?next=${encodeURIComponent(window.location.pathname)}`;
    return;
  }

  const content = document.createElement('div');
  content.innerHTML = `
    <div style="display: flex; gap: var(--space-3); margin-bottom: var(--space-3);">
      <div id="modal-composer-avatar"></div>
      <div style="flex: 1;">
        <textarea id="modal-composer-text" class="composer-textarea" placeholder="What is blooming in your corner of the world?" rows="4" maxlength="500"></textarea>
      </div>
    </div>

    <!-- Image preview wrap -->
    <div id="modal-preview-wrap" class="composer-preview-wrap" style="display: none; margin-bottom: var(--space-3);">
      <img id="modal-preview-img" src="" alt="Moment preview">
      <button type="button" class="composer-preview-remove" id="modal-preview-remove" aria-label="Remove photo">×</button>
    </div>

    <div class="composer-footer">
      <div class="composer-actions">
        <label class="btn-icon" style="cursor: pointer; width: 36px; height: 36px;" title="Attach photo (Max 2MB)">
          <input type="file" id="modal-composer-file" accept="image/png,image/jpeg,image/webp,image/gif" style="display: none;">
          <span style="width: 18px; height: 18px; display: inline-flex;">${getStickerSvg('plant', { size: 18 })}</span>
        </label>
        <span class="composer-counter" id="modal-composer-counter">0 / 500</span>
      </div>

      <button type="button" class="btn btn-primary" id="modal-composer-submit">
        <span>Bloom</span>
        <span style="width: 16px; height: 16px; display: inline-flex;">${getStickerSvg('flower', { size: 16 })}</span>
      </button>
    </div>
  `;

  const avSlot = content.querySelector('#modal-composer-avatar');
  avSlot.appendChild(
    createAvatar({
      avatar: currentUser.avatar,
      displayName: currentUser.displayName || currentUser.username,
      moodSticker: currentUser.moodSticker,
      size: 'md'
    })
  );

  const modal = openModal({
    title: 'Plant a New Bloom',
    content
  });

  const textarea = content.querySelector('#modal-composer-text');
  const counter = content.querySelector('#modal-composer-counter');
  const fileInput = content.querySelector('#modal-composer-file');
  const previewWrap = content.querySelector('#modal-preview-wrap');
  const previewImg = content.querySelector('#modal-preview-img');
  const removeBtn = content.querySelector('#modal-preview-remove');
  const submitBtn = content.querySelector('#modal-composer-submit');

  let selectedFile = null;

  textarea.focus();

  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    counter.textContent = `${len} / 500`;
    counter.classList.toggle('warning', len >= 480);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast('Photo must be under 2MB', 'error');
      fileInput.value = '';
      return;
    }

    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewWrap.style.display = 'block';
    };
    reader.readAsDataURL(file);
  });

  removeBtn.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    previewImg.src = '';
    previewWrap.style.display = 'none';
  });

  submitBtn.addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text && !selectedFile) {
      toast('Write a thought or attach a picture to bloom', 'error');
      return;
    }

    submitBtn.classList.add('btn-loading');
    submitBtn.disabled = true;

    try {
      const formData = new FormData();
      if (text) formData.append('text', text);
      if (selectedFile) formData.append('image', selectedFile);

      const res = await api.createPost(formData);
      modal.close();

      createHeartBurst(window.innerWidth / 2, window.innerHeight / 2, 12);
      toast('Your moment bloomed beautifully!', 'success');

      if (typeof onSuccessCallback === 'function') {
        onSuccessCallback(res.post);
      } else if (window.location.pathname.includes('feed.html')) {
        if (typeof window.onNewPostCreated === 'function') {
          window.onNewPostCreated(res.post);
        }
      }
    } catch (err) {
      toast(err.message || 'Failed to plant bloom', 'error');
    } finally {
      submitBtn.classList.remove('btn-loading');
      submitBtn.disabled = false;
    }
  });
}

// Global Edit Profile Modal
export function openEditProfileModal(onProfileUpdated = null) {
  if (!currentUser) return;

  const content = document.createElement('div');
  content.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: var(--space-4);">
      <!-- Avatar Section -->
      <div style="display: flex; align-items: center; gap: var(--space-4);">
        <div id="edit-avatar-preview"></div>
        <div>
          <label class="btn btn-secondary btn-sm" style="cursor: pointer;">
            <span>Choose photo</span>
            <input type="file" id="edit-avatar-file" accept="image/png,image/jpeg,image/webp,image/gif" style="display: none;">
          </label>
          ${currentUser.avatar ? `<button type="button" class="btn btn-ghost btn-sm" id="edit-avatar-remove" style="color: var(--color-danger); margin-left: var(--space-2);">Remove</button>` : ''}
          <div style="font-size: var(--text-xs); color: var(--color-text-light); margin-top: 4px;">Max 2MB (jpg, png, webp, gif)</div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="edit-display-name">Display Name</label>
        <input type="text" class="form-input" id="edit-display-name" maxlength="30" value="${escapeText(currentUser.displayName || '')}">
      </div>

      <div class="form-group">
        <label class="form-label" for="edit-bio">Bio</label>
        <textarea class="form-textarea" id="edit-bio" rows="3" maxlength="160" style="min-height: 80px;">${escapeText(currentUser.bio || '')}</textarea>
        <div style="display: flex; justify-content: flex-end;">
          <span style="font-size: var(--text-xs); color: var(--color-text-light);" id="edit-bio-counter">0 / 160</span>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Garden Mood Sticker</label>
        <div id="edit-sticker-picker" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: var(--space-2);"></div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: var(--space-3); margin-top: var(--space-2);">
        <button type="button" class="btn btn-secondary" id="edit-cancel-btn">Cancel</button>
        <button type="button" class="btn btn-primary" id="edit-save-btn">Save Garden Profile</button>
      </div>
    </div>
  `;

  let selectedMood = currentUser.moodSticker || 'flower';
  let newAvatarFile = null;
  let removeAvatarFlag = false;

  const avSlot = content.querySelector('#edit-avatar-preview');
  function refreshAvatarPreview(src = null) {
    avSlot.innerHTML = '';
    avSlot.appendChild(
      createAvatar({
        avatar: src !== null ? src : currentUser.avatar,
        displayName: currentUser.displayName || currentUser.username,
        moodSticker: selectedMood,
        size: 'lg'
      })
    );
  }
  refreshAvatarPreview();

  // Mood sticker picker
  const picker = content.querySelector('#edit-sticker-picker');
  STICKER_NAMES.forEach((name) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn-icon ${name === selectedMood ? 'active' : ''}`;
    btn.style.width = '42px';
    btn.style.height = '42px';
    btn.innerHTML = getStickerSvg(name, { size: 26 });
    btn.setAttribute('aria-label', `Select ${name} sticker`);
    btn.addEventListener('click', () => {
      selectedMood = name;
      picker.querySelectorAll('.btn-icon').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      refreshAvatarPreview(newAvatarFile ? previewDataUrl : (removeAvatarFlag ? '' : currentUser.avatar));
    });
    picker.appendChild(btn);
  });

  const modal = openModal({
    title: 'Edit Garden Profile',
    content
  });

  const fileInput = content.querySelector('#edit-avatar-file');
  let previewDataUrl = null;
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast('Photo must be under 2MB', 'error');
      fileInput.value = '';
      return;
    }
    newAvatarFile = f;
    removeAvatarFlag = false;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewDataUrl = e.target.result;
      refreshAvatarPreview(previewDataUrl);
    };
    reader.readAsDataURL(f);
  });

  const removeAvBtn = content.querySelector('#edit-avatar-remove');
  if (removeAvBtn) {
    removeAvBtn.addEventListener('click', () => {
      newAvatarFile = null;
      removeAvatarFlag = true;
      fileInput.value = '';
      refreshAvatarPreview('');
    });
  }

  const bioInput = content.querySelector('#edit-bio');
  const bioCounter = content.querySelector('#edit-bio-counter');
  bioInput.addEventListener('input', () => {
    bioCounter.textContent = `${bioInput.value.length} / 160`;
  });
  bioCounter.textContent = `${bioInput.value.length} / 160`;

  content.querySelector('#edit-cancel-btn').addEventListener('click', () => modal.close());

  const saveBtn = content.querySelector('#edit-save-btn');
  saveBtn.addEventListener('click', async () => {
    const displayName = content.querySelector('#edit-display-name').value.trim();
    const bio = bioInput.value.trim();

    saveBtn.classList.add('btn-loading');
    saveBtn.disabled = true;

    try {
      const formData = new FormData();
      formData.append('displayName', displayName);
      formData.append('bio', bio);
      formData.append('moodSticker', selectedMood);
      if (newAvatarFile) {
        formData.append('avatar', newAvatarFile);
      } else if (removeAvatarFlag) {
        formData.append('removeAvatar', 'true');
      }

      const res = await api.updateProfile(formData);
      currentUser = res.user;
      window.currentUser = currentUser;

      // Update navbar avatar
      const navSlot = document.getElementById('nav-avatar-slot');
      if (navSlot) {
        navSlot.innerHTML = '';
        navSlot.appendChild(
          createAvatar({
            avatar: currentUser.avatar,
            displayName: currentUser.displayName || currentUser.username,
            moodSticker: currentUser.moodSticker,
            size: 'sm'
          })
        );
      }

      modal.close();
      toast('Garden profile updated!', 'success');

      if (typeof onProfileUpdated === 'function') {
        onProfileUpdated(currentUser);
      }
    } catch (err) {
      toast(err.message || 'Failed to update profile', 'error');
    } finally {
      saveBtn.classList.remove('btn-loading');
      saveBtn.disabled = false;
    }
  });
}

// Shortcuts Help Dialog
function openShortcutsModal() {
  const content = document.createElement('div');
  content.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: var(--space-3); font-size: var(--text-sm);">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border);">
        <span>New Bloom</span>
        <kbd style="padding: 2px 8px; background: var(--color-primary-light); border-radius: var(--radius-sm); font-family: monospace;">N</kbd>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border);">
        <span>Search Gardeners</span>
        <kbd style="padding: 2px 8px; background: var(--color-primary-light); border-radius: var(--radius-sm); font-family: monospace;">/</kbd>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border);">
        <span>Go to Home Feed</span>
        <kbd style="padding: 2px 8px; background: var(--color-primary-light); border-radius: var(--radius-sm); font-family: monospace;">G then H</kbd>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2) 0;">
        <span>Close Dialog / Panel</span>
        <kbd style="padding: 2px 8px; background: var(--color-primary-light); border-radius: var(--radius-sm); font-family: monospace;">Esc</kbd>
      </div>
    </div>
  `;
  openModal({
    title: 'Keyboard Shortcuts',
    content
  });
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignore when focus is inside text input, textarea, or contenteditable
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
      return;
    }

    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      e.preventDefault();
      openShortcutsModal();
      return;
    }

    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      openComposerModal();
      return;
    }

    if (e.key === '/') {
      e.preventDefault();
      const search = document.getElementById('nav-search-input');
      if (search) search.focus();
      return;
    }

    const now = Date.now();
    if (e.key === 'g' || e.key === 'G') {
      lastKey = 'g';
      lastKeyTime = now;
      return;
    }

    if ((e.key === 'h' || e.key === 'H') && lastKey === 'g' && now - lastKeyTime < 1000) {
      e.preventDefault();
      lastKey = '';
      window.location.href = '/feed.html';
      return;
    }
  });
}

function setupPageTransitions() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link || !link.href) return;
    if (link.target === '_blank' || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (link.href.startsWith('mailto:') || link.href.startsWith('tel:') || link.href.includes('#')) return;

    const url = new URL(link.href, window.location.origin);
    if (url.origin === window.location.origin && url.pathname !== window.location.pathname) {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }
      e.preventDefault();
      document.body.classList.add('page-fade-out');
      setTimeout(() => {
        window.location.href = link.href;
      }, 150);
    }
  });
}

function setupNetworkResilience() {
  window.addEventListener('offline', () => {
    toast('You are currently offline. Check your connection.', 'error', 4000);
  });
  window.addEventListener('online', () => {
    toast('Back online! Reconnected to the garden.', 'success', 3000);
  });
}

function escapeText(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const app = {
  getCurrentUser,
  initApp,
  openComposerModal,
  openEditProfileModal,
  openNotificationsPanel,
  closeNotificationsPanel,
  toggleNotificationsPanel,
  updateUnreadBadge
};

export default app;
