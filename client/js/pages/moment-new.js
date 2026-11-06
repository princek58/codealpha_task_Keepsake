// Keepsake Moment Creation & Editing Controller
import { requireAuth } from '../guard.js';
import { mountAppShell } from '../shell.js';
import { getMediaLibrary, getMomentById, createMoment, updateMoment } from '../api.js';
import { renderLayout, exportCollagePng, downloadBlob } from '../collage.js';
import { templatesForCount, getDefaultTemplate, renderTemplatePreview } from '../collage-templates.js';
import { UploadManager, buildDropZone } from '../upload-manager.js';
import { icon } from '../icons.js';
import { showToast, buildAvatar } from '../ui.js';

let currentUser = null;
let editMomentId = null;
let currentStep = 1;

// Moment draft state
let draft = {
  media: [], // array of media items in order
  layout: {
    type: 'collage',
    template: 'collage-1-2',
    gap: 8,
    background: 'white'
  },
  title: '',
  caption: '',
  takenOn: '',
  place: '',
  tags: [],
  visibility: 'followers'
};

const SWATCH_PALETTE = [
  'white',
  'var(--color-paper)',
  'var(--color-sand)',
  'var(--color-ink)',
  'var(--color-stone)',
  'var(--color-terracotta)',
  'var(--color-teal)',
  'var(--color-sage)',
  'var(--color-mustard)',
  'var(--color-slate)',
  'var(--color-charcoal)'
];

async function initMomentNewPage() {
  try {
    currentUser = await requireAuth();
  } catch {
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  editMomentId = urlParams.get('edit');

  mountAppShell({
    activeTab: 'create',
    user: currentUser,
    pageTitle: editMomentId ? 'Edit Moment' : 'Create Moment'
  });

  if (editMomentId) {
    document.getElementById('builder-page-title').textContent = 'Edit Moment';
    document.getElementById('btn-publish-moment').textContent = 'Save changes';
    await loadExistingMoment(editMomentId);
  } else {
    loadDraftFromStorage();
  }

  initStepper();
  initStep1Media();
  initStep2Layout();
  initStep3Details();
  updateLivePreview();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMomentNewPage);
} else {
  initMomentNewPage();
}

function loadDraftFromStorage() {
  try {
    // 1. Check for media IDs passed from Library
    const preselectedJson = sessionStorage.getItem('keepsake_selected_media');
    if (preselectedJson) {
      const ids = JSON.parse(preselectedJson);
      sessionStorage.removeItem('keepsake_selected_media');
      if (Array.isArray(ids) && ids.length > 0) {
        draft.media = ids.map((id) => ({ id }));
      }
    }

    // 2. Check for saved form draft
    const savedDraft = sessionStorage.getItem('keepsake_moment_draft');
    if (savedDraft) {
      const parsed = JSON.parse(savedDraft);
      draft = { ...draft, ...parsed };
    }
  } catch {}
}

function saveDraftToStorage() {
  if (editMomentId) return;
  try {
    sessionStorage.setItem('keepsake_moment_draft', JSON.stringify({
      layout: draft.layout,
      title: draft.title,
      caption: draft.caption,
      takenOn: draft.takenOn,
      place: draft.place,
      tags: draft.tags,
      visibility: draft.visibility
    }));
  } catch {}
}

async function loadExistingMoment(id) {
  try {
    const res = await getMomentById(id);
    const m = res.moment;
    if (!m) throw new Error('Moment not found');

    draft.media = m.media || [];
    draft.layout = m.layout || { type: 'grid', gap: 8, background: 'white' };
    draft.title = m.title || '';
    draft.caption = m.caption || '';
    draft.takenOn = m.takenOn ? m.takenOn.split('T')[0] : '';
    draft.place = m.place || '';
    draft.tags = m.tags || [];
    draft.visibility = m.visibility || 'followers';

    // Populate form fields
    document.getElementById('moment-title').value = draft.title;
    document.getElementById('moment-caption').value = draft.caption;
    document.getElementById('moment-place').value = draft.place;
    if (draft.takenOn) {
      document.getElementById('moment-date').value = draft.takenOn;
    }

    updateTagsUI();
    updateVisibilityUI(draft.visibility);
    updateLayoutControlsUI();
    updateMediaCountBadge();
  } catch (err) {
    showToast('Failed to load moment: ' + err.message, 'error');
  }
}

