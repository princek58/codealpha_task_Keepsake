// Keepsake Shared App Shell Controller
import { searchUsers, getNotifications, markNotificationRead, markAllNotificationsRead, getUnreadNotificationCount, logout } from './api.js';
import { icon } from './icons.js';
import { showToast, buildAvatar, formatTimeAgo, setupFocusTrap } from './ui.js';

let notificationsPollTimer = null;
let pollInterval = 30000;
let consecutivePollErrors = 0;
let gKeyPressedTime = 0;
let currentSearchAbort = null;

/**
 * Mounts the complete shared app shell on any app page.
 * @param {Object} options
 * @param {string} options.activeTab - 'home' | 'library' | 'create' | 'albums' | 'explore' | 'profile' | 'settings'
 * @param {Object} options.user - Current user object
 * @param {string} [options.pageTitle] - Custom page title
 */
export function mountAppShell({ activeTab = 'home', user = null, pageTitle = '' }) {
  if (pageTitle) {
    document.title = `${pageTitle} — Keepsake`;
  }

  // 1. Skip link
  insertSkipLink();

  // 2. Offline banner
  initOfflineBanner();

  // 3. Navbar and Tab Bar
  buildNavbar(activeTab, user);
  buildMobileTabBar(activeTab, user);

  // 4. Notifications Drawer
  initNotificationsDrawer();

  // 5. Global Keyboard Shortcuts
  initKeyboardShortcuts();

  // 6. Start Notifications Polling if user is authenticated
  if (user) {
    startNotificationsPolling();
  }
}

function insertSkipLink() {
  if (document.querySelector('.skip-link')) return;
  const skip = document.createElement('a');
  skip.href = '#main-content';
  skip.className = 'skip-link';
  skip.textContent = 'Skip to main content';
  document.body.prepend(skip);
}

function initOfflineBanner() {
  if (document.querySelector('.offline-banner')) return;
  const banner = document.createElement('div');
  banner.className = 'offline-banner';
  banner.textContent = 'You are currently offline. Keepsake will reconnect automatically.';
  document.body.prepend(banner);

  const updateOnlineStatus = () => {
    if (navigator.onLine) {
      if (banner.classList.contains('active')) {
        banner.classList.remove('active');
        showToast('Connection restored. You are back online.', 'success', 3000);
      }
    } else {
      banner.classList.add('active');
    }
  };

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  if (!navigator.onLine) banner.classList.add('active');
}

