// Keepsake Landing Page Interactive Controller
import { getMe, getStats } from '../api.js';
import { revealStagger, countUp, initMagneticButton, initSoftFloat, isReducedMotion } from '../animations.js';
import { renderCollage } from '../collage.js';
import { JustifiedGallery } from '../gallery.js';
import { openLightbox } from '../lightbox.js';

document.addEventListener('DOMContentLoaded', async () => {
  initPreloader();
  checkAuthStatus();
  initHeroShowcase();
  initFeatureDemos();
  initStats();
  initAnimations();
});

function initPreloader() {
  const preloader = document.getElementById('preloader');
  if (!preloader) return;

  const hasSeen = sessionStorage.getItem('keepsake_seen_preloader');
  if (hasSeen || isReducedMotion()) {
    preloader.classList.add('hidden');
    preloader.remove();
  } else {
    sessionStorage.setItem('keepsake_seen_preloader', 'true');
    setTimeout(() => {
      preloader.classList.add('hidden');
      setTimeout(() => preloader.remove(), 350);
    }, 400);
  }
}

async function checkAuthStatus() {
  const authActions = document.getElementById('navbar-auth-actions');
  if (!authActions) return;

  try {
    const data = await getMe();
    if (data && data.user) {
      authActions.innerHTML = '';
      const openAppBtn = document.createElement('a');
      openAppBtn.href = '/home.html';
      openAppBtn.className = 'btn btn-primary btn-sm';
      openAppBtn.textContent = 'Open Keepsake';
      authActions.appendChild(openAppBtn);
    }
  } catch {
    // Unauthenticated: default buttons remain
  }
}

async function initHeroShowcase() {
  const collageContainer = document.getElementById('hero-collage');
  if (!collageContainer) return;

  try {
    const res = await fetch('/assets/demo/metadata.json');
    const demoItems = await res.json();

    // Render 3-item collage in hero showcase
    const heroItems = demoItems.slice(0, 3);
    renderCollage(collageContainer, {
      items: heroItems,
      template: 'collage-1-2',
      gap: 6,
      background: 'var(--color-sand)',
      onTileClick: ({ index }) => {
        openLightbox({ items: heroItems, startIndex: index });
      }
    });

    // Load polaroid images
    const p1 = document.getElementById('polaroid-img-1');
    const p2 = document.getElementById('polaroid-img-2');
    if (p1 && demoItems[3]) p1.src = demoItems[3].urls.thumb;
    if (p2 && demoItems[4]) p2.src = demoItems[4].urls.thumb;
  } catch {
    // If demo metadata fails, fallback gracefully
  }

  // Floating stickers
  const s1 = document.querySelector('.hero-sticker-1');
  const s2 = document.querySelector('.hero-sticker-2');
  if (s1) initSoftFloat(s1, 6, 3.5);
  if (s2) initSoftFloat(s2, 8, 4);
}

async function initFeatureDemos() {
  let demoItems = [];
  try {
    const res = await fetch('/assets/demo/metadata.json');
    demoItems = await res.json();
  } catch {
    return;
  }

  // 1. Collage Maker Preview
  const collageDemoContainer = document.getElementById('collage-demo-preview');
  const templatePills = document.querySelectorAll('[data-template]');
  let currentTemplate = 'collage-1-2';

  const updateCollageDemo = (tmpl) => {
    currentTemplate = tmpl;
    const count = tmpl === 'collage-2x2' ? 4 : (tmpl === 'collage-1x2' ? 2 : 3);
    const subset = demoItems.slice(0, count);

    renderCollage(collageDemoContainer, {
      items: subset,
      template: tmpl,
      gap: 8,
      background: 'var(--color-white)',
      onTileClick: ({ index }) => {
        openLightbox({ items: subset, startIndex: index });
      }
    });

    templatePills.forEach((p) => {
      if (p.dataset.template === tmpl) p.classList.add('active');
      else p.classList.remove('active');
    });
  };

  if (collageDemoContainer) {
    updateCollageDemo(currentTemplate);
    templatePills.forEach((pill) => {
      pill.onclick = () => updateCollageDemo(pill.dataset.template);
    });
  }

  // 2. Justified Gallery Demo
  const galleryDemoContainer = document.getElementById('gallery-demo-preview');
  if (galleryDemoContainer) {
    const gallery = new JustifiedGallery(galleryDemoContainer, {
      gap: 8,
      onTileClick: ({ item, index }) => {
        openLightbox({
          items: demoItems.slice(0, 8),
          startIndex: index
        });
      }
    });
    gallery.setItems(demoItems.slice(0, 8));
  }

  // 3. Privacy Segmented Control Demo
  const privacyButtons = document.querySelectorAll('[data-privacy]');
  const privacyExplanation = document.getElementById('privacy-explanation');
  const explanations = {
    followers: 'Only people you approve to follow you can view this moment.',
    public: 'Visible to everyone on Keepsake and discoverable in Explore.',
    private: 'Locked to your eyes only. Zero external access.'
  };

  privacyButtons.forEach((btn) => {
    btn.onclick = () => {
      privacyButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.dataset.privacy;
      if (privacyExplanation) {
        privacyExplanation.textContent = explanations[val] || '';
      }
    };
  });
}

async function initStats() {
  const statsSection = document.getElementById('stats-section');
  if (!statsSection) return;

  try {
    const data = await getStats();
    if (!data || typeof data.users !== 'number' || typeof data.moments !== 'number' || data.users < 5 || data.moments < 5) {
      statsSection.style.display = 'none';
      return;
    }

    const usersEl = document.getElementById('stat-users');
    const momentsEl = document.getElementById('stat-moments');

    if (usersEl) {
      countUp(usersEl, data.users);
    }
    if (momentsEl) {
      countUp(momentsEl, data.moments);
    }
  } catch {
    statsSection.style.display = 'none';
  }
}

function initAnimations() {
  const headline = document.querySelector('.hero-headline');
  const subtitle = document.querySelector('.hero-subtitle');
  const actions = document.querySelector('.hero-actions');
  const ctaBtn = document.querySelector('.hero-actions .btn-primary');

  if (headline && subtitle && actions) {
    revealStagger([headline, subtitle, actions], { y: 24, duration: 0.6, stagger: 0.1 });
  }

  if (ctaBtn) {
    initMagneticButton(ctaBtn);
  }
}