// ============================================================================
// Stepper Navigation
// ============================================================================
function initStepper() {
  const btn1 = document.getElementById('step-btn-1');
  const btn2 = document.getElementById('step-btn-2');
  const btn3 = document.getElementById('step-btn-3');

  const panel1 = document.getElementById('step-panel-1');
  const panel2 = document.getElementById('step-panel-2');
  const panel3 = document.getElementById('step-panel-3');

  const goToStep = (s) => {
    if (s > 1 && draft.media.length === 0) {
      showToast('Please select at least one photo or video first', 'info');
      return;
    }

    currentStep = s;

    [btn1, btn2, btn3].forEach((btn, idx) => {
      btn.classList.toggle('active', idx + 1 === s);
    });

    panel1.style.display = s === 1 ? 'block' : 'none';
    panel2.style.display = s === 2 ? 'block' : 'none';
    panel3.style.display = s === 3 ? 'block' : 'none';

    if (s === 2) {
      renderTemplateOptions();
      renderReorderList();
    }

    updateLivePreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  btn1.onclick = () => goToStep(1);
  btn2.onclick = () => goToStep(2);
  btn3.onclick = () => goToStep(3);

  document.getElementById('btn-next-step-1').onclick = () => goToStep(2);
  document.getElementById('btn-back-step-2').onclick = () => goToStep(1);
  document.getElementById('btn-next-step-2').onclick = () => goToStep(3);
  document.getElementById('btn-back-step-3').onclick = () => goToStep(2);
}

// ============================================================================
// Step 1: Media Selection & Upload
// ============================================================================
async function initStep1Media() {
  const pickerEl = document.getElementById('builder-library-picker');
  const dropzoneMount = document.getElementById('builder-dropzone-mount');

  // Inline upload manager
  const uploader = new UploadManager({
    onAllFinished: async () => {
      showToast('New media uploaded and added to moment!', 'success');
      await refreshLibraryPicker();
    }
  });

  // Override uploader to auto-select finished items
  uploader.onFileReady = (mediaDoc) => {
    if (draft.media.length < 20) {
      const already = draft.media.some((m) => (m.id || m._id) === (mediaDoc.id || mediaDoc._id));
      if (!already) {
        draft.media.push(mediaDoc);
        updateMediaCountBadge();
        updateLivePreview();
      }
    }
  };

  if (dropzoneMount) {
    buildDropZone(uploader, dropzoneMount);
  }

  await refreshLibraryPicker();
}

async function refreshLibraryPicker() {
  const pickerEl = document.getElementById('builder-library-picker');
  if (!pickerEl) return;

  try {
    const res = await getMediaLibrary({ limit: 60 });
    const items = res.items || [];
    pickerEl.innerHTML = '';

    if (items.length === 0) {
      pickerEl.innerHTML = '<div style="padding: 16px; font-size: var(--text-xs); color: var(--color-stone); text-align: center;">No library media yet. Upload photos above!</div>';
      return;
    }

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(88px, 1fr))';
    grid.style.gap = '6px';

    items.forEach((item) => {
      const id = item.id || item._id;
      const isSelected = draft.media.some((m) => (m.id || m._id) === id);

      const tile = document.createElement('div');
      tile.className = 'media-tile' + (isSelected ? ' selected' : '');
      tile.style.aspectRatio = '1 / 1';
      tile.style.position = 'relative';
      tile.style.cursor = 'pointer';
      tile.style.borderRadius = 'var(--radius-sm)';
      tile.style.overflow = 'hidden';
      tile.style.backgroundColor = 'var(--color-sand)';

      const img = document.createElement('img');
      img.src = item.urls?.thumb || item.urls?.display;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      tile.appendChild(img);

      // Checkbox indicator
      const checkBadge = document.createElement('div');
      checkBadge.className = 'tile-checkbox';
      checkBadge.style.position = 'absolute';
      checkBadge.style.top = '4px';
      checkBadge.style.right = '4px';
      checkBadge.style.width = '20px';
      checkBadge.style.height = '20px';
      checkBadge.style.borderRadius = 'var(--radius-pill)';
      checkBadge.style.backgroundColor = isSelected ? 'var(--color-teal)' : 'var(--color-sand)';
      checkBadge.style.display = 'flex';
      checkBadge.style.alignItems = 'center';
      checkBadge.style.justifyContent = 'center';
      checkBadge.style.color = 'var(--color-white)';
      if (isSelected) {
        checkBadge.appendChild(icon('check', { size: 14 }));
      }
      tile.appendChild(checkBadge);

      tile.onclick = () => {
        const idx = draft.media.findIndex((m) => (m.id || m._id) === id);
        if (idx >= 0) {
          draft.media.splice(idx, 1);
          tile.classList.remove('selected');
          checkBadge.style.backgroundColor = 'var(--color-sand)';
          checkBadge.innerHTML = '';
        } else {
          if (draft.media.length >= 20) {
            showToast('A moment can include at most 20 media items', 'error');
            return;
          }
          draft.media.push(item);
          tile.classList.add('selected');
          checkBadge.style.backgroundColor = 'var(--color-teal)';
          checkBadge.appendChild(icon('check', { size: 14 }));
        }

        updateMediaCountBadge();
        updateEarliestDate();
        updateLivePreview();
        saveDraftToStorage();
      };

      grid.appendChild(tile);
    });

    pickerEl.appendChild(grid);
  } catch (err) {
    pickerEl.innerHTML = `<div style="color: var(--color-brick); font-size: var(--text-xs); padding: 8px;">Failed to load library: ${err.message}</div>`;
  }
}