function buildNavbar(activeTab, user) {
  let header = document.querySelector('header.navbar');
  if (!header) {
    header = document.createElement('header');
    header.className = 'navbar';
    header.setAttribute('role', 'banner');
    document.body.prepend(header);
  }

  header.innerHTML = '';
  const nav = document.createElement('nav');
  nav.className = 'navbar-pill';
  nav.setAttribute('aria-label', 'Main Navigation');

  // Brand Logo
  const brand = document.createElement('a');
  brand.href = '/home.html';
  brand.className = 'navbar-brand';
  brand.innerHTML = `
    <img src="/assets/brand/mark.svg" width="28" height="28" alt="Keepsake Logo">
    <span>Keepsake</span>
  `;
  nav.appendChild(brand);

  // Search Box
  const searchWrap = document.createElement('div');
  searchWrap.className = 'navbar-search';

  const searchIcon = icon('search', { size: 16 });
  searchIcon.classList.add('navbar-search-icon');
  searchWrap.appendChild(searchIcon);

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'navbar-search-input';
  searchInput.placeholder = 'Search people... (/)';
  searchInput.setAttribute('aria-label', 'Search people');
  searchWrap.appendChild(searchInput);

  const searchDropdown = document.createElement('div');
  searchDropdown.className = 'search-dropdown';
  searchWrap.appendChild(searchDropdown);

  initNavbarSearch(searchInput, searchDropdown);
  nav.appendChild(searchWrap);

  // Desktop Navigation Links
  const linksUl = document.createElement('ul');
  linksUl.className = 'navbar-links';

  const links = [
    { id: 'home', label: 'Home', href: '/home.html' },
    { id: 'library', label: 'Library', href: '/library.html' },
    { id: 'albums', label: 'Albums', href: '/albums.html' },
    { id: 'explore', label: 'Explore', href: '/explore.html' }
  ];

  links.forEach((l) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = l.href;
    a.textContent = l.label;
    if (activeTab === l.id) {
      a.className = 'active';
      a.setAttribute('aria-current', 'page');
    }
    li.appendChild(a);
    linksUl.appendChild(li);
  });
  nav.appendChild(linksUl);

  // Right Navbar Actions
  const actions = document.createElement('div');
  actions.className = 'navbar-actions';

  // "New Moment" Primary Button
  const newMomentBtn = document.createElement('a');
  newMomentBtn.href = '/moment-new.html';
  newMomentBtn.className = 'btn btn-primary btn-sm';
  newMomentBtn.style.gap = 'var(--space-2xs)';
  const plusIcon = icon('plus', { size: 16 });
  newMomentBtn.appendChild(plusIcon);
  const btnText = document.createElement('span');
  btnText.textContent = 'New moment';
  newMomentBtn.appendChild(btnText);
  actions.appendChild(newMomentBtn);

  // Notification Bell Button
  const bellBtn = document.createElement('button');
  bellBtn.className = 'btn-icon';
  bellBtn.style.position = 'relative';
  bellBtn.setAttribute('aria-label', 'Notifications');
  bellBtn.appendChild(icon('bell', { size: 20 }));

  const badge = document.createElement('span');
  badge.className = 'nav-badge';
  badge.id = 'shell-unread-badge';
  badge.style.display = 'none';
  badge.textContent = '0';
  bellBtn.appendChild(badge);

  bellBtn.onclick = () => openNotificationsDrawer();
  actions.appendChild(bellBtn);

  // User Profile / Avatar Dropdown
  if (user) {
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown';

    const avatarBtn = document.createElement('button');
    avatarBtn.className = 'btn-icon';
    avatarBtn.style.padding = '0';
    avatarBtn.setAttribute('aria-label', 'User account menu');
    avatarBtn.setAttribute('aria-expanded', 'false');

    const av = buildAvatar(user, 'sm');
    avatarBtn.appendChild(av);
    dropdown.appendChild(avatarBtn);

    const menu = document.createElement('div');
    menu.className = 'dropdown-menu';
    menu.style.minWidth = '200px';
    menu.style.right = '0';
    menu.style.left = 'auto';

    // User greeting header
    const userHeader = document.createElement('div');
    userHeader.style.padding = '8px 12px';
    userHeader.style.borderBottom = '1px solid var(--color-sand)';
    userHeader.style.marginBottom = '4px';

    const dName = document.createElement('div');
    dName.style.fontWeight = '600';
    dName.style.fontSize = 'var(--text-sm)';
    dName.textContent = user.displayName || user.username;
    userHeader.appendChild(dName);

    const uName = document.createElement('div');
    uName.style.fontSize = 'var(--text-xs)';
    uName.style.color = 'var(--color-stone)';
    uName.textContent = `@${user.username}`;
    userHeader.appendChild(uName);
    menu.appendChild(userHeader);

    // Profile link
    const profileItem = document.createElement('a');
    profileItem.href = `/profile.html?u=${encodeURIComponent(user.username)}`;
    profileItem.className = 'dropdown-item';
    profileItem.appendChild(icon('user', { size: 16 }));
    const profSpan = document.createElement('span');
    profSpan.textContent = 'Your profile';
    profileItem.appendChild(profSpan);
    menu.appendChild(profileItem);

    // Settings link
    const settingsItem = document.createElement('a');
    settingsItem.href = '/settings.html';
    settingsItem.className = 'dropdown-item';
    settingsItem.appendChild(icon('settings', { size: 16 }));
    const setSpan = document.createElement('span');
    setSpan.textContent = 'Settings';
    settingsItem.appendChild(setSpan);
    menu.appendChild(settingsItem);

    // Keyboard Shortcuts item
    const shortcutsItem = document.createElement('button');
    shortcutsItem.type = 'button';
    shortcutsItem.className = 'dropdown-item';
    shortcutsItem.appendChild(icon('info', { size: 16 }));
    const scSpan = document.createElement('span');
    scSpan.textContent = 'Shortcuts (?)';
    shortcutsItem.appendChild(scSpan);
    shortcutsItem.onclick = () => {
      dropdown.classList.remove('open');
      avatarBtn.setAttribute('aria-expanded', 'false');
      openShortcutsModal();
    };
    menu.appendChild(shortcutsItem);

    // Divider
    const hr = document.createElement('div');
    hr.style.borderTop = '1px solid var(--color-sand)';
    hr.style.margin = '4px 0';
    menu.appendChild(hr);

    // Logout
    const logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.className = 'dropdown-item danger';
    logoutBtn.appendChild(icon('logout', { size: 16 }));
    const loSpan = document.createElement('span');
    loSpan.textContent = 'Log out';
    logoutBtn.appendChild(loSpan);
    logoutBtn.onclick = async () => {
      try {
        await logout();
      } catch {
        // Continue redirect
      }
      window.location.replace('/auth.html');
    };
    menu.appendChild(logoutBtn);

    dropdown.appendChild(menu);

    avatarBtn.onclick = (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.toggle('open');
      avatarBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    };

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
        avatarBtn.setAttribute('aria-expanded', 'false');
      }
    });

    actions.appendChild(dropdown);
  }

  nav.appendChild(actions);
  header.appendChild(nav);
}

