// Keepsake Album Detail & Management Controller
import { getMe, getAlbumById, updateAlbum, deleteAlbum, addAlbumMedia, removeAlbumMedia, createAlbumShareToken, deleteAlbumShareToken, getMediaLibrary } from '../api.js';
import { mountAppShell } from '../shell.js';
import { JustifiedGallery } from '../gallery.js';
import { openLightbox } from '../lightbox.js';
import { icon } from '../icons.js';
import { showToast, showConfirmDialog, buildAvatar, setupFocusTrap } from '../ui.js';

let currentUser = null;
let currentAlbum = null;
let albumMedia = [];
let albumId = null;
let galleryInstance = null;
let isSelectMode = false;
let selectedMediaIds = new Set();

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const meRes = await getMe();
    currentUser = meRes.user;
  } catch {
    currentUser = null;
  }

  mountAppShell({ activeTab: 'albums', user: currentUser, pageTitle: 'Album' });

  const params = new URLSearchParams(window.location.search);
  albumId = params.get('id');

  if (!albumId) {
    showError('No Album Specified', 'Please select an album from your albums page.');
    return;
  }

  initEditModal();
  initShareModal();
  initPickerModal();
  initSelectionBar();
  await loadAlbum();
});

async function loadAlbum() {
  const skeleton = document.getElementById('album-skeleton');
  const errorEl = document.getElementById('album-error');
  const content = document.getElementById('album-content');

  try {
    const res = await getAlbumById(albumId);
    currentAlbum = res.album;
    albumMedia = res.media?.items || [];

    if (skeleton) skeleton.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
    if (content) content.style.display = 'block';

    renderAlbumDetails();
    renderGallery();
  } catch (err) {
    if (skeleton) skeleton.style.display = 'none';
    const msg = err.status === 404 ? 'This album does not exist or you do not have permission to view it.' : (err.message || 'Failed to load album.');
    showError('Album Not Found', msg);
  }
}

function showError(title, desc) {
  const skeleton = document.getElementById('album-skeleton');
  const errorEl = document.getElementById('album-error');
  const errorTitle = document.getElementById('album-error-title');
  const errorDesc = document.getElementById('album-error-desc');
  const content = document.getElementById('album-content');

  if (skeleton) skeleton.style.display = 'none';
  if (content) content.style.display = 'none';
  if (errorTitle) errorTitle.textContent = title;
  if (errorDesc) errorDesc.textContent = desc;
  if (errorEl) errorEl.style.display = 'block';
}

function renderAlbumDetails() {
  if (!currentAlbum) return;
  const a = currentAlbum;
  const isOwner = currentUser && (currentUser.id === a.owner?.id || currentUser._id === a.owner?.id);

  document.title = `${a.title} — Keepsake`;

  const titleEl = document.getElementById('album-title');
  if (titleEl) titleEl.textContent = a.title;

  const descEl = document.getElementById('album-desc');
  if (descEl) {
    if (a.description) {
      descEl.textContent = a.description;
      descEl.style.display = 'block';
    } else {
      descEl.style.display = 'none';
    }
  }

  // Visibility & Shared badges
  const visBadge = document.getElementById('album-badge-vis');
  if (visBadge) {
    visBadge.textContent = a.visibility === 'public' ? 'Public' : (a.visibility === 'followers' ? 'Followers only' : 'Private');
  }

  const sharedBadge = document.getElementById('album-badge-shared');
  if (sharedBadge) {
    sharedBadge.style.display = a.shareToken ? 'inline-block' : 'none';
  }

  // Owner wrap
  const ownerWrap = document.getElementById('album-owner-wrap');
  if (ownerWrap) {
    ownerWrap.innerHTML = '';

    const authorLink = document.createElement('a');
    authorLink.href = `/profile.html?u=${encodeURIComponent(a.owner.username)}`;
    authorLink.style.display = 'flex';
    authorLink.style.alignItems = 'center';
    authorLink.style.gap = 'var(--space-xs)';
    authorLink.style.textDecoration = 'none';
    authorLink.style.color = 'inherit';

    const av = buildAvatar(a.owner, 'sm');
    authorLink.appendChild(av);

    const nameSpan = document.createElement('span');
    nameSpan.style.fontSize = 'var(--text-xs)';
    nameSpan.style.fontWeight = '600';
    nameSpan.textContent = a.owner.displayName || a.owner.username;
    authorLink.appendChild(nameSpan);

    const uSpan = document.createElement('span');
    uSpan.style.fontSize = '11px';
    uSpan.style.color = 'var(--color-stone)';
    uSpan.textContent = `@${a.owner.username}`;
    authorLink.appendChild(uSpan);

    ownerWrap.appendChild(authorLink);

    const countSpan = document.createElement('span');
    countSpan.className = 'badge badge-sand';
    countSpan.style.fontSize = '11px';
    countSpan.textContent = `${albumMedia.length} ${albumMedia.length === 1 ? 'item' : 'items'}`;
    ownerWrap.appendChild(countSpan);
  }

  // Owner toolbar controls
  const ownerActions = document.getElementById('owner-actions');
  if (ownerActions) {
    ownerActions.style.display = isOwner ? 'flex' : 'none';
  }

  // Delete album button
  const delBtn = document.getElementById('btn-delete-album');
  if (delBtn) {
    delBtn.onclick = () => {
      showConfirmDialog({
        title: 'Delete this album?',
        message: 'This will remove the album. Your photos and videos will remain safe in your Library.',
        confirmText: 'Delete Album',
        danger: true,
        onConfirm: async () => {
          try {
            await deleteAlbum(albumId);
            showToast('Album deleted');
            window.location.href = '/albums.html';
          } catch (err) {
            showToast(err.message || 'Could not delete album', 'error');
          }
        }
      });
    };
  }

  // Slideshow button
  const slideBtn = document.getElementById('btn-slideshow');
  if (slideBtn) {
    slideBtn.style.display = albumMedia.length > 0 ? 'inline-block' : 'none';
    slideBtn.onclick = () => {
      if (albumMedia.length > 0) {
        openLightbox({ items: albumMedia, startIndex: 0 });
      }
    };
  }
}

