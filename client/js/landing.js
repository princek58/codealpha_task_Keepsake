// Bloomly Landing Page script

import { api } from './api.js';
import { getStickerSvg } from './stickers.js';
import {
  flowerBloomAnimation,
  floatingLoop,
  mouseParallax,
  createHeartBurst,
  makeMagnetic,
  animateCounter,
  initScrollReveals
} from './animations.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Populate dynamic sticker placeholders in landing page
  injectStickers();

  // 2. Animate hero flower & floating elements
  const heroFlower = document.getElementById('hero-flower');
  if (heroFlower) {
    flowerBloomAnimation(heroFlower);
  }

  const floatingStickers = document.querySelectorAll('.hero-sticker-float');
  if (floatingStickers.length) {
    floatingLoop(floatingStickers, { yOffset: 10, rotateOffset: 6 });
  }

  const heroSection = document.querySelector('.hero-section');
  if (heroSection) {
    mouseParallax(heroSection, '.hero-sticker-float');
  }

  // 3. Magnetic buttons & Heart burst effects
  const primaryCtas = document.querySelectorAll('.btn-primary');
  primaryCtas.forEach((btn) => {
    makeMagnetic(btn, 0.2);
    btn.addEventListener('click', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX || (rect.left + rect.width / 2);
      const y = e.clientY || (rect.top + rect.height / 2);
      createHeartBurst(x, y, 10);
    });
  });

  // 4. Mock Card like interaction
  const mockLikeBtn = document.getElementById('mock-like-btn');
  const mockLikeCount = document.getElementById('mock-like-count');
  if (mockLikeBtn && mockLikeCount) {
    let liked = false;
    let count = 14;
    mockLikeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      liked = !liked;
      count = liked ? count + 1 : count - 1;
      mockLikeBtn.classList.toggle('active', liked);
      mockLikeCount.textContent = String(count);

      const rect = mockLikeBtn.getBoundingClientRect();
      createHeartBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 8);
    });
  }

  // 5. Scroll reveals & counter triggers
  initScrollReveals();
  initCounters();

  // 6. Check Auth State and update Navbar accordingly
  checkAuthNavbar();
});

function injectStickers() {
  document.querySelectorAll('[data-sticker]').forEach((el) => {
    const name = el.getAttribute('data-sticker');
    const size = el.getAttribute('data-sticker-size') ? parseInt(el.getAttribute('data-sticker-size'), 10) : null;
    el.innerHTML = getStickerSvg(name, { size });
  });
}

async function checkAuthNavbar() {
  const navActions = document.getElementById('nav-actions');
  if (!navActions) return;

  try {
    const data = await api.getMe();
    if (data && data.user) {
      const u = data.user;
      const initial = (u.displayName || u.username || 'U').charAt(0).toUpperCase();

      navActions.innerHTML = `
        <a href="/feed.html" class="btn btn-secondary btn-sm">Go to Feed</a>
        <a href="/profile.html" class="avatar avatar-sm" title="${u.displayName || u.username}">
          ${u.avatar ? `<img src="${u.avatar}" alt="${u.displayName}">` : initial}
        </a>
      `;
    }
  } catch {
    // Unauthenticated user is expected on landing page, leave default Sign In / Get Started
  }
}

function initCounters() {
  const counterElements = document.querySelectorAll('[data-counter]');
  if (!counterElements.length) return;

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const targetVal = entry.target.getAttribute('data-counter');
            animateCounter(entry.target, targetVal);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    counterElements.forEach((el) => observer.observe(el));
  } else {
    counterElements.forEach((el) => {
      animateCounter(el, el.getAttribute('data-counter'));
    });
  }
}

