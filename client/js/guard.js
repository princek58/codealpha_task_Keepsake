// Keepsake Authentication Guard & Navigation Protection
import { getMe } from './api.js';
import { showToast } from './ui.js';

let isRedirecting = false;

/**
 * Validates and extracts a safe relative next redirect path, preventing open-redirect attacks.
 * @param {string} [defaultUrl='/home.html']
 * @returns {string}
 */
export function getSafeNextUrl(defaultUrl = '/home.html') {
  try {
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next');
    if (!next) return defaultUrl;

    // Must be a relative path starting with a single '/'
    // Disallow protocol schemes, '//', '/\', and dangerous schemes
    if (
      next.startsWith('/') &&
      !next.startsWith('//') &&
      !next.startsWith('/\\') &&
      !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(next)
    ) {
      return next;
    }
  } catch {
    // URL parsing failed
  }
  return defaultUrl;
}

/**
 * Requires authentication for protected pages. Redirects to /auth.html if unauthenticated.
 * @returns {Promise<Object>} The authenticated user object
 */
export async function requireAuth() {
  try {
    const data = await getMe();
    if (data && data.user) {
      return data.user;
    }
    throw new Error('Not authenticated');
  } catch (err) {
    if (!isRedirecting) {
      isRedirecting = true;
      const currentPath = window.location.pathname + window.location.search;
      const safeNext = encodeURIComponent(currentPath);
      window.location.replace(`/auth.html?next=${safeNext}`);
    }
    throw err;
  }
}

/**
 * For guest pages (e.g. auth.html). Redirects to /home.html or safe ?next= if already logged in.
 * @param {string} [defaultUrl='/home.html']
 */
export async function redirectIfAuthed(defaultUrl = '/home.html') {
  try {
    const data = await getMe();
    if (data && data.user) {
      const target = getSafeNextUrl(defaultUrl);
      window.location.replace(target);
      return data.user;
    }
  } catch {
    // Unauthenticated: stay on the guest page
  }
  return null;
}

// Global 401 unauthorized listener broadcasted by api.js
if (typeof window !== 'undefined') {
  window.addEventListener('keepsake:unauthorized', () => {
    if (isRedirecting) return;
    isRedirecting = true;

    showToast('Your session has expired. Please sign in again.', 'info', 3000);

    const currentPath = window.location.pathname + window.location.search;
    // Don't redirect if already on auth or public pages
    if (currentPath.includes('/auth.html') || currentPath.includes('/shared.html')) {
      isRedirecting = false;
      return;
    }

    const safeNext = encodeURIComponent(currentPath);
    setTimeout(() => {
      window.location.replace(`/auth.html?next=${safeNext}`);
    }, 800);
  });
}