function updateMediaCountBadge() {
  const countBadge = document.getElementById('selected-media-count');
  if (countBadge) {
    countBadge.textContent = `${draft.media.length} / 20 selected`;
  }
}

function updateEarliestDate() {
  const dateInput = document.getElementById('moment-date');
  if (!dateInput || dateInput.value) return;

  const datesWithValues = draft.media
    .map((m) => m.takenAt)
    .filter(Boolean)
    .map((d) => new Date(d));

  if (datesWithValues.length > 0) {
    const earliest = new Date(Math.min(...datesWithValues));
    dateInput.value = earliest.toISOString().split('T')[0];
    draft.takenOn = dateInput.value;
  }
}

// ============================================================================
// Step 2: Layout & Arrangement
// ============================================================================
function initStep2Layout() {
  // Layout type switcher
  document.querySelectorAll('[data-layout-type]').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('[data-layout-type]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      draft.layout.type = btn.dataset.layoutType;

      const collageOpts = document.getElementById('collage-options-section');
      if (collageOpts) {
        collageOpts.style.display = draft.layout.type === 'collage' ? 'block' : 'none';
      }

      updateLivePreview();
      saveDraftToStorage();
    };
  });

  // Gap slider
  const gapSlider = document.getElementById('builder-gap-slider');
  const gapDisplay = document.getElementById('gap-value-display');
  if (gapSlider) {
    gapSlider.value = draft.layout.gap || 8;
    gapSlider.oninput = () => {
      draft.layout.gap = parseInt(gapSlider.value, 10);
      if (gapDisplay) gapDisplay.textContent = `${draft.layout.gap}px`;
      updateLivePreview();
      saveDraftToStorage();
    };
  }

  // Background swatches
  const swatchList = document.getElementById('swatch-list');
  if (swatchList) {
    swatchList.innerHTML = '';
    SWATCH_PALETTE.forEach((color) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch-btn' + (draft.layout.background === color ? ' active' : '');
      btn.style.backgroundColor = color;
      btn.setAttribute('aria-label', `Color ${color}`);
      btn.onclick = () => {
        swatchList.querySelectorAll('.swatch-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        draft.layout.background = color;
        updateLivePreview();
        saveDraftToStorage();
      };
      swatchList.appendChild(btn);
    });
  }

  // PNG Export Button
  const exportBtn = document.getElementById('btn-export-collage-png');
  const exportHint = document.getElementById('export-disabled-hint');

  if (exportBtn) {
    exportBtn.onclick = async () => {
      const hasVideo = draft.media.some((m) => m.type === 'video');
      if (hasVideo) {
        showToast('PNG export is only supported for photo moments', 'info');
        return;
      }
      try {
        showToast('Rendering high-res collage PNG...', 'info', 2000);
        const tmpl = draft.layout.template || getDefaultTemplate(draft.media.length);
        const blob = await exportCollagePng(draft.media, tmpl, draft.layout.gap, draft.layout.background, 1600);
        downloadBlob(blob, `keepsake-collage-${Date.now()}.png`);
        showToast('Collage PNG downloaded!', 'success', 2500);
      } catch (err) {
        showToast('Export failed: ' + err.message, 'error');
      }
    };
  }
}