function renderGallery() {
  const mount = document.getElementById('album-gallery-mount');
  const emptyEl = document.getElementById('album-empty');
  if (!mount) return;

  if (albumMedia.length === 0) {
    mount.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  if (!galleryInstance) {
    galleryInstance = new JustifiedGallery(mount, {
      gap: 8,
      selectable: isSelectMode,
      onTileClick: (index) => {
        if (!isSelectMode) {
          openLightbox({ items: albumMedia, startIndex: index });
        }
      },
      onSelectionChange: (selectedIds) => {
        selectedMediaIds = new Set(selectedIds);
        updateSelectionBar();
      }
    });
  } else {
    galleryInstance.setSelectable(isSelectMode);
  }

  galleryInstance.setItems(albumMedia);
}

// ============================================================================
// Select Mode & Actions
// ============================================================================
function initSelectionBar() {
  const toggleBtn = document.getElementById('btn-toggle-select');
  const selectionBar = document.getElementById('selection-bar');
  const doneBtn = document.getElementById('btn-done-select');
  const setCoverBtn = document.getElementById('btn-set-cover');
  const removeBtn = document.getElementById('btn-remove-selected');

  function setMode(enabled) {
    isSelectMode = enabled;
    if (toggleBtn) {
      toggleBtn.textContent = isSelectMode ? 'Cancel' : 'Select';
      toggleBtn.className = isSelectMode ? 'btn btn-primary btn-sm' : 'btn btn-sand btn-sm';
    }
    if (selectionBar) {
      selectionBar.style.display = isSelectMode ? 'flex' : 'none';
    }
    selectedMediaIds.clear();
    if (galleryInstance) {
      galleryInstance.setSelectable(isSelectMode);
    }
    updateSelectionBar();
  }

  if (toggleBtn) {
    toggleBtn.onclick = () => setMode(!isSelectMode);
  }

  if (doneBtn) {
    doneBtn.onclick = () => setMode(false);
  }

  if (setCoverBtn) {
    setCoverBtn.onclick = async () => {
      const selectedArr = Array.from(selectedMediaIds);
      if (selectedArr.length !== 1) return;
      const mediaId = selectedArr[0];
      try {
        await updateAlbum(albumId, { cover: mediaId });
        showToast('Album cover updated');
        setMode(false);
        await loadAlbum();
      } catch (err) {
        showToast(err.message || 'Could not update cover', 'error');
      }
    };
  }

  if (removeBtn) {
    removeBtn.onclick = () => {
      const selectedArr = Array.from(selectedMediaIds);
      if (selectedArr.length === 0) return;

      showConfirmDialog({
        title: `Remove ${selectedArr.length} ${selectedArr.length === 1 ? 'item' : 'items'} from album?`,
        message: 'The items will be removed from this album but stay in your Library.',
        confirmText: 'Remove',
        danger: true,
        onConfirm: async () => {
          try {
            for (const mId of selectedArr) {
              await removeAlbumMedia(albumId, mId);
            }
            showToast('Items removed from album');
            setMode(false);
            await loadAlbum();
          } catch (err) {
            showToast(err.message || 'Failed to remove items', 'error');
          }
        }
      });
    };
  }
}

function updateSelectionBar() {
  const countText = document.getElementById('selection-count-text');
  const setCoverBtn = document.getElementById('btn-set-cover');
  const removeBtn = document.getElementById('btn-remove-selected');

  const count = selectedMediaIds.size;
  if (countText) countText.textContent = `${count} selected`;
  if (setCoverBtn) setCoverBtn.style.display = count === 1 ? 'inline-block' : 'none';
  if (removeBtn) removeBtn.disabled = count === 0;
}

// ============================================================================
// Edit Details Modal
// ============================================================================
function initEditModal() {
  const modal = document.getElementById('modal-edit-album');
  const openBtn = document.getElementById('btn-edit-details');
  const cancelBtn = document.getElementById('btn-cancel-edit');
  const form = document.getElementById('form-edit-album');
  const titleInput = document.getElementById('edit-album-title');
  const descInput = document.getElementById('edit-album-desc');
  const visSelect = document.getElementById('edit-album-vis');

  let cleanupFocusTrap = null;

  function openModal() {
    if (!modal || !currentAlbum) return;
    titleInput.value = currentAlbum.title || '';
    descInput.value = currentAlbum.description || '';
    visSelect.value = currentAlbum.visibility || 'private';
    modal.classList.add('open');
    titleInput.focus();
    cleanupFocusTrap = setupFocusTrap(modal);
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    if (cleanupFocusTrap) {
      cleanupFocusTrap();
      cleanupFocusTrap = null;
    }
  }

  if (openBtn) openBtn.onclick = openModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const title = titleInput.value.trim();
      if (!title) return;

      try {
        await updateAlbum(albumId, {
          title,
          description: descInput.value.trim() || undefined,
          visibility: visSelect.value || 'private'
        });
        showToast('Album updated');
        closeModal();
        await loadAlbum();
      } catch (err) {
        showToast(err.message || 'Failed to update album', 'error');
      }
    };
  }
}

