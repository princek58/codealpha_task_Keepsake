// Keepsake Library Page Controller
import { requireAuth } from '../guard.js';
import { mountAppShell } from '../shell.js';
import { getMediaLibrary, deleteMedia, updateMedia, getMyAlbums, createAlbum, addMediaToAlbum, getStorageStats } from '../api.js';
import { JustifiedGallery, groupMediaByDate } from '../gallery.js';
import { openLightbox } from '../lightbox.js';
import { UploadManager, buildDropZone, mountStorageBar } from '../upload-manager.js';
import { icon } from '../icons.js';
import { showToast, showConfirmDialog, openModal, closeModal } from '../ui.js';

let currentUser = null;
let currentType = '';
let currentSort = 'takenAt_desc';
let currentView = 'timeline'; // 'timeline' | 'grid'
let isSelectMode = false;
let libraryItems = [];
let selectedIds = new Set();
let libraryPage = 1;
let libraryHasMore = false;
let libraryLoading = false;
let sentinelObserver = null;
let activeGalleryInstance = null;
let timelineGalleries = [];
let uploadManagerInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    currentUser = await requireAuth();
  } catch {
    return;
  }

  mountAppShell({ activeTab: 'library', user: currentUser, pageTitle: 'Your Library' });

  initStorage();
  initUploadManager();
  initControls();
  initDragAndDropAnywhere();
  loadLibrary(true);

  // Check ?upload=1 query param
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('upload') === '1') {
    openUploadModal();
  }
});

async function initStorage() {
  const mount = document.getElementById('lib-storage-mount');
  const warnBanner = document.getElementById('storage-warning-banner');
  const openUploadBtn = document.getElementById('btn-open-upload');

  if (mount) mountStorageBar(mount);

  try {
    const stats = await getStorageStats();
    if (stats && stats.percent >= 100) {
      if (warnBanner) warnBanner.style.display = 'block';
      if (openUploadBtn) {
        openUploadBtn.disabled = true;
        openUploadBtn.title = 'Storage full';
      }
    }
  } catch {}
}

function initUploadManager() {
  const mount = document.getElementById('library-dropzone-mount');
  uploadManagerInstance = new UploadManager({
    onAllFinished: () => {
      showToast('Uploads completed!', 'success', 2500);
      initStorage();
      loadLibrary(true);
    }
  });

  if (mount) {
    buildDropZone(uploadManagerInstance, mount);
  }

  // Beforeunload warning only while uploads are in flight
  window.addEventListener('beforeunload', (e) => {
    if (uploadManagerInstance && uploadManagerInstance.inFlight > 0) {
      e.preventDefault();
      e.returnValue = 'Uploads are currently in progress. Are you sure you want to leave?';
    }
  });

  // Modal handlers
  const openBtn = document.getElementById('btn-open-upload');
  const closeBtn = document.getElementById('btn-close-upload');
  const modal = document.getElementById('upload-modal');

  if (openBtn) openBtn.onclick = () => openUploadModal();
  if (closeBtn) closeBtn.onclick = () => closeUploadModal();
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeUploadModal();
    };
  }
}

function openUploadModal() {
  const modal = document.getElementById('upload-modal');
  if (modal) {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
}

function closeUploadModal() {
  const modal = document.getElementById('upload-modal');
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
}

function initDragAndDropAnywhere() {
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length > 0) {
      openUploadModal();
      uploadManagerInstance.addFiles(e.dataTransfer.files);
    }
  });
}