function updateLayoutControlsUI() {
  document.querySelectorAll('[data-layout-type]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.layoutType === (draft.layout.type || 'collage'));
  });

  const collageOpts = document.getElementById('collage-options-section');
  if (collageOpts) {
    collageOpts.style.display = draft.layout.type === 'collage' ? 'block' : 'none';
  }

  const gapSlider = document.getElementById('builder-gap-slider');
  const gapDisplay = document.getElementById('gap-value-display');
  if (gapSlider) {
    gapSlider.value = draft.layout.gap || 8;
    if (gapDisplay) gapDisplay.textContent = `${draft.layout.gap || 8}px`;
  }
}

function renderTemplateOptions() {
  const container = document.getElementById('builder-tmpl-list');
  if (!container) return;

  container.innerHTML = '';
  const count = draft.media.length;
  const availableTemplates = templatesForCount(count);

  if (availableTemplates.length === 0) {
    container.innerHTML = '<div style="font-size: var(--text-xs); color: var(--color-stone); padding: 4px;">Default responsive grid will be used</div>';
    return;
  }

  if (!draft.layout.template || !availableTemplates.some((t) => t.id === draft.layout.template)) {
    draft.layout.template = getDefaultTemplate(count);
  }

  availableTemplates.forEach((tmpl) => {
    const tile = document.createElement('div');
    tile.className = 'tmpl-tile' + (draft.layout.template === tmpl.id ? ' active' : '');

    const previewSvg = renderTemplatePreview(tmpl.id, 54, 40);
    tile.appendChild(previewSvg);

    const label = document.createElement('span');
    label.style.fontSize = '10px';
    label.style.fontWeight = '600';
    label.textContent = tmpl.name;
    tile.appendChild(label);

    tile.onclick = () => {
      container.querySelectorAll('.tmpl-tile').forEach((t) => t.classList.remove('active'));
      tile.classList.add('active');
      draft.layout.template = tmpl.id;
      updateLivePreview();
      saveDraftToStorage();
    };

    container.appendChild(tile);
  });
}