function buildMobileTabBar(activeTab, user) {
  let tabNav = document.querySelector('.tab-bar-mobile');
  if (!tabNav) {
    tabNav = document.createElement('nav');
    tabNav.className = 'tab-bar-mobile';
    tabNav.setAttribute('aria-label', 'Mobile Navigation');
    document.body.appendChild(tabNav);
  }

  tabNav.innerHTML = '';

  const tabs = [
    { id: 'home', label: 'Home', href: '/home.html', iconName: 'home' },
    { id: 'library', label: 'Library', href: '/library.html', iconName: 'library' },
    { id: 'create', label: 'Create', href: '/moment-new.html', iconName: 'plus' },
    { id: 'albums', label: 'Albums', href: '/albums.html', iconName: 'album' },
    {
      id: 'profile',
      label: 'Profile',
      href: user ? `/profile.html?u=${encodeURIComponent(user.username)}` : '/auth.html',
      iconName: 'user'
    }
  ];

  tabs.forEach((t) => {
    const a = document.createElement('a');
    a.href = t.href;
    a.className = 'tab-bar-item';
    if (activeTab === t.id) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
    a.appendChild(icon(t.iconName, { size: 22 }));
    const span = document.createElement('span');
    span.textContent = t.label;
    a.appendChild(span);
    tabNav.appendChild(a);
  });
}

