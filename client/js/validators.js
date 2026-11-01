// Form Validators matching Bloomly validation specifications

export function validateUsername(username) {
  if (!username) return 'Username is required';
  if (username.length < 3 || username.length > 20) {
    return 'Username must be between 3 and 20 characters';
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return 'Username can only contain letters, numbers, and underscores';
  }
  return null;
}

export function validateEmail(email) {
  if (!email) return 'Email is required';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Please provide a valid email';
  }
  return null;
}

export function validatePassword(password) {
  if (!password) return 'Password is required';
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/^(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
    return 'Password must contain at least one letter and one number';
  }
  return null;
}

export function validateDisplayName(displayName) {
  if (displayName && displayName.length > 50) {
    return 'Display name cannot exceed 50 characters';
  }
  return null;
}

export function getPasswordStrength(password) {
  if (!password) {
    return { score: 0, label: 'None', color: 'var(--color-text-light)' };
  }
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-zA-Z]/.test(password) && /\d/.test(password)) score++;
  if (password.length >= 10 && /[^a-zA-Z0-9]/.test(password)) score++;

  if (score === 1) {
    return { score: 1, label: 'Gentle', color: 'var(--color-peach)' };
  } else if (score === 2) {
    return { score: 2, label: 'Cozy', color: 'var(--color-secondary)' };
  } else if (score >= 3) {
    return { score: 3, label: 'Blooming', color: 'var(--color-primary-strong)' };
  }
  return { score: 1, label: 'Gentle', color: 'var(--color-peach)' };
}
