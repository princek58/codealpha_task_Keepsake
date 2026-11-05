// Keepsake User Profile Page Controller
import { getMe, getUserProfile, getUserMoments, getUserAlbums, getUserFollowers, getUserFollowing, toggleFollowUser, updateMe } from '../api.js';
import { mountAppShell } from '../shell.js';
import { icon } from '../icons.js';
import { showToast, buildAvatar, formatDate, setupFocusTrap } from '../ui.js';

let currentUser = null;
let profileUser = null;
let targetUsername = null;
let currentTab = 'moments';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const meRes = await getMe();
    currentUser = meRes.user;
  } catch {
    currentUser = null;
  }

  const params = new URLSearchParams(window.location.search);
  targetUsername = params.get('u');

  if (!targetUsername && currentUser) {
    targetUsername = currentUser.username;
  }

  if (!targetUsername) {
    showError('No User Specified', 'Please specify a username to view their profile.');
    return;
  }

  const isSelf = currentUser && currentUser.username.toLowerCase() === targetUsername.toLowerCase();
  mountAppShell({
    activeTab: isSelf ? 'profile' : 'explore',
    user: currentUser,
    pageTitle: targetUsername
  });

  initTabs();
  initEditProfileModal();
  await loadProfile();
});

async function loadProfile() {
  const skeleton = document.getElementById('profile-skeleton');
  const errorEl = document.getElementById('profile-error');
  const content = document.getElementById('profile-content');

  try {
    const res = await getUserProfile(targetUsername);
    profileUser = res.user;

    if (skeleton) skeleton.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
    if (content) content.style.display = 'block';

    renderProfileHeader();
    await switchTab(currentTab);
  } catch (err) {
    if (skeleton) skeleton.style.display = 'none';
    const msg = err.status === 404 ? `The user @${targetUsername} does not exist.` : (err.message || 'Failed to load profile.');
    showError('User Not Found', msg);
  }
}

function showError(title, desc) {
  const skeleton = document.getElementById('profile-skeleton');
  const errorEl = document.getElementById('profile-error');
  const content = document.getElementById('profile-content');
  const errorTitle = document.getElementById('profile-error-title');
  const errorDesc = document.getElementById('profile-error-desc');

  if (skeleton) skeleton.style.display = 'none';
  if (content) content.style.display = 'none';
  if (errorTitle) errorTitle.textContent = title;
  if (errorDesc) errorDesc.textContent = desc;
  if (errorEl) errorEl.style.display = 'block';
}