function initNavbarSearch(input, dropdown) {
  let debounceTimer = null;

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (debounceTimer) clearTimeout(debounceTimer);

    if (q.length < 2) {
      dropdown.classList.remove('open');
      dropdown.innerHTML = '';
      return;
    }

    debounceTimer = setTimeout(async () => {
      if (currentSearchAbort) {
        currentSearchAbort.abort();
      }
      currentSearchAbort = new AbortController();

      dropdown.innerHTML = '<div style="padding: 12px; font-size: var(--text-xs); color: var(--color-stone); text-align: center;">Searching...</div>';
      dropdown.classList.add('open');

      try {
        const res = await searchUsers({ q, limit: 6 }, { signal: currentSearchAbort.signal });
        dropdown.innerHTML = '';
        const items = res.items || [];

        if (items.length === 0) {
          dropdown.innerHTML = '<div style="padding: 12px; font-size: var(--text-xs); color: var(--color-stone); text-align: center;">No people found</div>';
          return;
        }

        items.forEach((u) => {
          const row = document.createElement('a');
          row.href = `/profile.html?u=${encodeURIComponent(u.username)}`;
          row.className = 'search-result-row';

          const av = buildAvatar(u, 'xs');
          row.appendChild(av);

          const textWrap = document.createElement('div');
          textWrap.style.overflow = 'hidden';

          const dName = document.createElement('div');
          dName.style.fontSize = 'var(--text-xs)';
          dName.style.fontWeight = '600';
          dName.textContent = u.displayName || u.username;
          textWrap.appendChild(dName);

          const uName = document.createElement('div');
          uName.style.fontSize = '11px';
          uName.style.color = 'var(--color-stone)';
          uName.textContent = `@${u.username}`;
          textWrap.appendChild(uName);

          row.appendChild(textWrap);
          dropdown.appendChild(row);
        });

        // "View all results" link
        const allLink = document.createElement('a');
        allLink.href = `/explore.html?q=${encodeURIComponent(q)}`;
        allLink.style.display = 'block';
        allLink.style.padding = '8px 10px';
        allLink.style.fontSize = 'var(--text-xs)';
        allLink.style.color = 'var(--color-teal)';
        allLink.style.fontWeight = '600';
        allLink.style.textAlign = 'center';
        allLink.style.borderTop = '1px solid var(--color-sand)';
        allLink.textContent = `View all results for "${q}"`;
        dropdown.appendChild(allLink);
      } catch (err) {
        if (err.name === 'AbortError') return;
        dropdown.innerHTML = '<div style="padding: 12px; font-size: var(--text-xs); color: var(--color-brick); text-align: center;">Search failed</div>';
      }
    }, 300);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      if (q) {
        window.location.href = `/explore.html?q=${encodeURIComponent(q)}`;
      }
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('open');
      input.blur();
    }
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });
}

// ============================================================================
// Notifications Drawer
// ============================================================================
let notificationsPage = 1;
let notificationsHasMore = false;
let notificationsLoading = false;

function initNotificationsDrawer() {
  if (document.getElementById('notifications-drawer')) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'notifications-drawer';
  backdrop.className = 'drawer-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');

  const panel = document.createElement('div');
  panel.className = 'drawer-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Notifications');

  // Header
  const header = document.createElement('div');
  header.className = 'drawer-header';

  const titleWrap = document.createElement('div');
  titleWrap.style.display = 'flex';
  titleWrap.style.alignItems = 'center';
  titleWrap.style.gap = 'var(--space-xs)';

  const title = document.createElement('h3');
  title.style.fontSize = 'var(--text-lg)';
  title.textContent = 'Notifications';
  titleWrap.appendChild(title);
  header.appendChild(titleWrap);

  const headerActions = document.createElement('div');
  headerActions.style.display = 'flex';
  headerActions.style.gap = 'var(--space-xs)';
  headerActions.style.alignItems = 'center';

  const markAllBtn = document.createElement('button');
  markAllBtn.className = 'btn btn-ghost btn-sm';
  markAllBtn.textContent = 'Mark all read';
  markAllBtn.onclick = async () => {
    try {
      await markAllNotificationsRead();
      document.querySelectorAll('.notification-unread-dot').forEach((d) => d.remove());
      updateUnreadBadge(0);
      showToast('All notifications marked as read', 'success', 2000);
    } catch (e) {
      showToast('Failed to mark notifications read: ' + e.message, 'error');
    }
  };
  headerActions.appendChild(markAllBtn);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn-icon';
  closeBtn.setAttribute('aria-label', 'Close notifications');
  closeBtn.appendChild(icon('close', { size: 20 }));
  closeBtn.onclick = () => closeNotificationsDrawer();
  headerActions.appendChild(closeBtn);

  header.appendChild(headerActions);
  panel.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'drawer-body';
  body.id = 'notifications-drawer-body';
  panel.appendChild(body);

  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);

  backdrop.onclick = (e) => {
    if (e.target === backdrop) closeNotificationsDrawer();
  };
}