function initControls() {
  // Filter chips
  document.querySelectorAll('[data-filter-type]').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('[data-filter-type]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentType = btn.dataset.filterType;
      loadLibrary(true);
    };
  });

  // Sort dropdown
  const sortSelect = document.getElementById('select-sort');
  if (sortSelect) {
    sortSelect.onchange = () => {
      currentSort = sortSelect.value;
      loadLibrary(true);
    };
  }

  // View style toggle
  const timelineBtn = document.getElementById('view-timeline-btn');
  const gridBtn = document.getElementById('view-grid-btn');

  if (timelineBtn && gridBtn) {
    timelineBtn.onclick = () => {
      currentView = 'timeline';
      timelineBtn.classList.add('active');
      gridBtn.classList.remove('active');
      renderCurrentView();
    };
    gridBtn.onclick = () => {
      currentView = 'grid';
      gridBtn.classList.add('active');
      timelineBtn.classList.remove('active');
      renderCurrentView();
    };
  }

  // Select Mode button
  const selectModeBtn = document.getElementById('btn-select-mode');
  if (selectModeBtn) {
    selectModeBtn.onclick = () => {
      isSelectMode = !isSelectMode;
      selectModeBtn.classList.toggle('active', isSelectMode);
      selectModeBtn.textContent = isSelectMode ? 'Exit select' : 'Select mode';
      updateSelectionToolbar();
      renderCurrentView();
    };
  }

  // Selection toolbar buttons
  const toolbar = document.getElementById('lib-selection-toolbar');
  const makeMomentBtn = document.getElementById('btn-make-moment');
  const addAlbumBtn = document.getElementById('btn-add-album');
  const deleteBtn = document.getElementById('btn-delete-selected');
  const clearBtn = document.getElementById('btn-clear-selection');

  if (clearBtn) {
    clearBtn.onclick = () => {
      selectedIds.clear();
      updateSelectionToolbar();
      renderCurrentView();
    };
  }

  if (makeMomentBtn) {
    makeMomentBtn.onclick = () => {
      if (selectedIds.size === 0) return;
      if (selectedIds.size > 20) {
        showToast('A moment can include at most 20 media items', 'error');
        return;
      }
      try {
        sessionStorage.setItem('keepsake_selected_media', JSON.stringify(Array.from(selectedIds)));
      } catch {}
      window.location.href = '/moment-new.html';
    };
  }

  if (addAlbumBtn) {
    addAlbumBtn.onclick = () => {
      if (selectedIds.size === 0) return;
      openAlbumPickerModal();
    };
  }

  if (deleteBtn) {
    deleteBtn.onclick = () => {
      if (selectedIds.size === 0) return;
      const count = selectedIds.size;
      showConfirmDialog({
        title: `Delete ${count} item${count > 1 ? 's' : ''}?`,
        message: 'These items will be permanently deleted from your library and removed from any moments or albums that feature them.',
        confirmLabel: 'Delete permanently',
        isDanger: true,
        onConfirm: async () => {
          const ids = Array.from(selectedIds);
          showToast(`Deleting ${ids.length} items...`, 'info', 2000);
          try {
            for (const id of ids) {
              await deleteMedia(id);
            }
            libraryItems = libraryItems.filter((i) => !selectedIds.has(i.id || i._id));
            selectedIds.clear();
            updateSelectionToolbar();
            renderCurrentView();
            initStorage();
            showToast('Selected items deleted successfully', 'success', 2500);
          } catch (err) {
            showToast('Error deleting items: ' + err.message, 'error');
          }
        }
      });
    };
  }

  // Sentinel Infinite Scroll
  const sentinel = document.getElementById('lib-sentinel');
  if ('IntersectionObserver' in window && sentinel) {
    sentinelObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && libraryHasMore && !libraryLoading) {
        libraryPage++;
        loadLibrary(false);
      }
    }, { rootMargin: '400px' });
    sentinelObserver.observe(sentinel);
  }
}

async function loadLibrary(isReset = false) {
  const mount = document.getElementById('library-gallery-mount');
  const countBadge = document.getElementById('lib-count-badge');
  if (!mount) return;

  if (isReset) {
    libraryPage = 1;
    libraryItems = [];
    selectedIds.clear();
    updateSelectionToolbar();
  }

  libraryLoading = true;

  try {
    const res = await getMediaLibrary({
      type: currentType || undefined,
      sort: currentSort,
      page: libraryPage,
      limit: 40
    });
    libraryLoading = false;
    const items = res.items || [];
    libraryHasMore = !!res.hasMore;

    if (isReset) {
      libraryItems = items;
      if (countBadge) countBadge.textContent = `${res.total || items.length} items`;
    } else {
      libraryItems = [...libraryItems, ...items];
    }

    renderCurrentView();
  } catch (err) {
    libraryLoading = false;
    if (isReset) {
      mount.innerHTML = `
        <div class="card" style="padding: var(--space-3xl); text-align: center;">
          <p style="color: var(--color-brick); margin-bottom: var(--space-md);">Failed to load library: ${err.message}</p>
          <button id="btn-retry-lib" class="btn btn-sand btn-sm">Retry</button>
        </div>
      `;
      const rb = document.getElementById('btn-retry-lib');
      if (rb) rb.onclick = () => loadLibrary(true);
    } else {
      showToast('Failed to load more media: ' + err.message, 'error');
    }
  }
}