function renderProfileHeader() {
  if (!profileUser) return;
  const u = profileUser;
  const isMe = profileUser.isMe || (currentUser && currentUser.username.toLowerCase() === u.username.toLowerCase());

  document.title = `${u.displayName || u.username} (@${u.username}) — Keepsake`;

  const dNameEl = document.getElementById('profile-display-name');
  if (dNameEl) dNameEl.textContent = u.displayName || u.username;

  const uNameEl = document.getElementById('profile-username');
  if (uNameEl) uNameEl.textContent = `@${u.username}`;

  const joinedEl = document.getElementById('profile-joined');
  if (joinedEl && u.createdAt) {
    const d = new Date(u.createdAt);
    const month = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    joinedEl.textContent = `Joined ${month}`;
  }

  const bioEl = document.getElementById('profile-bio');
  if (bioEl) {
    if (u.bio) {
      bioEl.textContent = u.bio;
      bioEl.style.display = 'block';
    } else {
      bioEl.style.display = 'none';
    }
  }

  // Avatar
  const avatarMount = document.getElementById('profile-avatar-mount');
  if (avatarMount) {
    avatarMount.innerHTML = '';
    const av = buildAvatar(u, 'xl');
    av.style.width = '84px';
    av.style.height = '84px';
    avatarMount.appendChild(av);
  }

  // Counters
  const mCount = document.getElementById('stat-moments-count');
  if (mCount) mCount.textContent = String(u.momentsCount || 0);

  const aCount = document.getElementById('stat-albums-count');
  if (aCount) aCount.textContent = String(u.albumsCount || 0);

  const fCount = document.getElementById('stat-followers-count');
  if (fCount) fCount.textContent = String(u.followersCount || 0);

  const fgCount = document.getElementById('stat-following-count');
  if (fgCount) fgCount.textContent = String(u.followingCount || 0);

  // Tab badge counts
  const tbM = document.getElementById('tab-badge-moments');
  if (tbM) tbM.textContent = String(u.momentsCount || 0);

  const tbA = document.getElementById('tab-badge-albums');
  if (tbA) tbA.textContent = String(u.albumsCount || 0);

  const tbF = document.getElementById('tab-badge-followers');
  if (tbF) tbF.textContent = String(u.followersCount || 0);

  const tbFg = document.getElementById('tab-badge-following');
  if (tbFg) tbFg.textContent = String(u.followingCount || 0);

  // Action button (Edit profile vs Follow)
  const actionMount = document.getElementById('profile-action-mount');
  if (actionMount) {
    actionMount.innerHTML = '';

    if (isMe) {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-sand btn-sm';
      editBtn.textContent = 'Edit Profile';
      editBtn.onclick = () => openEditProfileModal();
      actionMount.appendChild(editBtn);
    } else if (currentUser) {
      const followBtn = document.createElement('button');
      let isFollowing = Boolean(u.isFollowing);
      followBtn.className = isFollowing ? 'btn btn-sand btn-sm' : 'btn btn-primary btn-sm';
      followBtn.textContent = isFollowing ? 'Following' : 'Follow';
      followBtn.onclick = async () => {
        try {
          isFollowing = !isFollowing;
          followBtn.className = isFollowing ? 'btn btn-sand btn-sm' : 'btn btn-primary btn-sm';
          followBtn.textContent = isFollowing ? 'Following' : 'Follow';
          u.followersCount += isFollowing ? 1 : -1;
          if (fCount) fCount.textContent = String(u.followersCount);
          if (tbF) tbF.textContent = String(u.followersCount);
          await toggleFollowUser(u.id);
        } catch {
          isFollowing = !isFollowing;
          followBtn.className = isFollowing ? 'btn btn-sand btn-sm' : 'btn btn-primary btn-sm';
          followBtn.textContent = isFollowing ? 'Following' : 'Follow';
          u.followersCount += isFollowing ? 1 : -1;
          if (fCount) fCount.textContent = String(u.followersCount);
          if (tbF) tbF.textContent = String(u.followersCount);
          showToast('Failed to update follow status', 'error');
        }
      };
      actionMount.appendChild(followBtn);
    }
  }
}

// ============================================================================
// Tabs Handling
// ============================================================================
function initTabs() {
  const tabs = ['moments', 'albums', 'followers', 'following'];
  tabs.forEach((tab) => {
    const btn = document.getElementById(`tab-btn-${tab}`);
    const statBtn = document.getElementById(`stat-${tab}-btn`);
    if (btn) {
      btn.onclick = () => switchTab(tab);
    }
    if (statBtn) {
      statBtn.onclick = () => switchTab(tab);
    }
  });
}

async function switchTab(tab) {
  currentTab = tab;
  const tabs = ['moments', 'albums', 'followers', 'following'];

  tabs.forEach((t) => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const panel = document.getElementById(`panel-${t}`);
    if (btn) {
      btn.classList.toggle('active', t === tab);
      btn.setAttribute('aria-selected', String(t === tab));
    }
    if (panel) {
      panel.style.display = t === tab ? 'block' : 'none';
    }
  });

  if (tab === 'moments') await loadTabMoments();
  else if (tab === 'albums') await loadTabAlbums();
  else if (tab === 'followers') await loadTabFollowers();
  else if (tab === 'following') await loadTabFollowing();
}