export function openNotificationsDrawer() {
  const backdrop = document.getElementById('notifications-drawer');
  if (!backdrop) return;

  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  const panel = backdrop.querySelector('.drawer-panel');
  const cleanupTrap = setupFocusTrap(panel, closeNotificationsDrawer);
  backdrop._cleanupTrap = cleanupTrap;

  loadNotificationsList(true);
}

export function closeNotificationsDrawer() {
  const backdrop = document.getElementById('notifications-drawer');
  if (!backdrop) return;

  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';

  if (backdrop._cleanupTrap) {
    backdrop._cleanupTrap();
    delete backdrop._cleanupTrap;
  }
}

async function loadNotificationsList(reset = false) {
  const body = document.getElementById('notifications-drawer-body');
  if (!body) return;

  if (reset) {
    notificationsPage = 1;
    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
        <div class="skeleton" style="height: 64px; border-radius: var(--radius-md);"></div>
        <div class="skeleton" style="height: 64px; border-radius: var(--radius-md);"></div>
        <div class="skeleton" style="height: 64px; border-radius: var(--radius-md);"></div>
      </div>
    `;
  }

  notificationsLoading = true;
  try {
    const res = await getNotifications({ page: notificationsPage, limit: 20 });
    notificationsLoading = false;
    const items = res.items || [];
    notificationsHasMore = !!res.hasMore;

    if (reset) body.innerHTML = '';

    if (items.length === 0 && reset) {
      body.innerHTML = `
        <div class="empty-state" style="padding: var(--space-3xl) var(--space-md); text-align: center;">
          <img src="/assets/stickers/bookmark.svg" width="56" height="56" alt="No notifications" style="margin-bottom: var(--space-md);">
          <h4 style="font-size: var(--text-md); margin-bottom: var(--space-2xs);">All quiet for now</h4>
          <p class="text-muted" style="font-size: var(--text-sm);">When friends interact with your moments, you will see updates here.</p>
        </div>
      `;
      return;
    }

    items.forEach((n) => {
      const card = renderNotificationCard(n);
      body.appendChild(card);
    });

    if (notificationsHasMore) {
      const loadMoreBtn = document.createElement('button');
      loadMoreBtn.className = 'btn btn-sand btn-sm';
      loadMoreBtn.style.width = '100%';
      loadMoreBtn.style.marginTop = 'var(--space-md)';
      loadMoreBtn.textContent = 'Load earlier';
      loadMoreBtn.onclick = () => {
        loadMoreBtn.remove();
        notificationsPage++;
        loadNotificationsList(false);
      };
      body.appendChild(loadMoreBtn);
    }
  } catch (err) {
    notificationsLoading = false;
    body.innerHTML = `
      <div style="padding: var(--space-xl); text-align: center;">
        <p style="color: var(--color-brick); font-size: var(--text-sm); margin-bottom: var(--space-md);">Failed to load notifications: ${err.message}</p>
        <button id="retry-notifs-btn" class="btn btn-sand btn-sm">Retry</button>
      </div>
    `;
    const retryBtn = document.getElementById('retry-notifs-btn');
    if (retryBtn) retryBtn.onclick = () => loadNotificationsList(true);
  }
}

function renderNotificationCard(n) {
  const card = document.createElement('div');
  card.className = 'notification-item';
  if (!n.read) card.classList.add('unread');

  // Type Icon
  let iconName = 'bell';
  let iconColor = 'var(--color-ink)';
  if (n.type === 'like') {
    iconName = 'heart-filled';
    iconColor = 'var(--color-terracotta)';
  } else if (n.type === 'comment') {
    iconName = 'comment';
    iconColor = 'var(--color-teal)';
  } else if (n.type === 'follow') {
    iconName = 'user';
    iconColor = 'var(--color-slate)';
  }

  const iconEl = icon(iconName, { size: 20 });
  iconEl.style.color = iconColor;
  iconEl.style.flexShrink = '0';
  card.appendChild(iconEl);

  // Actor Avatar if present
  const actor = n.actor || n.from;
  if (actor) {
    const av = buildAvatar(actor, 'xs');
    card.appendChild(av);
  }

  // Text Content
  const textContainer = document.createElement('div');
  textContainer.style.flex = '1';
  textContainer.style.fontSize = 'var(--text-xs)';
  textContainer.style.lineHeight = '1.4';

  const sentence = document.createElement('div');
  const actorName = actor?.displayName || actor?.username || 'Someone';
  let message = `${actorName} interacted with you`;
  if (n.type === 'like') message = `${actorName} liked your moment`;
  else if (n.type === 'comment') message = `${actorName} commented on your moment`;
  else if (n.type === 'follow') message = `${actorName} started following you`;

  sentence.textContent = message;
  textContainer.appendChild(sentence);

  const time = document.createElement('div');
  time.style.color = 'var(--color-stone)';
  time.style.fontSize = '11px';
  time.style.marginTop = '2px';
  time.textContent = formatTimeAgo(n.createdAt);
  textContainer.appendChild(time);

  card.appendChild(textContainer);

  // Unread Dot
  if (!n.read) {
    const dot = document.createElement('div');
    dot.className = 'notification-unread-dot';
    card.appendChild(dot);
  }

  // Click handler: mark as read, close drawer, navigate
  card.style.cursor = 'pointer';
  card.onclick = async () => {
    if (!n.read) {
      try {
        await markNotificationRead(n.id || n._id);
        n.read = true;
        card.classList.remove('unread');
        card.querySelector('.notification-unread-dot')?.remove();
        decrementUnreadBadge();
      } catch {
        // Silently continue navigation
      }
    }

    closeNotificationsDrawer();
    if (n.moment) {
      const momentId = typeof n.moment === 'object' ? (n.moment.id || n.moment._id) : n.moment;
      window.location.href = `/moment.html?id=${momentId}#comments`;
    } else if (n.actor?.username) {
      window.location.href = `/profile.html?u=${encodeURIComponent(n.actor.username)}`;
    }
  };

  return card;
}