function renderCurrentView() {
  const mount = document.getElementById('library-gallery-mount');
  if (!mount) return;

  mount.innerHTML = '';
  timelineGalleries = [];

  if (libraryItems.length === 0) {
    mount.innerHTML = `
      <div class="empty-state card" style="padding: var(--space-4xl) var(--space-xl); text-align: center;">
        <img src="/assets/stickers/camera.svg" width="72" height="72" alt="No media" style="margin-bottom: var(--space-md);">
        <h3 style="font-size: var(--text-xl); margin-bottom: var(--space-2xs);">Your Library is empty</h3>
        <p class="text-muted" style="font-size: var(--text-sm); max-width: 46ch; margin-bottom: var(--space-xl);">
          Drop photos or videos here to start building your personal memory archive.
        </p>
        <button id="btn-empty-upload" class="btn btn-primary btn-md">Upload your first photo</button>
      </div>
    `;
    const eb = document.getElementById('btn-empty-upload');
    if (eb) eb.onclick = () => openUploadModal();
    return;
  }

  if (currentView === 'grid') {
    // 1. Single Continuous Justified Gallery
    activeGalleryInstance = new JustifiedGallery(mount, {
      gap: 8,
      selectable: isSelectMode,
      selectedIds: selectedIds,
      onTileClick: ({ item, index }) => {
        openLightbox({
          items: libraryItems,
          startIndex: index,
          isOwner: true,
          onEditDetails: (it) => openEditMediaModal(it)
        });
      },
      onSelectionChange: (ids) => {
        selectedIds = new Set(ids);
        updateSelectionToolbar();
      }
    });
    activeGalleryInstance.setItems(libraryItems);
  } else {
    // 2. Timeline View Grouped by Month & Year
    const groups = groupMediaByDate(libraryItems, 'month');

    groups.forEach((group) => {
      const groupContainer = document.createElement('section');
      groupContainer.className = 'timeline-group';

      const heading = document.createElement('div');
      heading.className = 'timeline-heading';

      const title = document.createElement('h3');
      title.style.fontSize = 'var(--text-lg)';
      title.style.fontWeight = '600';
      title.textContent = group.label;
      heading.appendChild(title);

      if (isSelectMode) {
        const selectMonthBtn = document.createElement('button');
        selectMonthBtn.className = 'btn btn-ghost btn-sm';
        selectMonthBtn.textContent = 'Select month';
        selectMonthBtn.onclick = () => {
          group.items.forEach((item) => selectedIds.add(item.id || item._id));
          updateSelectionToolbar();
          renderCurrentView();
        };
        heading.appendChild(selectMonthBtn);
      }

      groupContainer.appendChild(heading);

      const galContainer = document.createElement('div');
      groupContainer.appendChild(galContainer);

      const subGallery = new JustifiedGallery(galContainer, {
        gap: 8,
        selectable: isSelectMode,
        selectedIds: selectedIds,
        onTileClick: ({ item, index }) => {
          const globalIdx = libraryItems.findIndex((i) => (i.id || i._id) === (item.id || item._id));
          openLightbox({
            items: libraryItems,
            startIndex: globalIdx >= 0 ? globalIdx : 0,
            isOwner: true,
            onEditDetails: (it) => openEditMediaModal(it)
          });
        },
        onSelectionChange: (ids) => {
          ids.forEach((id) => selectedIds.add(id));
          updateSelectionToolbar();
        }
      });
      subGallery.setItems(group.items);
      timelineGalleries.push(subGallery);

      mount.appendChild(groupContainer);
    });
  }
}

function updateSelectionToolbar() {
  const toolbar = document.getElementById('lib-selection-toolbar');
  const counter = document.getElementById('selected-counter');
  if (!toolbar || !counter) return;

  if (isSelectMode && selectedIds.size > 0) {
    toolbar.classList.add('active');
    counter.textContent = `${selectedIds.size} selected`;
  } else {
    toolbar.classList.remove('active');
  }
}

