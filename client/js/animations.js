// Bloomly GSAP & Canvas micro-interaction helpers

export const prefersReducedMotion = () => {
  return typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// 1. Stagger Reveal
export function staggerReveal(elements, options = {}) {
  const {
    duration = 0.6,
    stagger = 0.08,
    y = 20,
    delay = 0,
    ease = 'power2.out'
  } = options;

  const els = Array.isArray(elements)
    ? elements
    : typeof elements === 'string'
      ? document.querySelectorAll(elements)
      : [elements];

  if (!els || !els.length) return;

  if (prefersReducedMotion() || typeof window.gsap === 'undefined') {
    els.forEach((el) => {
      if (el) {
        el.style.opacity = '1';
        el.style.transform = 'none';
      }
    });
    return;
  }

  window.gsap.fromTo(
    els,
    { opacity: 0, y },
    {
      opacity: 1,
      y: 0,
      duration,
      stagger,
      delay,
      ease
    }
  );
}

// 2. Floating Loop for stickers & badges
export function floatingLoop(elements, options = {}) {
  const {
    yOffset = 8,
    rotateOffset = 4,
    duration = 3.5,
    stagger = 0.4
  } = options;

  const els = Array.isArray(elements)
    ? elements
    : typeof elements === 'string'
      ? document.querySelectorAll(elements)
      : [elements];

  if (!els || !els.length || prefersReducedMotion() || typeof window.gsap === 'undefined') {
    return;
  }

  els.forEach((el, index) => {
    if (!el) return;
    const individualDuration = duration + (index % 3) * 0.4;
    const dir = index % 2 === 0 ? 1 : -1;

    window.gsap.to(el, {
      y: `-=${yOffset}`,
      rotation: rotateOffset * dir,
      duration: individualDuration,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
      delay: index * stagger
    });
  });
}

// 3. Flower Bloom entrance
export function flowerBloomAnimation(flowerElement) {
  if (!flowerElement) return;

  if (prefersReducedMotion() || typeof window.gsap === 'undefined') {
    flowerElement.style.transform = 'none';
    flowerElement.style.opacity = '1';
    return;
  }

  const petals = flowerElement.querySelectorAll('.petal, circle[fill="#FFB3C7"], circle[fill="#FF6F91"]');
  const center = flowerElement.querySelector('.flower-center, circle[fill="#FFF0B3"]');

  window.gsap.set(flowerElement, { opacity: 1 });

  if (petals && petals.length) {
    window.gsap.fromTo(
      petals,
      { scale: 0, transformOrigin: 'center center' },
      {
        scale: 1,
        duration: 0.9,
        stagger: 0.06,
        ease: 'back.out(2)',
        delay: 0.2
      }
    );
  }

  if (center) {
    window.gsap.fromTo(
      center,
      { scale: 0, rotation: -45, transformOrigin: 'center center' },
      {
        scale: 1,
        rotation: 0,
        duration: 0.8,
        ease: 'elastic.out(1, 0.5)',
        delay: 0.4
      }
    );
  }

  // Gentle idle breathing
  window.gsap.to(flowerElement, {
    scale: 1.03,
    duration: 2.8,
    ease: 'sine.inOut',
    repeat: -1,
    yoyo: true,
    delay: 1.2
  });
}

// 4. Mouse Parallax for hero items
export function mouseParallax(container, items) {
  if (!container || prefersReducedMotion() || typeof window.gsap === 'undefined') {
    return;
  }

  const targets = Array.isArray(items)
    ? items
    : typeof items === 'string'
      ? container.querySelectorAll(items)
      : [items];

  if (!targets.length) return;

  let bounds = container.getBoundingClientRect();
  window.addEventListener('resize', () => {
    bounds = container.getBoundingClientRect();
  });

  container.addEventListener('mousemove', (e) => {
    const mouseX = e.clientX - bounds.left;
    const mouseY = e.clientY - bounds.top;
    const xRatio = (mouseX / bounds.width - 0.5) * 2;
    const yRatio = (mouseY / bounds.height - 0.5) * 2;

    targets.forEach((target, i) => {
      const depth = (i + 1) * 8;
      window.gsap.to(target, {
        x: xRatio * depth,
        y: yRatio * depth,
        duration: 0.8,
        ease: 'power1.out',
        overwrite: 'auto'
      });
    });
  });

  container.addEventListener('mouseleave', () => {
    targets.forEach((target) => {
      window.gsap.to(target, {
        x: 0,
        y: 0,
        duration: 0.8,
        ease: 'power2.out',
        overwrite: 'auto'
      });
    });
  });
}

// 5. Magnetic button effect
export function makeMagnetic(button, strength = 0.3) {
  if (!button || prefersReducedMotion() || typeof window.gsap === 'undefined') {
    return;
  }

  button.addEventListener('mousemove', (e) => {
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    window.gsap.to(button, {
      x: x * strength,
      y: y * strength,
      duration: 0.3,
      ease: 'power2.out',
      overwrite: 'auto'
    });
  });

  button.addEventListener('mouseleave', () => {
    window.gsap.to(button, {
      x: 0,
      y: 0,
      duration: 0.5,
      ease: 'elastic.out(1, 0.4)',
      overwrite: 'auto'
    });
  });
}

// 6. Heart Burst Particle Effect
export function createHeartBurst(x, y, count = 8) {
  if (prefersReducedMotion()) return;

  const container = document.body;
  const colors = ['#FF6F91', '#FFB3C7', '#D9C8FF', '#FFCDB2'];

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'burst-particle';
    particle.style.position = 'fixed';
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.pointerEvents = 'none';
    particle.style.zIndex = '9999';
    particle.style.width = '14px';
    particle.style.height = '14px';

    const color = colors[i % colors.length];
    particle.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="${color}"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;

    container.appendChild(particle);

    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
    const distance = 40 + Math.random() * 50;
    const destX = Math.cos(angle) * distance;
    const destY = Math.sin(angle) * distance - 20;

    if (typeof window.gsap !== 'undefined') {
      window.gsap.to(particle, {
        x: destX,
        y: destY,
        rotation: (Math.random() - 0.5) * 90,
        scale: Math.random() * 0.6 + 0.6,
        opacity: 0,
        duration: 0.75 + Math.random() * 0.3,
        ease: 'power2.out',
        onComplete: () => {
          if (particle.parentNode) {
            particle.parentNode.removeChild(particle);
          }
        }
      });
    } else {
      setTimeout(() => {
        if (particle.parentNode) particle.parentNode.removeChild(particle);
      }, 700);
    }
  }
}