async function loadTabMoments() {
  const grid = document.getElementById('moments-grid');
  const emptyEl = document.getElementById('moments-empty');
  if (!grid) return;
  grid.innerHTML = '<div class="skeleton" style="height: 180px; border-radius: var(--radius-md);"></div>';

  try {
    const res = await getUserMoments(targetUsername, 1, 40);
    const moments = res.items || [];
    grid.innerHTML = '';

    if (moments.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    moments.forEach((m) => {
      const card = document.createElement('a');
      card.href = `/moment.html?id=${m.id || m._id}`;
      card.className = 'card';
      card.style.textDecoration = 'none';
      card.style.color = 'inherit';
      card.style.overflow = 'hidden';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';

      const coverMedia = m.media?.[0];
      const thumbUrl = coverMedia?.urls?.thumb || coverMedia?.urls?.display;

      const imgWrap = document.createElement('div');
      imgWrap.style.position = 'relative';
      imgWrap.style.aspectRatio = '4/3';
      imgWrap.style.backgroundColor = 'var(--color-sand)';
      imgWrap.style.overflow = 'hidden';

      if (thumbUrl) {
        const img = document.createElement('img');
        img.src = thumbUrl;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.alt = m.title || 'Moment';
        img.loading = 'lazy';
        imgWrap.appendChild(img);
      }

      if (m.layout?.type) {
        const badge = document.createElement('span');
        badge.className = 'badge badge-sand';
        badge.style.position = 'absolute';
        badge.style.top = '6px';
        badge.style.left = '6px';
        badge.style.fontSize = '10px';
        badge.textContent = m.layout.type;
        imgWrap.appendChild(badge);
      }

      card.appendChild(imgWrap);

      const body = document.createElement('div');
      body.style.padding = 'var(--space-sm)';

      const title = document.createElement('div');
      title.style.fontSize = 'var(--text-sm)';
      title.style.fontWeight = '600';
      title.style.marginBottom = '4px';
      title.style.whiteSpace = 'nowrap';
      title.style.overflow = 'hidden';
      title.style.textOverflow = 'ellipsis';
      title.textContent = m.title || 'Untitled Moment';
      body.appendChild(title);

      const meta = document.createElement('div');
      meta.style.fontSize = '11px';
      meta.style.color = 'var(--color-stone)';
      meta.style.display = 'flex';
      meta.style.gap = 'var(--space-xs)';

      const likes = document.createElement('span');
      likes.textContent = `${m.likesCount || 0} likes`;
      meta.appendChild(likes);

      const comments = document.createElement('span');
      comments.textContent = `${m.commentsCount || 0} comments`;
      meta.appendChild(comments);

      body.appendChild(meta);
      card.appendChild(body);
      grid.appendChild(card);
    });
  } catch {
    grid.innerHTML = '';
    if (emptyEl) {
      emptyEl.textContent = 'Could not load moments.';
      emptyEl.style.display = 'block';
    }
  }
}

async function loadTabAlbums() {
  const grid = document.getElementById('albums-grid');
  const emptyEl = document.getElementById('albums-empty');
  if (!grid) return;
  grid.innerHTML = '<div class="skeleton" style="height: 180px; border-radius: var(--radius-md);"></div>';

  try {
    const res = await getUserAlbums(targetUsername, 1, 40);
    const albums = res.items || [];
    grid.innerHTML = '';

    if (albums.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    albums.forEach((a) => {
      const card = document.createElement('a');
      card.href = `/album.html?id=${a.id || a._id}`;
      card.className = 'card';
      card.style.textDecoration = 'none';
      card.style.color = 'inherit';
      card.style.overflow = 'hidden';

      const coverWrap = document.createElement('div');
      coverWrap.style.position = 'relative';
      coverWrap.style.aspectRatio = '4/3';
      coverWrap.style.backgroundColor = 'var(--color-sand)';

      const coverUrl = a.cover?.urls?.thumb || a.cover?.urls?.display;
      if (coverUrl) {
        const img = document.createElement('img');
        img.src = coverUrl;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.alt = a.title;
        img.loading = 'lazy';
        coverWrap.appendChild(img);
      }

      const countBadge = document.createElement('span');
      countBadge.className = 'badge badge-sand';
      countBadge.style.position = 'absolute';
      countBadge.style.bottom = '6px';
      countBadge.style.left = '6px';
      countBadge.style.fontSize = '10px';
      countBadge.textContent = `${a.mediaCount || 0} items`;
      coverWrap.appendChild(countBadge);
      card.appendChild(coverWrap);

      const body = document.createElement('div');
      body.style.padding = 'var(--space-sm)';

      const title = document.createElement('div');
      title.style.fontSize = 'var(--text-sm)';
      title.style.fontWeight = '600';
      title.style.whiteSpace = 'nowrap';
      title.style.overflow = 'hidden';
      title.style.textOverflow = 'ellipsis';
      title.textContent = a.title;
      body.appendChild(title);

      card.appendChild(body);
      grid.appendChild(card);
    });
  } catch {
    grid.innerHTML = '';
    if (emptyEl) {
      emptyEl.textContent = 'Could not load albums.';
      emptyEl.style.display = 'block';
    }
  }
}

async function loadTabFollowers() {
  const container = document.getElementById('followers-list');
  const emptyEl = document.getElementById('followers-empty');
  if (!container) return;
  container.innerHTML = '<div class="skeleton" style="height: 60px; margin-bottom: 8px;"></div>';

  try {
    const res = await getUserFollowers(targetUsername, 1, 50);
    const users = res.items || [];
    container.innerHTML = '';

    if (users.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    users.forEach((u) => {
      container.appendChild(renderUserRow(u));
    });
  } catch {
    container.innerHTML = '';
    if (emptyEl) {
      emptyEl.textContent = 'Could not load followers.';
      emptyEl.style.display = 'block';
    }
  }
}

async function loadTabFollowing() {
  const container = document.getElementById('following-list');
  const emptyEl = document.getElementById('following-empty');
  if (!container) return;
  container.innerHTML = '<div class="skeleton" style="height: 60px; margin-bottom: 8px;"></div>';

  try {
    const res = await getUserFollowing(targetUsername, 1, 50);
    const users = res.items || [];
    container.innerHTML = '';

    if (users.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    users.forEach((u) => {
      container.appendChild(renderUserRow(u));
    });
  } catch {
    container.innerHTML = '';
    if (emptyEl) {
      emptyEl.textContent = 'Could not load following list.';
      emptyEl.style.display = 'block';
    }
  }
}

function renderUserRow(user) {
  const row = document.createElement('div');
  row.className = 'user-list-row';

  const userLink = document.createElement('a');
  userLink.href = `/profile.html?u=${encodeURIComponent(user.username)}`;
  userLink.style.display = 'flex';
  userLink.style.alignItems = 'center';
  userLink.style.gap = 'var(--space-sm)';
  userLink.style.textDecoration = 'none';
  userLink.style.color = 'inherit';

  const av = buildAvatar(user, 'md');
  userLink.appendChild(av);

  const textWrap = document.createElement('div');
  const dName = document.createElement('div');
  dName.style.fontSize = 'var(--text-sm)';
  dName.style.fontWeight = '600';
  dName.textContent = user.displayName || user.username;
  textWrap.appendChild(dName);

  const uName = document.createElement('div');
  uName.style.fontSize = 'var(--text-xs)';
  uName.style.color = 'var(--color-stone)';
  uName.textContent = `@${user.username}`;
  textWrap.appendChild(uName);

  userLink.appendChild(textWrap);
  row.appendChild(userLink);

  const isMe = currentUser && (currentUser.id === user.id || currentUser.username === user.username);
  if (currentUser && !isMe) {
    const followBtn = document.createElement('button');
    let isFollowing = Boolean(user.isFollowing);
    followBtn.className = isFollowing ? 'btn btn-sand btn-sm' : 'btn btn-primary btn-sm';
    followBtn.textContent = isFollowing ? 'Following' : 'Follow';
    followBtn.onclick = async () => {
      try {
        isFollowing = !isFollowing;
        followBtn.className = isFollowing ? 'btn btn-sand btn-sm' : 'btn btn-primary btn-sm';
        followBtn.textContent = isFollowing ? 'Following' : 'Follow';
        await toggleFollowUser(user.id);
      } catch {
        isFollowing = !isFollowing;
        followBtn.className = isFollowing ? 'btn btn-sand btn-sm' : 'btn btn-primary btn-sm';
        followBtn.textContent = isFollowing ? 'Following' : 'Follow';
        showToast('Could not update follow', 'error');
      }
    };
    row.appendChild(followBtn);
  }

  return row;
}

// ============================================================================
// Edit Profile Modal
// ============================================================================
function initEditProfileModal() {
  const modal = document.getElementById('modal-edit-profile');
  const cancelBtn = document.getElementById('btn-cancel-profile-edit');
  const form = document.getElementById('form-edit-profile');
  const nameInput = document.getElementById('edit-display-name');
  const bioInput = document.getElementById('edit-bio');
  const bioCount = document.getElementById('edit-bio-count');
  const fileInput = document.getElementById('edit-avatar-file');
  const removeAvatarBtn = document.getElementById('btn-remove-avatar');
  const avatarPreviewWrap = document.getElementById('edit-avatar-preview-wrap');

  let removeAvatarRequested = false;
  let selectedAvatarFile = null;
  let cleanupFocusTrap = null;

  window.openEditProfileModal = () => {
    if (!modal || !currentUser) return;
    nameInput.value = currentUser.displayName || '';
    bioInput.value = currentUser.bio || '';
    bioCount.textContent = `${bioInput.value.length}/160`;
    removeAvatarRequested = false;
    selectedAvatarFile = null;

    renderAvatarPreview();
    modal.classList.add('open');
    nameInput.focus();
    cleanupFocusTrap = setupFocusTrap(modal);
  };

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    if (cleanupFocusTrap) {
      cleanupFocusTrap();
      cleanupFocusTrap = null;
    }
  }

  function renderAvatarPreview(src = null) {
    if (!avatarPreviewWrap) return;
    avatarPreviewWrap.innerHTML = '';

    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.style.width = '64px';
      img.style.height = '64px';
      img.style.borderRadius = 'var(--radius-full)';
      img.style.objectFit = 'cover';
      avatarPreviewWrap.appendChild(img);
      if (removeAvatarBtn) removeAvatarBtn.style.display = 'inline-block';
    } else if (currentUser.avatarUrl && !removeAvatarRequested) {
      const av = buildAvatar(currentUser, 'lg');
      av.style.width = '64px';
      av.style.height = '64px';
      avatarPreviewWrap.appendChild(av);
      if (removeAvatarBtn) removeAvatarBtn.style.display = 'inline-block';
    } else {
      const av = buildAvatar({ username: currentUser.username, avatarUrl: null }, 'lg');
      av.style.width = '64px';
      av.style.height = '64px';
      avatarPreviewWrap.appendChild(av);
      if (removeAvatarBtn) removeAvatarBtn.style.display = 'none';
    }
  }

  if (cancelBtn) cancelBtn.onclick = closeModal;

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  if (bioInput && bioCount) {
    bioInput.oninput = () => {
      bioCount.textContent = `${bioInput.value.length}/160`;
    };
  }

  if (fileInput) {
    fileInput.onchange = () => {
      const file = fileInput.files?.[0];
      if (file) {
        selectedAvatarFile = file;
        removeAvatarRequested = false;
        const reader = new FileReader();
        reader.onload = (e) => {
          renderAvatarPreview(e.target.result);
        };
        reader.readAsDataURL(file);
      }
    };
  }

  if (removeAvatarBtn) {
    removeAvatarBtn.onclick = () => {
      removeAvatarRequested = true;
      selectedAvatarFile = null;
      if (fileInput) fileInput.value = '';
      renderAvatarPreview(null);
    };
  }

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const displayName = nameInput.value.trim();
      const bio = bioInput.value.trim();

      const formData = new FormData();
      if (displayName) formData.append('displayName', displayName);
      formData.append('bio', bio);

      if (selectedAvatarFile) {
        formData.append('avatar', selectedAvatarFile);
      } else if (removeAvatarRequested) {
        formData.append('removeAvatar', 'true');
      }

      try {
        const res = await updateMe(formData);
        currentUser = res.user;
        profileUser.displayName = currentUser.displayName;
        profileUser.bio = currentUser.bio;
        profileUser.avatarUrl = currentUser.avatarUrl;

        showToast('Profile updated!');
        closeModal();
        renderProfileHeader();
      } catch (err) {
        showToast(err.message || 'Failed to update profile', 'error');
      }
    };
  }
}