// ============================================================================
// Add to Album Modal
// ============================================================================
async function openAlbumPickerModal() {
  const modal = document.getElementById('album-picker-modal');
  const listEl = document.getElementById('album-picker-list');
  const inlineInput = document.getElementById('new-album-inline-title');
  const inlineCreateBtn = document.getElementById('btn-create-add-album');
  if (!modal || !listEl) return;

  listEl.innerHTML = '<div style="padding: 12px; font-size: var(--text-xs); color: var(--color-stone); text-align: center;">Loading albums...</div>';
  openModal(modal);

  try {
    const res = await getMyAlbums();
    const albums = res.items || [];
    listEl.innerHTML = '';

    if (albums.length === 0) {
      listEl.innerHTML = '<div style="padding: 12px; font-size: var(--text-xs); color: var(--color-stone); text-align: center;">No albums created yet. Enter a title below to create one!</div>';
    } else {
      albums.forEach((alb) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'btn btn-sand btn-sm';
        item.style.width = '100%';
        item.style.justifyContent = 'flex-start';
        item.style.padding = '8px 12px';
        item.textContent = alb.title;

        item.onclick = async () => {
          try {
            await addMediaToAlbum(alb.id || alb._id, Array.from(selectedIds));
            closeModal(modal);
            showToast(`Added ${selectedIds.size} item(s) to "${alb.title}"`, 'success', 2500);
            selectedIds.clear();
            updateSelectionToolbar();
            renderCurrentView();
          } catch (err) {
            showToast('Failed to add to album: ' + err.message, 'error');
          }
        };
        listEl.appendChild(item);
      });
    }

    if (inlineCreateBtn) {
      inlineCreateBtn.onclick = async () => {
        const title = inlineInput.value.trim();
        if (!title) {
          showToast('Please enter an album title', 'error');
          return;
        }

        try {
          const createRes = await createAlbum({ title });
          const newAlb = createRes.album;
          await addMediaToAlbum(newAlb.id || newAlb._id, Array.from(selectedIds));
          closeModal(modal);
          showToast(`Created "${newAlb.title}" and added ${selectedIds.size} item(s)!`, 'success', 2500);
          selectedIds.clear();
          updateSelectionToolbar();
          renderCurrentView();
          inlineInput.value = '';
        } catch (err) {
          showToast('Failed to create album: ' + err.message, 'error');
        }
      };
    }

    modal.querySelectorAll('[data-close-album-modal]').forEach((b) => {
      b.onclick = () => closeModal(modal);
    });
  } catch (err) {
    listEl.innerHTML = `<div style="color: var(--color-brick); font-size: var(--text-xs); padding: 8px;">Failed to load albums: ${err.message}</div>`;
  }
}

// ============================================================================
// Edit Media Modal
// ============================================================================
function openEditMediaModal(mediaItem) {
  const modal = document.getElementById('media-edit-modal');
  const capInput = document.getElementById('edit-media-caption');
  const placeInput = document.getElementById('edit-media-place');
  const dateInput = document.getElementById('edit-media-date');
  const saveBtn = document.getElementById('btn-save-media-edit');

  if (!modal || !capInput) return;

  capInput.value = mediaItem.caption || '';
  placeInput.value = mediaItem.place || '';

  if (mediaItem.takenAt) {
    try {
      dateInput.value = new Date(mediaItem.takenAt).toISOString().split('T')[0];
    } catch {
      dateInput.value = '';
    }
  } else {
    dateInput.value = '';
  }

  openModal(modal);

  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    const payload = {
      caption: capInput.value.trim(),
      place: placeInput.value.trim()
    };
    if (dateInput.value) {
      payload.takenAt = new Date(dateInput.value).toISOString();
    }

    try {
      const res = await updateMedia(mediaItem.id || mediaItem._id, payload);
      Object.assign(mediaItem, res.media);
      saveBtn.disabled = false;
      closeModal(modal);
      showToast('Photo details updated successfully', 'success', 2000);
      renderCurrentView();
    } catch (err) {
      saveBtn.disabled = false;
      showToast('Failed to save details: ' + err.message, 'error');
    }
  };

  modal.querySelectorAll('[data-close-edit-modal]').forEach((b) => {
    b.onclick = () => closeModal(modal);
  });
}

