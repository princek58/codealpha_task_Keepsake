// Bloomly API client wrapper

class ApiError extends Error {
  constructor(message, status = 500, errors = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const headers = options.headers ? { ...options.headers } : {};

  // If body is plain object, serialize as JSON
  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body === 'object') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const config = {
    method: options.method || 'GET',
    headers,
    credentials: 'include', // Includes httpOnly cookie across same-origin
    ...options,
    body
  };

  const response = await fetch(url, config);

  let data;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => ({}));
  } else {
    data = await response.text().catch(() => '');
  }

  if (!response.ok) {
    const message = (data && data.message) || response.statusText || 'Request failed';
    const errors = (data && data.errors) || {};
    throw new ApiError(message, response.status, errors);
  }

  return data;
}

// 1. Health
export function getHealth() {
  return request('/health');
}

// 2. Authentication
export function register(userData) {
  return request('/auth/register', {
    method: 'POST',
    body: userData
  });
}

export function login(credentials) {
  return request('/auth/login', {
    method: 'POST',
    body: credentials
  });
}

export function logout() {
  return request('/auth/logout', {
    method: 'POST'
  });
}

export function getMe() {
  return request('/auth/me');
}

// 3. Users
export function searchUsers(query, page = 1, limit = 10) {
  const params = new URLSearchParams({ q: query, page, limit });
  return request(`/users/search?${params.toString()}`);
}

export function getSuggestions() {
  return request('/users/suggestions');
}

export function getProfile(username) {
  return request(`/users/${encodeURIComponent(username)}`);
}

export function getFollowers(username, page = 1, limit = 10) {
  const params = new URLSearchParams({ page, limit });
  return request(`/users/${encodeURIComponent(username)}/followers?${params.toString()}`);
}

export function getFollowing(username, page = 1, limit = 10) {
  const params = new URLSearchParams({ page, limit });
  return request(`/users/${encodeURIComponent(username)}/following?${params.toString()}`);
}

export function updateProfile(formDataOrObject) {
  return request('/users/me', {
    method: 'PUT',
    body: formDataOrObject
  });
}

export function toggleFollow(userId) {
  return request(`/users/${userId}/follow`, {
    method: 'POST'
  });
}

// 4. Posts
export function createPost(formDataOrObject) {
  return request('/posts', {
    method: 'POST',
    body: formDataOrObject
  });
}

export function getFeed(page = 1, limit = 10) {
  const params = new URLSearchParams({ page, limit });
  return request(`/posts/feed?${params.toString()}`);
}

export function getExplore(page = 1, limit = 10) {
  const params = new URLSearchParams({ page, limit });
  return request(`/posts/explore?${params.toString()}`);
}

export function getUserPosts(usernameOrId, page = 1, limit = 10) {
  const params = new URLSearchParams({ page, limit });
  return request(`/posts/user/${encodeURIComponent(usernameOrId)}?${params.toString()}`);
}

export function getPostById(postId) {
  return request(`/posts/${postId}`);
}

export function deletePost(postId) {
  return request(`/posts/${postId}`, {
    method: 'DELETE'
  });
}

export function toggleLike(postId) {
  return request(`/posts/${postId}/like`, {
    method: 'POST'
  });
}

// 5. Comments
export function createComment(postId, text) {
  return request(`/posts/${postId}/comments`, {
    method: 'POST',
    body: { text }
  });
}

export function getComments(postId, page = 1, limit = 10) {
  const params = new URLSearchParams({ page, limit });
  return request(`/posts/${postId}/comments?${params.toString()}`);
}

export function deleteComment(commentId) {
  return request(`/comments/${commentId}`, {
    method: 'DELETE'
  });
}

// 6. Notifications
export function getNotifications(page = 1, limit = 10) {
  const params = new URLSearchParams({ page, limit });
  return request(`/notifications?${params.toString()}`);
}

export function getUnreadCount() {
  return request('/notifications/unread-count');
}

export function markAllNotificationsAsRead() {
  return request('/notifications/read', {
    method: 'PUT'
  });
}

export function markNotificationAsRead(notificationId) {
  return request(`/notifications/${notificationId}/read`, {
    method: 'PUT'
  });
}

export const api = {
  request,
  getHealth,
  register,
  login,
  logout,
  getMe,
  searchUsers,
  getSuggestions,
  getProfile,
  getFollowers,
  getFollowing,
  updateProfile,
  toggleFollow,
  createPost,
  getFeed,
  getExplore,
  getUserPosts,
  getPostById,
  deletePost,
  toggleLike,
  createComment,
  getComments,
  deleteComment,
  getNotifications,
  getUnreadCount,
  markAllNotificationsAsRead,
  markNotificationAsRead
};

export default api;