function renderReorderList() {
  const list = document.getElementById('reorder-list');
  const exportBtn = document.getElementById('btn-export-collage-png');
  const exportHint = document.getElementById('export-disabled-hint');
  if (!list) return;

  list.innerHTML = '';

  const hasVideo = draft.media.some((m) => m.type === 'video');
  if (exportBtn && exportHint) {
    if (hasVideo) {
      exportBtn.disabled = true;
      exportHint.style.display = 'block';
    } else {
      exportBtn.disabled = false;
      exportHint.style.display = 'none';
    }
  }

  draft.media.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'reorder-item';

    // Drag handle
    const handle = document.createElement('div');
    handle.style.color = 'var(--color-stone)';
    handle.style.cursor = 'grab';
    handle.appendChild(icon('drag-handle', { size: 16 }));
    row.appendChild(handle);

    // Thumbnail
    const img = document.createElement('img');
    img.src = item.urls?.thumb || item.urls?.display;
    img.style.width = '32px';
    img.style.height = '32px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = 'var(--radius-xs)';
    row.appendChild(img);

    // Title / index
    const label = document.createElement('span');
    label.style.flex = '1';
    label.style.fontSize = 'var(--text-xs)';
    label.style.fontWeight = '600';
    label.textContent = `${index + 1}. ${item.type === 'video' ? 'Video' : 'Photo'}`;
    row.appendChild(label);

    // Move Earlier Button
    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'btn-icon';
    upBtn.style.padding = '4px';
    upBtn.setAttribute('aria-label', `Move item ${index + 1} earlier`);
    upBtn.appendChild(icon('chevron-up', { size: 16 }));
    upBtn.disabled = index === 0;
    upBtn.onclick = () => {
      const temp = draft.media[index];
      draft.media[index] = draft.media[index - 1];
      draft.media[index - 1] = temp;
      renderReorderList();
      updateLivePreview();
      saveDraftToStorage();
    };
    row.appendChild(upBtn);

    // Move Later Button
    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'btn-icon';
    downBtn.style.padding = '4px';
    downBtn.setAttribute('aria-label', `Move item ${index + 1} later`);
    downBtn.appendChild(icon('chevron-down', { size: 16 }));
    downBtn.disabled = index === draft.media.length - 1;
    downBtn.onclick = () => {
      const temp = draft.media[index];
      draft.media[index] = draft.media[index + 1];
      draft.media[index + 1] = temp;
      renderReorderList();
      updateLivePreview();
      saveDraftToStorage();
    };
    row.appendChild(downBtn);

    // Remove Button
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-icon';
    removeBtn.style.padding = '4px';
    removeBtn.style.color = 'var(--color-brick)';
    removeBtn.setAttribute('aria-label', `Remove item ${index + 1}`);
    removeBtn.appendChild(icon('close', { size: 16 }));
    removeBtn.onclick = () => {
      draft.media.splice(index, 1);
      renderReorderList();
      renderTemplateOptions();
      updateMediaCountBadge();
      updateLivePreview();
      saveDraftToStorage();
    };
    row.appendChild(removeBtn);

    list.appendChild(row);
  });
}

// ============================================================================
// Step 3: Details & Publishing
// ============================================================================
function initStep3Details() {
  const titleInput = document.getElementById('moment-title');
  const titleCounter = document.getElementById('title-counter');
  const captionInput = document.getElementById('moment-caption');
  const captionCounter = document.getElementById('caption-counter');
  const dateInput = document.getElementById('moment-date');
  const placeInput = document.getElementById('moment-place');
  const tagInput = document.getElementById('tag-input');
  const addTagBtn = document.getElementById('btn-add-tag');
  const publishBtn = document.getElementById('btn-publish-moment');

  if (titleInput) {
    titleInput.oninput = () => {
      draft.title = titleInput.value;
      if (titleCounter) titleCounter.textContent = `${draft.title.length} / 80`;
      saveDraftToStorage();
    };
  }

  if (captionInput) {
    captionInput.oninput = () => {
      draft.caption = captionInput.value;
      if (captionCounter) captionCounter.textContent = `${draft.caption.length} / 1000`;
      saveDraftToStorage();
    };
  }

  if (dateInput) {
    dateInput.onchange = () => {
      draft.takenOn = dateInput.value;
      saveDraftToStorage();
    };
  }

  if (placeInput) {
    placeInput.oninput = () => {
      draft.place = placeInput.value;
      saveDraftToStorage();
    };
  }

  // Tags
  const addTag = () => {
    const raw = tagInput.value.trim().replace(/^#/, '');
    if (!raw) return;
    const clean = raw.toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 24);
    if (!clean) return;

    if (draft.tags.length >= 8) {
      showToast('Maximum 8 tags allowed', 'error');
      return;
    }
    if (!draft.tags.includes(clean)) {
      draft.tags.push(clean);
      updateTagsUI();
      saveDraftToStorage();
    }
    tagInput.value = '';
  };

  if (addTagBtn) addTagBtn.onclick = addTag;
  if (tagInput) {
    tagInput.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTag();
      }
    };
  }

  // Visibility
  const visExplanations = {
    followers: 'Only people you approve to follow you can view this moment.',
    public: 'Visible to everyone on Keepsake and discoverable in Explore.',
    private: 'Locked to your eyes only. Zero external access.'
  };

  document.querySelectorAll('[data-vis]').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('[data-vis]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      draft.visibility = btn.dataset.vis;
      const desc = document.getElementById('visibility-desc');
      if (desc) desc.textContent = visExplanations[draft.visibility] || '';
      saveDraftToStorage();
    };
  });

  // Publish / Save
  if (publishBtn) {
    publishBtn.onclick = async () => {
      await submitMoment();
    };
  }
}

