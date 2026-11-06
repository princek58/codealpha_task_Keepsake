// Keepsake Public Shared Album Controller
import { getSharedAlbum } from '../api.js';
import { JustifiedGallery } from '../gallery.js';
import { openLightbox } from '../lightbox.js';
import { buildAvatar } from '../ui.js';

let currentAlbum = null;
let mediaList = [];
let shareToken = null;

async function initSharedPage() {
  const params = new URLSearchParams(window.location.search);
  shareToken = params.get('token');

  if (!shareToken) {
    showError('No Link Provided', 'Please check the link provided by the album creator.');
    return;
  }

  await loadSharedAlbum();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSharedPage);
} else {
  initSharedPage();
}

async function loadSharedAlbum() {
  const skeleton = document.getElementById('shared-skeleton');
  const errorEl = document.getElementById('shared-error');
  const content = document.getElementById('shared-content');

  try {
    const res = await getSharedAlbum(shareToken);
    currentAlbum = res.album;
    mediaList = res.media || [];

    if (skeleton) skeleton.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
    if (content) content.style.display = 'block';

    renderDetails();
    renderGallery();
  } catch (err) {
    if (skeleton) skeleton.style.display = 'none';
    const msg = err.status === 404 ? 'This link is expired, revoked, or invalid.' : (err.message || 'Failed to load shared album.');
    showError('Link Expired or Invalid', msg);
  }
}

function showError(title, desc) {
  const skeleton = document.getElementById('shared-skeleton');
  const errorEl = document.getElementById('shared-error');
  const content = document.getElementById('shared-content');
  const errorTitle = document.getElementById('shared-error-title');
  const errorDesc = document.getElementById('shared-error-desc');

  if (skeleton) skeleton.style.display = 'none';
  if (content) content.style.display = 'none';
  if (errorTitle) errorTitle.textContent = title;
  if (errorDesc) errorDesc.textContent = desc;
  if (errorEl) errorEl.style.display = 'block';
}

function renderDetails() {
  if (!currentAlbum) return;
  const a = currentAlbum;

  document.title = `${a.title} — Keepsake`;

  const titleEl = document.getElementById('shared-title');
  if (titleEl) titleEl.textContent = a.title;

  const descEl = document.getElementById('shared-desc');
  if (descEl) {
    if (a.description) {
      descEl.textContent = a.description;
      descEl.style.display = 'block';
    } else {
      descEl.style.display = 'none';
    }
  }

  const ownerWrap = document.getElementById('shared-owner-wrap');
  if (ownerWrap && a.owner) {
    ownerWrap.innerHTML = '';

    const labelSpan = document.createElement('span');
    labelSpan.style.fontSize = 'var(--text-xs)';
    labelSpan.style.color = 'var(--color-stone)';
    labelSpan.textContent = 'Shared by';
    ownerWrap.appendChild(labelSpan);

    const av = buildAvatar(a.owner, 'sm');
    ownerWrap.appendChild(av);

    const nameSpan = document.createElement('span');
    nameSpan.style.fontSize = 'var(--text-xs)';
    nameSpan.style.fontWeight = '600';
    nameSpan.textContent = a.owner.displayName || a.owner.username;
    ownerWrap.appendChild(nameSpan);

    const countBadge = document.createElement('span');
    countBadge.className = 'badge badge-sand';
    countBadge.style.fontSize = '11px';
    countBadge.textContent = `${mediaList.length} ${mediaList.length === 1 ? 'item' : 'items'}`;
    ownerWrap.appendChild(countBadge);
  }

  const slideBtn = document.getElementById('btn-shared-slideshow');
  if (slideBtn) {
    slideBtn.style.display = mediaList.length > 0 ? 'inline-block' : 'none';
    slideBtn.onclick = () => {
      if (mediaList.length > 0) {
        openLightbox({ items: mediaList, startIndex: 0, token: shareToken });
      }
    };
  }
}

function renderGallery() {
  const mount = document.getElementById('shared-gallery-mount');
  if (!mount) return;

  const gallery = new JustifiedGallery(mount, {
    gap: 8,
    selectable: false,
    token: shareToken,
    onTileClick: ({ index }) => {
      openLightbox({ items: mediaList, startIndex: index, token: shareToken });
    }
  });

  gallery.setItems(mediaList);
}