// ============================================================================
// Share Modal
// ============================================================================
function initShareModal() {
  const modal = document.getElementById('modal-share-album');
  const openBtn = document.getElementById('btn-share-modal');
  const closeBtn = document.getElementById('btn-close-share');
  const closeAltBtn = document.getElementById('btn-close-share-alt');
  const activePanel = document.getElementById('share-active-panel');
  const inactivePanel = document.getElementById('share-inactive-panel');
  const urlInput = document.getElementById('share-url-input');
  const copyBtn = document.getElementById('btn-copy-share-url');
  const revokeBtn = document.getElementById('btn-revoke-share');
  const createBtn = document.getElementById('btn-create-share-link');

  let cleanupFocusTrap = null;

  function updatePanel() {
    if (!currentAlbum) return;
    if (currentAlbum.shareToken) {
      if (activePanel) activePanel.style.display = 'block';
      if (inactivePanel) inactivePanel.style.display = 'none';
      const shareUrl = `${window.location.origin}/shared.html?token=${currentAlbum.shareToken}`;
      if (urlInput) urlInput.value = shareUrl;
    } else {
      if (activePanel) activePanel.style.display = 'none';
      if (inactivePanel) inactivePanel.style.display = 'block';
    }
  }

  function openModal() {
    if (!modal) return;
    updatePanel();
    modal.classList.add('open');
    cleanupFocusTrap = setupFocusTrap(modal);
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    if (cleanupFocusTrap) {
      cleanupFocusTrap();
      cleanupFocusTrap = null;
    }
  }

  if (openBtn) openBtn.onclick = openModal;
  if (closeBtn) closeBtn.onclick = closeModal;
  if (closeAltBtn) closeAltBtn.onclick = closeModal;

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  if (copyBtn) {
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(urlInput.value);
        showToast('Share link copied to clipboard!');
      } catch {
        showToast('Failed to copy link', 'error');
      }
    };
  }

  if (createBtn) {
    createBtn.onclick = async () => {
      createBtn.disabled = true;
      try {
        const res = await createAlbumShareToken(albumId);
        currentAlbum.shareToken = res.shareToken;
        updatePanel();
        renderAlbumDetails();
        showToast('Share link created!');
      } catch (err) {
        showToast(err.message || 'Could not create share link', 'error');
      } finally {
        createBtn.disabled = false;
      }
    };
  }

  if (revokeBtn) {
    revokeBtn.onclick = () => {
      showConfirmDialog({
        title: 'Revoke share link?',
        message: 'Anyone with the previous link will no longer be able to view this album.',
        confirmText: 'Revoke Link',
        danger: true,
        onConfirm: async () => {
          try {
            await deleteAlbumShareToken(albumId);
            currentAlbum.shareToken = null;
            updatePanel();
            renderAlbumDetails();
            showToast('Share link revoked');
          } catch (err) {
            showToast(err.message || 'Could not revoke link', 'error');
          }
        }
      });
    };
  }
}