function updateTagsUI() {
  const container = document.getElementById('tag-chip-container');
  const countEl = document.getElementById('tags-count');
  if (!container) return;

  container.innerHTML = '';
  if (countEl) countEl.textContent = `${draft.tags.length} / 8`;

  draft.tags.forEach((tag, idx) => {
    const chip = document.createElement('span');
    chip.className = 'chip active';
    chip.style.padding = '4px 10px';
    chip.style.fontSize = 'var(--text-xs)';
    chip.style.gap = '4px';

    const text = document.createElement('span');
    text.textContent = `#${tag}`;
    chip.appendChild(text);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.setAttribute('aria-label', `Remove tag ${tag}`);
    removeBtn.style.background = 'none';
    removeBtn.style.border = 'none';
    removeBtn.style.color = 'inherit';
    removeBtn.style.cursor = 'pointer';
    removeBtn.style.display = 'flex';
    removeBtn.appendChild(icon('close', { size: 12 }));
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      draft.tags.splice(idx, 1);
      updateTagsUI();
      saveDraftToStorage();
    };
    chip.appendChild(removeBtn);

    container.appendChild(chip);
  });
}

function updateVisibilityUI(vis) {
  document.querySelectorAll('[data-vis]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.vis === vis);
  });
}

async function submitMoment() {
  const btn = document.getElementById('btn-publish-moment');
  const errBox = document.getElementById('builder-general-error');
  if (errBox) errBox.style.display = 'none';

  if (draft.media.length === 0) {
    showToast('Please select at least one media item', 'error');
    return;
  }

  btn.disabled = true;
  btn.classList.add('btn-loading');

  const payload = {
    media: draft.media.map((m) => m.id || m._id),
    title: draft.title.trim(),
    caption: draft.caption.trim(),
    layout: {
      type: draft.layout.type || 'collage',
      template: draft.layout.template || getDefaultTemplate(draft.media.length),
      gap: draft.layout.gap || 8,
      background: draft.layout.background || 'white'
    },
    tags: draft.tags,
    visibility: draft.visibility || 'followers'
  };

  if (draft.takenOn) {
    payload.takenOn = new Date(draft.takenOn).toISOString();
  }
  if (draft.place.trim()) {
    payload.place = draft.place.trim();
  }

  try {
    let resultMoment = null;
    if (editMomentId) {
      const res = await updateMoment(editMomentId, payload);
      resultMoment = res.moment;
      showToast('Moment updated successfully!', 'success', 2000);
    } else {
      const res = await createMoment(payload);
      resultMoment = res.moment;
      sessionStorage.removeItem('keepsake_moment_draft');
      showToast('Moment published to your feed!', 'success', 2000);
    }

    const id = resultMoment.id || resultMoment._id || editMomentId;
    setTimeout(() => {
      window.location.replace(`/moment.html?id=${id}`);
    }, 400);
  } catch (err) {
    btn.disabled = false;
    btn.classList.remove('btn-loading');

    const msg = err.message || 'Failed to save moment. Please check the fields and try again.';
    if (errBox) {
      errBox.textContent = msg;
      errBox.style.display = 'block';
    }
    showToast(msg, 'error');
  }
}

// ============================================================================
// Live Preview Controller
// ============================================================================
function updateLivePreview() {
  const previewContainer = document.getElementById('builder-live-preview');
  const badge = document.getElementById('preview-layout-badge');
  if (!previewContainer) return;

  if (badge) {
    badge.textContent = draft.layout.type.toUpperCase();
  }

  previewContainer.innerHTML = '';

  if (draft.media.length === 0) {
    previewContainer.innerHTML = '<p class="text-muted" style="font-size: var(--text-xs); padding: 32px; text-align: center;">Select photos in Step 1 to preview your layout</p>';
    return;
  }

  const layoutSpec = {
    type: draft.layout.type,
    template: draft.layout.template || getDefaultTemplate(draft.media.length),
    gap: draft.layout.gap,
    background: draft.layout.background
  };

  renderLayout(previewContainer, draft.media, layoutSpec);
}
