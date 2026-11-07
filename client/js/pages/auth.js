// Keepsake Auth Page (Login & Registration)
import { login, register } from '../api.js';
import { redirectIfAuthed, getSafeNextUrl } from '../guard.js';
import { showToast } from '../ui.js';

function initAuthPage() {
  initTabs();
  initPasswordToggles();
  initPasswordStrength();
  initLoginForm();
  initRegisterForm();
  initDemoLoginHint();

  redirectIfAuthed('/home.html');
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById('form-login')) initAuthPage();
    });
  } else if (document.getElementById('form-login')) {
    initAuthPage();
  }
}

function initTabs() {
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const panelLogin = document.getElementById('panel-login');
  const panelRegister = document.getElementById('panel-register');
  const alertEl = document.getElementById('auth-alert');

  const switchTab = (tab) => {
    clearErrors();
    if (alertEl) alertEl.style.display = 'none';

    if (tab === 'register') {
      tabRegister.classList.add('active');
      tabRegister.setAttribute('aria-selected', 'true');
      tabLogin.classList.remove('active');
      tabLogin.setAttribute('aria-selected', 'false');

      panelRegister.style.display = 'block';
      panelLogin.style.display = 'none';
      document.getElementById('reg-username')?.focus();
      history.replaceState(null, '', '#register');
    } else {
      tabLogin.classList.add('active');
      tabLogin.setAttribute('aria-selected', 'true');
      tabRegister.classList.remove('active');
      tabRegister.setAttribute('aria-selected', 'false');

      panelLogin.style.display = 'block';
      panelRegister.style.display = 'none';
      document.getElementById('login-identifier')?.focus();
      history.replaceState(null, '', '#login');
    }
  };

  tabLogin.onclick = () => switchTab('login');
  tabRegister.onclick = () => switchTab('register');

  document.getElementById('link-go-register').onclick = (e) => {
    e.preventDefault();
    switchTab('register');
  };

  document.getElementById('link-go-login').onclick = (e) => {
    e.preventDefault();
    switchTab('login');
  };

  if (window.location.hash === '#register') {
    switchTab('register');
  }
}

function initPasswordToggles() {
  document.querySelectorAll('.password-toggle-btn').forEach((btn) => {
    btn.onclick = () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;

      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      btn.textContent = isPass ? 'Hide' : 'Show';
    };
  });
}

function initPasswordStrength() {
  const input = document.getElementById('reg-password');
  const bar = document.getElementById('password-strength-bar');
  const text = document.getElementById('password-strength-text');
  if (!input || !bar || !text) return;

  input.addEventListener('input', () => {
    const val = input.value;
    if (!val) {
      bar.style.width = '0%';
      bar.style.backgroundColor = 'var(--color-sand)';
      text.textContent = 'At least 8 characters with letters & numbers';
      text.style.color = 'var(--color-stone)';
      return;
    }

    const hasMinLen = val.length >= 8;
    const hasLetter = /[a-zA-Z]/.test(val);
    const hasDigit = /\d/.test(val);
    const hasSymbol = /[^a-zA-Z0-9]/.test(val);

    if (!hasMinLen || (!hasLetter || !hasDigit)) {
      bar.style.width = '33%';
      bar.style.backgroundColor = 'var(--color-brick)';
      text.textContent = 'Weak: needs at least 8 characters with letters & numbers';
      text.style.color = 'var(--color-brick)';
    } else if (val.length >= 10 && hasLetter && hasDigit && hasSymbol) {
      bar.style.width = '100%';
      bar.style.backgroundColor = 'var(--color-teal)';
      text.textContent = 'Strong password';
      text.style.color = 'var(--color-teal)';
    } else {
      bar.style.width = '66%';
      bar.style.backgroundColor = 'var(--color-mustard)';
      text.textContent = 'Good password';
      text.style.color = 'var(--color-ink)';
    }
  });
}

function initLoginForm() {
  const form = document.getElementById('form-login');
  const btn = document.getElementById('btn-login-submit');
  const alertEl = document.getElementById('auth-alert');

  form.onsubmit = async (e) => {
    e.preventDefault();
    clearErrors();
    alertEl.style.display = 'none';

    const identifier = document.getElementById('login-identifier').value.trim();
    const password = document.getElementById('login-password').value;

    let hasClientError = false;
    if (!identifier) {
      showFieldError('err-login-identifier', 'Please enter your username or email');
      hasClientError = true;
    }
    if (!password) {
      showFieldError('err-login-password', 'Please enter your password');
      hasClientError = true;
    }

    if (hasClientError) return;

    // Loading state & double-submit prevention
    btn.disabled = true;
    btn.classList.add('btn-loading');

    try {
      const res = await login({ identifier, password });
      showToast(`Welcome back, ${res.user.displayName || res.user.username}!`, 'success', 2000);
      const nextUrl = getSafeNextUrl('/home.html');
      setTimeout(() => {
        window.location.replace(nextUrl);
      }, 350);
    } catch (err) {
      btn.disabled = false;
      btn.classList.remove('btn-loading');

      const message = err.message || 'Invalid username or password. Please try again.';
      alertEl.textContent = message;
      alertEl.style.display = 'block';

      if (err.errors) {
        if (err.errors.identifier) showFieldError('err-login-identifier', err.errors.identifier);
        if (err.errors.password) showFieldError('err-login-password', err.errors.password);
      }
    }
  };
}