// Notifications Polling
function startNotificationsPolling() {
  if (notificationsPollTimer) clearInterval(notificationsPollTimer);

  const checkUnread = async () => {
    if (document.hidden) return;

    try {
      const res = await getUnreadNotificationCount();
      consecutivePollErrors = 0;
      pollInterval = 30000;
      updateUnreadBadge(res.count || 0);
    } catch {
      consecutivePollErrors++;
      // Back off poll interval: 30s -> 60s -> 120s up to 300s
      pollInterval = Math.min(30000 * Math.pow(2, consecutivePollErrors), 300000);
      restartPollWithInterval();
    }
  };

  const restartPollWithInterval = () => {
    if (notificationsPollTimer) clearInterval(notificationsPollTimer);
    notificationsPollTimer = setInterval(checkUnread, pollInterval);
  };

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      checkUnread();
    }
  });

  checkUnread();
  notificationsPollTimer = setInterval(checkUnread, pollInterval);
}

function updateUnreadBadge(count) {
  const badge = document.getElementById('shell-unread-badge');
  if (!badge) return;

  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
    badge.textContent = '0';
  }
}

function decrementUnreadBadge() {
  const badge = document.getElementById('shell-unread-badge');
  if (!badge) return;
  const current = parseInt(badge.textContent, 10) || 0;
  if (current > 1) {
    badge.textContent = String(current - 1);
  } else {
    badge.style.display = 'none';
    badge.textContent = '0';
  }
}

