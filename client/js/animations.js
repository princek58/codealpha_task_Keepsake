// Keepsake Animations Module (Reduced-Motion Aware with GSAP & CSS Fallbacks)

export function isReducedMotion() {
  return typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function hasGsap() {
  return typeof window !== 'undefined' && typeof window.gsap !== 'undefined';
}

/**
 * Staggered reveal for an array or NodeList of elements
 */
export function revealStagger(elements, options = {}) {
  const elList = Array.from(elements);
  if (elList.length === 0) return;

  if (isReducedMotion()) {
    elList.forEach((el) => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    return;
  }

  if (hasGsap()) {
    window.gsap.fromTo(
      elList,
      { opacity: 0, y: options.y || 20 },
      {
        opacity: 1,
        y: 0,
        duration: options.duration || 0.6,
        stagger: options.stagger || 0.08,
        ease: 'power2.out',
        delay: options.delay || 0
      }
    );
  } else {
    // Pure CSS Fallback
    elList.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = `translateY(${options.y || 20}px)`;
      el.style.transition = `opacity 0.5s ease ${(options.delay || 0) + i * 0.08}s, transform 0.5s ease ${(options.delay || 0) + i * 0.08}s`;
      requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
    });
  }
}

/**
 * Page entrance transition
 */
export function pageEnter(container = document.body) {
  if (isReducedMotion() || !container) return;

  if (hasGsap()) {
    window.gsap.fromTo(
      container,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
    );
  } else {
    container.style.opacity = '0';
    container.style.transform = 'translateY(8px)';
    container.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    requestAnimationFrame(() => {
      container.style.opacity = '1';
      container.style.transform = 'translateY(0)';
    });
  }
}

/**
 * Numeric count-up animation
 */
export function countUp(element, endVal, duration = 1200) {
  if (!element) return;
  const target = Number(endVal) || 0;

  if (isReducedMotion()) {
    element.textContent = target.toLocaleString();
    return;
  }

  const startTime = performance.now();
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(eased * target);
    element.textContent = current.toLocaleString();

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = target.toLocaleString();
    }
  }

  requestAnimationFrame(update);
}

/**
 * Magnetic button hover effect
 */
export function initMagneticButton(button) {
  if (!button || isReducedMotion()) return;

  const handleMouseMove = (e) => {
    const rect = button.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    const moveX = x * 0.25;
    const moveY = y * 0.25;

    if (hasGsap()) {
      window.gsap.to(button, { x: moveX, y: moveY, duration: 0.3, ease: 'power2.out' });
    } else {
      button.style.transform = `translate3d(${moveX}px, ${moveY}px, 0)`;
    }
  };

  const handleMouseLeave = () => {
    if (hasGsap()) {
      window.gsap.to(button, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    } else {
      button.style.transform = 'translate3d(0, 0, 0)';
    }
  };

  button.addEventListener('mousemove', handleMouseMove);
  button.addEventListener('mouseleave', handleMouseLeave);

  return () => {
    button.removeEventListener('mousemove', handleMouseMove);
    button.removeEventListener('mouseleave', handleMouseLeave);
  };
}

/**
 * Like button pop scale animation
 */
export function animateLikePop(element) {
  if (!element || isReducedMotion()) return;

  if (hasGsap()) {
    window.gsap.fromTo(
      element,
      { scale: 0.8 },
      { scale: 1.25, duration: 0.15, ease: 'back.out(2)', yoyo: true, repeat: 1 }
    );
  } else {
    element.style.transform = 'scale(1.25)';
    element.style.transition = 'transform 150ms ease';
    setTimeout(() => {
      element.style.transform = 'scale(1)';
    }, 150);
  }
}

/**
 * Gentle floating ambient animation
 */
export function initSoftFloat(element, distance = 8, duration = 3) {
  if (!element || isReducedMotion()) return;

  if (hasGsap()) {
    return window.gsap.to(element, {
      y: `-=${distance}`,
      duration,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    });
  }
}

/**
 * Scroll parallax effect
 */
export function initParallax(element, factor = 0.15) {
  if (!element || isReducedMotion()) return;

  const handleScroll = () => {
    const scrolled = window.pageYOffset;
    const offset = scrolled * factor;
    element.style.transform = `translate3d(0, ${offset}px, 0)`;
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
}