function initRegisterForm() {
  const form = document.getElementById('form-register');
  const btn = document.getElementById('btn-reg-submit');
  const alertEl = document.getElementById('auth-alert');

  form.onsubmit = async (e) => {
    e.preventDefault();
    clearErrors();
    alertEl.style.display = 'none';

    const username = document.getElementById('reg-username').value.trim();
    const displayName = document.getElementById('reg-displayName').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    let hasClientError = false;

    // Validate username (3-20, alphanumeric + underscore)
    if (!username) {
      showFieldError('err-reg-username', 'Username is required');
      hasClientError = true;
    } else if (username.length < 3 || username.length > 20) {
      showFieldError('err-reg-username', 'Username must be between 3 and 20 characters');
      hasClientError = true;
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      showFieldError('err-reg-username', 'Username can only contain letters, numbers, and underscores');
      hasClientError = true;
    }

    // Validate display name (optional, max 50)
    if (displayName && displayName.length > 50) {
      showFieldError('err-reg-displayName', 'Display name cannot exceed 50 characters');
      hasClientError = true;
    }

    // Validate email
    if (!email) {
      showFieldError('err-reg-email', 'Please provide a valid email');
      hasClientError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFieldError('err-reg-email', 'Please provide a valid email address');
      hasClientError = true;
    }

    // Validate password (min 8, at least 1 letter and 1 number)
    if (!password) {
      showFieldError('err-reg-password', 'Password is required');
      hasClientError = true;
    } else if (password.length < 8) {
      showFieldError('err-reg-password', 'Password must be at least 8 characters long');
      hasClientError = true;
    } else if (!/^(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
      showFieldError('err-reg-password', 'Password must contain at least one letter and one number');
      hasClientError = true;
    }

    if (hasClientError) return;

    btn.disabled = true;
    btn.classList.add('btn-loading');

    try {
      const payload = { username, email, password };
      if (displayName) payload.displayName = displayName;

      const res = await register(payload);
      showToast(`Welcome to Keepsake, ${res.user.displayName || res.user.username}!`, 'success', 2500);
      const nextUrl = getSafeNextUrl('/home.html');
      setTimeout(() => {
        window.location.replace(nextUrl);
      }, 400);
    } catch (err) {
      btn.disabled = false;
      btn.classList.remove('btn-loading');

      const message = err.message || 'Registration failed. Please check the fields below.';
      alertEl.textContent = message;
      alertEl.style.display = 'block';

      if (err.errors) {
        if (err.errors.username) showFieldError('err-reg-username', err.errors.username);
        if (err.errors.displayName) showFieldError('err-reg-displayName', err.errors.displayName);
        if (err.errors.email) showFieldError('err-reg-email', err.errors.email);
        if (err.errors.password) showFieldError('err-reg-password', err.errors.password);
      }
    }
  };
}

function showFieldError(id, message) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = message;
    el.style.display = 'block';
  }
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach((el) => {
    el.textContent = '';
    el.style.display = 'none';
  });
}

export async function initDemoLoginHint() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) return;
    const data = await res.json();
    if (!data.demoMode) return;

    const form = document.getElementById('form-login');
    if (!form || document.querySelector('.auth-demo-hint')) return;

    const hintContainer = document.createElement('div');
    hintContainer.className = 'auth-demo-hint';

    const hintTitle = document.createElement('strong');
    hintTitle.textContent = 'Demo Mode Active';

    const hintDesc = document.createElement('span');
    hintDesc.textContent = 'Demo account: clara@example.com / Password123';

    const fillBtn = document.createElement('button');
    fillBtn.type = 'button';
    fillBtn.className = 'btn btn-sand btn-sm auth-demo-btn';
    fillBtn.textContent = 'Use demo account';
    fillBtn.onclick = () => {
      const idInput = document.getElementById('login-identifier');
      const passInput = document.getElementById('login-password');
      if (idInput) idInput.value = 'clara@example.com';
      if (passInput) passInput.value = 'Password123';
      document.getElementById('btn-login-submit')?.focus();
    };

    hintContainer.appendChild(hintTitle);
    hintContainer.appendChild(hintDesc);
    hintContainer.appendChild(fillBtn);

    form.appendChild(hintContainer);
  } catch {}
}