// 7. Counter Number Animation
export function animateCounter(element, targetValue, duration = 1.8) {
  if (!element) return;
  const target = parseInt(targetValue, 10);
  if (isNaN(target)) return;

  if (prefersReducedMotion() || typeof window.gsap === 'undefined') {
    element.textContent = target.toLocaleString();
    return;
  }

  const obj = { val: 0 };
  window.gsap.to(obj, {
    val: target,
    duration,
    ease: 'power2.out',
    onUpdate: () => {
      element.textContent = Math.round(obj.val).toLocaleString();
    }
  });
}

// 8. Scroll-triggered sections
export function initScrollReveals() {
  if (prefersReducedMotion() || typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') {
    return;
  }

  window.gsap.registerPlugin(window.ScrollTrigger);

  const sections = document.querySelectorAll('[data-reveal]');
  sections.forEach((sec) => {
    window.gsap.fromTo(
      sec,
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: sec,
          start: 'top 85%',
          toggleActions: 'play none none none'
        }
      }
    );
  });
}

export const animations = {
  prefersReducedMotion,
  staggerReveal,
  floatingLoop,
  flowerBloomAnimation,
  mouseParallax,
  makeMagnetic,
  createHeartBurst,
  animateCounter,
  initScrollReveals
};

export default animations;