// ============================================================================
// Keyboard Shortcuts & Help Modal
// ============================================================================
function initKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    const target = e.target;
    const isEditing = target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    );

    if (isEditing) {
      if (e.key === 'Escape') {
        target.blur();
      }
      return;
    }

    if (e.key === 'Escape') {
      closeNotificationsDrawer();
      closeShortcutsModal();
      return;
    }

    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      e.preventDefault();
      openShortcutsModal();
      return;
    }

    if (e.key === '/') {
      e.preventDefault();
      const search = document.querySelector('.navbar-search-input');
      if (search) search.focus();
      return;
    }

    if (e.key === 'n' || e.key === 'N') {
      window.location.href = '/moment-new.html';
      return;
    }

    if (e.key === 'u' || e.key === 'U') {
      window.location.href = '/library.html?upload=1';
      return;
    }

    // Sequence "g" then "h", "l", "c", "a", "e", "p"
    const now = Date.now();
    if (e.key === 'g' || e.key === 'G') {
      gKeyPressedTime = now;
      return;
    }

    if (now - gKeyPressedTime < 800) {
      const key = e.key.toLowerCase();
      if (key === 'h') {
        window.location.href = '/home.html';
      } else if (key === 'l') {
        window.location.href = '/library.html';
      } else if (key === 'c') {
        window.location.href = '/moment-new.html';
      } else if (key === 'a') {
        window.location.href = '/albums.html';
      } else if (key === 'e') {
        window.location.href = '/explore.html';
      } else if (key === 'p') {
        window.location.href = '/profile.html';
      }
      gKeyPressedTime = 0;
    }
  });
}