// ============================================================================
// Add from Library Picker Modal
// ============================================================================
function initPickerModal() {
  const modal = document.getElementById('modal-picker-library');
  const openBtn = document.getElementById('btn-add-photos');
  const emptyOpenBtn = document.getElementById('btn-empty-add-photos');
  const cancelBtn = document.getElementById('btn-cancel-picker');
  const confirmBtn = document.getElementById('btn-confirm-picker');
  const grid = document.getElementById('picker-grid');
  const skeleton = document.getElementById('picker-skeleton');
  const emptyMsg = document.getElementById('picker-empty');
  const countSpan = document.getElementById('picker-selected-count');

  let cleanupFocusTrap = null;
  const pickedIds = new Set();

  function updatePickedCount() {
    const count = pickedIds.size;
    if (countSpan) countSpan.textContent = `${count} selected`;
    if (confirmBtn) confirmBtn.disabled = count === 0;
  }

  async function openModal() {
    if (!modal) return;
    pickedIds.clear();
    updatePickedCount();
    modal.classList.add('open');
    cleanupFocusTrap = setupFocusTrap(modal);

    if (skeleton) skeleton.style.display = 'grid';
    if (grid) grid.innerHTML = '';
    if (emptyMsg) emptyMsg.style.display = 'none';

    try {
      const res = await getMediaLibrary({ limit: 60 });
      const items = res.items || [];
      const existingMediaIds = new Set(albumMedia.map((m) => m.id || m._id));
      const availableItems = items.filter((m) => !existingMediaIds.has(m.id || m._id));

      if (skeleton) skeleton.style.display = 'none';

      if (availableItems.length === 0) {
        if (emptyMsg) emptyMsg.style.display = 'block';
        return;
      }

      availableItems.forEach((m) => {
        const id = m.id || m._id;
        const tile = document.createElement('div');
        tile.className = 'picker-tile';

        const img = document.createElement('img');
        img.src = m.urls?.thumb || m.urls?.display;
        img.alt = m.caption || 'Media';
        img.loading = 'lazy';
        tile.appendChild(img);

        const check = document.createElement('div');
        check.className = 'picker-check';
        check.appendChild(icon('check', 12));
        tile.appendChild(check);

        tile.onclick = () => {
          if (pickedIds.has(id)) {
            pickedIds.delete(id);
            tile.classList.remove('selected');
          } else {
            pickedIds.add(id);
            tile.classList.add('selected');
          }
          updatePickedCount();
        };

        grid.appendChild(tile);
      });
    } catch {
      if (skeleton) skeleton.style.display = 'none';
      if (emptyMsg) {
        emptyMsg.textContent = 'Could not load library photos.';
        emptyMsg.style.display = 'block';
      }
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    if (cleanupFocusTrap) {
      cleanupFocusTrap();
      cleanupFocusTrap = null;
    }
  }

  if (openBtn) openBtn.onclick = openModal;
  if (emptyOpenBtn) emptyOpenBtn.onclick = openModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      const ids = Array.from(pickedIds);
      if (ids.length === 0) return;

      confirmBtn.disabled = true;
      try {
        await addAlbumMedia(albumId, ids);
        showToast(`Added ${ids.length} ${ids.length === 1 ? 'item' : 'items'} to album!`);
        closeModal();
        await loadAlbum();
      } catch (err) {
        showToast(err.message || 'Failed to add photos', 'error');
      } finally {
        confirmBtn.disabled = false;
      }
    };
  }
}

