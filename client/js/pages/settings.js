// Keepsake Settings Page Controller
import { requireAuth } from '../guard.js';
import { mountAppShell } from '../shell.js';
import { updateMe, getMyStorage, logout } from '../api.js';
import { showToast, buildAvatar } from '../ui.js';

let currentUser = null;
let selectedAvatarFile = null;
let removeAvatarRequested = false;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    currentUser = await requireAuth();
  } catch {
    return;
  }

  mountAppShell({ activeTab: 'settings', user: currentUser, pageTitle: 'Account Settings' });

  initProfileForm();
  loadStorageInfo();
  initLogout();
});

function initProfileForm() {
  const form = document.getElementById('form-settings-profile');
  const uInput = document.getElementById('settings-username');
  const eInput = document.getElementById('settings-email');
  const dInput = document.getElementById('settings-display-name');
  const bioInput = document.getElementById('settings-bio');
  const bioCount = document.getElementById('settings-bio-count');
  const fileInput = document.getElementById('settings-avatar-file');
  const removeAvatarBtn = document.getElementById('btn-settings-remove-avatar');
  const submitBtn = document.getElementById('btn-save-settings');

  if (uInput) uInput.value = currentUser.username;
  if (eInput) eInput.value = currentUser.email || '';
  if (dInput) dInput.value = currentUser.displayName || '';
  if (bioInput) {
    bioInput.value = currentUser.bio || '';
    if (bioCount) bioCount.textContent = `${bioInput.value.length}/160`;
    bioInput.oninput = () => {
      if (bioCount) bioCount.textContent = `${bioInput.value.length}/160`;
    };
  }

  renderAvatarPreview();

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
      const displayName = dInput.value.trim();
      const bio = bioInput.value.trim();

      const formData = new FormData();
      if (displayName) formData.append('displayName', displayName);
      formData.append('bio', bio);

      if (selectedAvatarFile) {
        formData.append('avatar', selectedAvatarFile);
      } else if (removeAvatarRequested) {
        formData.append('removeAvatar', 'true');
      }

      if (submitBtn) submitBtn.disabled = true;
      try {
        const res = await updateMe(formData);
        currentUser = res.user;
        selectedAvatarFile = null;
        removeAvatarRequested = false;
        renderAvatarPreview();
        showToast('Settings saved successfully!');
      } catch (err) {
        showToast(err.message || 'Failed to update settings', 'error');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    };
  }
}

function renderAvatarPreview(src = null) {
  const mount = document.getElementById('settings-avatar-wrap');
  const removeBtn = document.getElementById('btn-settings-remove-avatar');
  if (!mount) return;
  mount.innerHTML = '';

  if (src) {
    const img = document.createElement('img');
    img.src = src;
    img.style.width = '64px';
    img.style.height = '64px';
    img.style.borderRadius = 'var(--radius-full)';
    img.style.objectFit = 'cover';
    mount.appendChild(img);
    if (removeBtn) removeBtn.style.display = 'inline-block';
  } else if (currentUser.avatarUrl && !removeAvatarRequested) {
    const av = buildAvatar(currentUser, 'lg');
    av.style.width = '64px';
    av.style.height = '64px';
    mount.appendChild(av);
    if (removeBtn) removeBtn.style.display = 'inline-block';
  } else {
    const av = buildAvatar({ username: currentUser.username, avatarUrl: null }, 'lg');
    av.style.width = '64px';
    av.style.height = '64px';
    mount.appendChild(av);
    if (removeBtn) removeBtn.style.display = 'none';
  }
}

async function loadStorageInfo() {
  const sumEl = document.getElementById('storage-summary-text');
  const pctEl = document.getElementById('storage-percent-text');
  const fillEl = document.getElementById('storage-progress-fill');
  const countsEl = document.getElementById('storage-breakdown-counts');

  try {
    const data = await getMyStorage();
    const usedMB = (data.usedBytes / (1024 * 1024)).toFixed(1);
    const quotaMB = Math.round(data.quotaBytes / (1024 * 1024));
    const percent = Math.min(100, Math.max(0, data.percent || 0));

    if (sumEl) sumEl.textContent = `${usedMB} MB of ${quotaMB} MB used`;
    if (pctEl) pctEl.textContent = `${percent}%`;
    if (fillEl) fillEl.style.width = `${percent}%`;

    const imgCount = data.counts?.images || 0;
    const vidCount = data.counts?.videos || 0;
    if (countsEl) {
      countsEl.textContent = `${imgCount} ${imgCount === 1 ? 'photo' : 'photos'} · ${vidCount} ${vidCount === 1 ? 'video' : 'videos'}`;
    }
  } catch {
    if (sumEl) sumEl.textContent = 'Storage information unavailable';
  }
}

function initLogout() {
  const btn = document.getElementById('btn-settings-logout');
  if (!btn) return;

  btn.onclick = async () => {
    try {
      await logout();
      showToast('Logged out successfully');
      window.location.href = '/auth.html';
    } catch {
      window.location.href = '/auth.html';
    }
  };
}