function openShortcutsModal() {
  let modalBackdrop = document.getElementById('shortcuts-modal');
  if (!modalBackdrop) {
    modalBackdrop = document.createElement('div');
    modalBackdrop.id = 'shortcuts-modal';
    modalBackdrop.className = 'modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.maxWidth = '480px';

    modal.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">Keyboard Shortcuts</h3>
        <button class="btn-icon" data-close-modal aria-label="Close shortcuts">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body" style="padding: var(--space-md) var(--space-xl);">
        <table style="width: 100%; border-collapse: collapse; font-size: var(--text-sm);">
          <tbody>
            <tr style="border-bottom: 1px solid var(--color-sand);"><td style="padding: 8px 0; font-weight: 500;">New moment</td><td style="text-align: right;"><kbd class="badge badge-stone">N</kbd></td></tr>
            <tr style="border-bottom: 1px solid var(--color-sand);"><td style="padding: 8px 0; font-weight: 500;">Upload to library</td><td style="text-align: right;"><kbd class="badge badge-stone">U</kbd></td></tr>
            <tr style="border-bottom: 1px solid var(--color-sand);"><td style="padding: 8px 0; font-weight: 500;">Search people</td><td style="text-align: right;"><kbd class="badge badge-stone">/</kbd></td></tr>
            <tr style="border-bottom: 1px solid var(--color-sand);"><td style="padding: 8px 0; font-weight: 500;">Go to Home</td><td style="text-align: right;"><kbd class="badge badge-stone">G</kbd> then <kbd class="badge badge-stone">H</kbd></td></tr>
            <tr style="border-bottom: 1px solid var(--color-sand);"><td style="padding: 8px 0; font-weight: 500;">Go to Library</td><td style="text-align: right;"><kbd class="badge badge-stone">G</kbd> then <kbd class="badge badge-stone">L</kbd></td></tr>
            <tr style="border-bottom: 1px solid var(--color-sand);"><td style="padding: 8px 0; font-weight: 500;">Go to Create Moment</td><td style="text-align: right;"><kbd class="badge badge-stone">G</kbd> then <kbd class="badge badge-stone">C</kbd></td></tr>
            <tr style="border-bottom: 1px solid var(--color-sand);"><td style="padding: 8px 0; font-weight: 500;">Go to Albums</td><td style="text-align: right;"><kbd class="badge badge-stone">G</kbd> then <kbd class="badge badge-stone">A</kbd></td></tr>
            <tr style="border-bottom: 1px solid var(--color-sand);"><td style="padding: 8px 0; font-weight: 500;">Go to Explore</td><td style="text-align: right;"><kbd class="badge badge-stone">G</kbd> then <kbd class="badge badge-stone">E</kbd></td></tr>
            <tr style="border-bottom: 1px solid var(--color-sand);"><td style="padding: 8px 0; font-weight: 500;">Go to Profile</td><td style="text-align: right;"><kbd class="badge badge-stone">G</kbd> then <kbd class="badge badge-stone">P</kbd></td></tr>
            <tr style="border-bottom: 1px solid var(--color-sand);"><td style="padding: 8px 0; font-weight: 500;">Close overlays</td><td style="text-align: right;"><kbd class="badge badge-stone">Esc</kbd></td></tr>
            <tr><td style="padding: 8px 0; font-weight: 500;">Keyboard help</td><td style="text-align: right;"><kbd class="badge badge-stone">?</kbd></td></tr>
          </tbody>
        </table>
      </div>
      <div class="modal-footer">
        <button class="btn btn-sand btn-sm" data-close-modal>Close</button>
      </div>
    `;

    document.body.appendChild(modalBackdrop);

    modalBackdrop.querySelectorAll('[data-close-modal]').forEach((b) => {
      b.onclick = () => closeShortcutsModal();
    });

    modalBackdrop.onclick = (e) => {
      if (e.target === modalBackdrop) closeShortcutsModal();
    };
  }

  modalBackdrop.classList.add('open');
  modalBackdrop.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  const modal = modalBackdrop.querySelector('.modal');
  const cleanupTrap = setupFocusTrap(modal, closeShortcutsModal);
  modalBackdrop._cleanupTrap = cleanupTrap;
}

function closeShortcutsModal() {
  const modalBackdrop = document.getElementById('shortcuts-modal');
  if (!modalBackdrop) return;

  modalBackdrop.classList.remove('open');
  modalBackdrop.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';

  if (modalBackdrop._cleanupTrap) {
    modalBackdrop._cleanupTrap();
    delete modalBackdrop._cleanupTrap;
  }
}

// ============================================================================
// Welcome Card Helper
// ============================================================================
export function renderWelcomeCard(container) {
  if (!container) return;

  try {
    const dismissed = localStorage.getItem('keepsake_welcome_dismissed');
    if (dismissed) return;
  } catch {
    // LocalStorage blocked
  }

  const card = document.createElement('div');
  card.className = 'welcome-card';

  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-md);">
      <div>
        <span class="section-tag" style="font-size: var(--text-sm);">Welcome to Keepsake</span>
        <h3 style="font-size: var(--text-xl); margin-bottom: var(--space-2xs);">Start preserving your memories</h3>
        <p class="text-muted" style="font-size: var(--text-sm); max-width: 60ch;">A quiet, intentional home for your photos, videos, and stories. Here are three simple steps to begin:</p>
      </div>
      <button class="btn-icon" id="btn-dismiss-welcome" aria-label="Dismiss welcome message" style="color: var(--color-stone);">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="welcome-steps">
      <a href="/library.html?upload=1" class="welcome-step">
        <div style="color: var(--color-terracotta);">${icon('upload', { size: 24 }).outerHTML}</div>
        <div>
          <div style="font-weight: 600; font-size: var(--text-sm);">1. Upload Media</div>
          <div style="font-size: var(--text-xs); color: var(--color-stone);">Add personal photos and videos to your private Library.</div>
        </div>
      </a>
      <a href="/moment-new.html" class="welcome-step">
        <div style="color: var(--color-teal);">${icon('collage', { size: 24 }).outerHTML}</div>
        <div>
          <div style="font-weight: 600; font-size: var(--text-sm);">2. Compose a Moment</div>
          <div style="font-size: var(--text-xs); color: var(--color-stone);">Craft a collage or carousel to share with friends.</div>
        </div>
      </a>
      <a href="/albums.html?create=1" class="welcome-step">
        <div style="color: var(--color-mustard);">${icon('album', { size: 24 }).outerHTML}</div>
        <div>
          <div style="font-weight: 600; font-size: var(--text-sm);">3. Create an Album</div>
          <div style="font-size: var(--text-xs); color: var(--color-stone);">Curate themed collections and share private web links.</div>
        </div>
      </a>
    </div>
  `;

  const dismissBtn = card.querySelector('#btn-dismiss-welcome');
  if (dismissBtn) {
    dismissBtn.onclick = () => {
      try {
        localStorage.setItem('keepsake_welcome_dismissed', 'true');
      } catch {}
      card.remove();
    };
  }

  container.prepend(card);
}

