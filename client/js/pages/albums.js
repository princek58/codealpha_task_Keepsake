// Keepsake Albums Page Controller
import { requireAuth } from '../guard.js';
import { mountAppShell } from '../shell.js';
import { getAlbums, createAlbum } from '../api.js';
import { icon } from '../icons.js';
import { showToast, formatTimeAgo, setupFocusTrap } from '../ui.js';

let currentUser = null;
let albumsList = [];

document.addEventListener('DOMContentLoaded', async () => {
  try {
    currentUser = await requireAuth();
  } catch {
    return;
  }

  mountAppShell({ activeTab: 'albums', user: currentUser, pageTitle: 'Curated Albums' });

  initCreateModal();
  await loadAlbums();
});

async function loadAlbums() {
  const skeleton = document.getElementById('albums-skeleton');
  const emptyEl = document.getElementById('albums-empty');
  const grid = document.getElementById('albums-grid');

  try {
    const res = await getAlbums(1, 50);
    albumsList = res.items || [];

    if (skeleton) skeleton.style.display = 'none';

    if (albumsList.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      if (grid) grid.style.display = 'none';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    if (grid) {
      grid.style.display = 'grid';
      renderAlbums();
    }
  } catch (err) {
    if (skeleton) skeleton.style.display = 'none';
    showToast(err.message || 'Failed to load albums', 'error');
  }
}

function renderAlbums() {
  const grid = document.getElementById('albums-grid');
  if (!grid) return;
  grid.innerHTML = '';

  albumsList.forEach((album) => {
    const card = document.createElement('a');
    card.className = 'album-card';
    card.href = `/album.html?id=${album.id || album._id}`;

    // Cover wrap
    const coverWrap = document.createElement('div');
    coverWrap.className = 'album-cover-wrap';

    const coverUrl = album.cover?.urls?.thumb || album.cover?.urls?.display || (album.media?.[0]?.urls?.thumb || album.media?.[0]?.urls?.display);

    if (coverUrl) {
      const img = document.createElement('img');
      img.className = 'album-cover-img';
      img.src = coverUrl;
      img.alt = album.title;
      img.loading = 'lazy';
      coverWrap.appendChild(img);
    } else {
      const emptyIcon = icon('folder', 48);
      emptyIcon.style.color = 'var(--color-stone)';
      coverWrap.appendChild(emptyIcon);
    }

    // Media count badge
    const countBadge = document.createElement('span');
    countBadge.className = 'badge badge-sand';
    countBadge.style.position = 'absolute';
    countBadge.style.bottom = '8px';
    countBadge.style.left = '8px';
    countBadge.style.fontSize = '11px';
    const mediaCount = album.mediaCount ?? (album.media?.length || 0);
    countBadge.textContent = `${mediaCount} ${mediaCount === 1 ? 'item' : 'items'}`;
    coverWrap.appendChild(countBadge);

    // Shared / Visibility badge
    const topBadges = document.createElement('div');
    topBadges.style.position = 'absolute';
    topBadges.style.top = '8px';
    topBadges.style.right = '8px';
    topBadges.style.display = 'flex';
    topBadges.style.gap = '4px';

    if (album.shareToken) {
      const shareBadge = document.createElement('span');
      shareBadge.className = 'badge badge-teal';
      shareBadge.style.fontSize = '10px';
      shareBadge.style.display = 'inline-flex';
      shareBadge.style.alignItems = 'center';
      shareBadge.style.gap = '2px';
      shareBadge.appendChild(icon('share', 10));
      const sText = document.createElement('span');
      sText.textContent = 'Shared';
      shareBadge.appendChild(sText);
      topBadges.appendChild(shareBadge);
    }

    if (album.visibility && album.visibility !== 'private') {
      const visBadge = document.createElement('span');
      visBadge.className = 'badge badge-sand';
      visBadge.style.fontSize = '10px';
      visBadge.textContent = album.visibility === 'public' ? 'Public' : 'Followers';
      topBadges.appendChild(visBadge);
    }

    coverWrap.appendChild(topBadges);
    card.appendChild(coverWrap);

    // Body
    const body = document.createElement('div');
    body.className = 'album-body';

    const title = document.createElement('h2');
    title.style.fontSize = 'var(--text-base)';
    title.style.fontWeight = '600';
    title.style.marginBottom = '4px';
    title.style.whiteSpace = 'nowrap';
    title.style.overflow = 'hidden';
    title.style.textOverflow = 'ellipsis';
    title.textContent = album.title;
    body.appendChild(title);

    if (album.description) {
      const desc = document.createElement('p');
      desc.style.fontSize = 'var(--text-xs)';
      desc.style.color = 'var(--color-stone)';
      desc.style.marginBottom = 'var(--space-xs)';
      desc.style.lineHeight = '1.4';
      desc.style.display = '-webkit-box';
      desc.style.webkitLineClamp = '2';
      desc.style.webkitBoxOrient = 'vertical';
      desc.style.overflow = 'hidden';
      desc.textContent = album.description;
      body.appendChild(desc);
    }

    const footer = document.createElement('div');
    footer.style.marginTop = 'auto';
    footer.style.paddingTop = 'var(--space-xs)';
    footer.style.fontSize = '11px';
    footer.style.color = 'var(--color-stone)';
    footer.textContent = `Updated ${formatTimeAgo(album.updatedAt || album.createdAt)}`;
    body.appendChild(footer);

    card.appendChild(body);
    grid.appendChild(card);
  });
}

function initCreateModal() {
  const modal = document.getElementById('modal-create-album');
  const openBtn = document.getElementById('btn-create-album');
  const emptyOpenBtn = document.getElementById('btn-empty-new-album');
  const cancelBtn = document.getElementById('btn-cancel-create');
  const form = document.getElementById('form-create-album');
  const titleInput = document.getElementById('new-album-title');
  const descInput = document.getElementById('new-album-desc');
  const visSelect = document.getElementById('new-album-vis');
  const submitBtn = document.getElementById('btn-submit-create');

  let cleanupFocusTrap = null;

  function openModal() {
    if (!modal) return;
    modal.classList.add('open');
    if (titleInput) {
      titleInput.value = '';
      titleInput.focus();
    }
    if (descInput) descInput.value = '';
    if (visSelect) visSelect.value = 'private';
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
  if (emptyOpenBtn) emptyOpenBtn.onclick = openModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.classList.contains('open')) {
      closeModal();
    }
  });

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const title = titleInput.value.trim();
      if (!title) return;

      submitBtn.disabled = true;
      try {
        const body = {
          title,
          description: descInput.value.trim() || undefined,
          visibility: visSelect.value || 'private'
        };
        const res = await createAlbum(body);
        showToast('Album created!');
        closeModal();
        window.location.href = `/album.html?id=${res.album.id || res.album._id}`;
      } catch (err) {
        showToast(err.message || 'Failed to create album', 'error');
      } finally {
        submitBtn.disabled = false;
      }
    };
  }
}

