// Keepsake API Client Module

export class ApiError extends Error {
  constructor(message, status = 500, errors = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

let isHandling401 = false;
function emitUnauthorized() {
  if (isHandling401) return;
  isHandling401 = true;
  window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  setTimeout(() => {
    isHandling401 = false;
  }, 1000);
}

async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : endpoint;
  const headers = { ...options.headers };

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const config = {
    method: options.method || 'GET',
    headers,
    credentials: 'include',
    ...options
  };

  if (options.body && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body);
  }

  let res;
  try {
    res = await fetch(url, config);
  } catch (err) {
    throw new ApiError(err.message || 'Network request failed', 0);
  }

  if (res.status === 401) {
    emitUnauthorized();
  }

  let data;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = {};
    }
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const message = (data && data.message) || res.statusText || 'Request failed';
    const errors = (data && data.errors) || {};
    throw new ApiError(message, res.status, errors);
  }

  return data;
}

// XHR Upload Helper for Progress and Abort
export function uploadFilesWithProgress(endpoint, formData, onProgress) {
  const xhr = new XMLHttpRequest();

  const promise = new Promise((resolve, reject) => {
    xhr.open('POST', endpoint, true);
    xhr.withCredentials = true;

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress({ loaded: e.loaded, total: e.total, percent });
        }
      };
    }

    xhr.onload = () => {
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = xhr.responseText;
      }

      if (xhr.status === 401) {
        emitUnauthorized();
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        const msg = (data && data.message) || xhr.statusText || 'Upload failed';
        const errors = (data && data.errors) || {};
        reject(new ApiError(msg, xhr.status, errors));
      }
    };

    xhr.onerror = () => {
      reject(new ApiError('Upload network error', 0));
    };

    xhr.onabort = () => {
      reject(new ApiError('Upload cancelled by user', 0));
    };

    xhr.send(formData);
  });

  return {
    promise,
    abort: () => xhr.abort()
  };
}

// 1. Authentication
export const register = (body) => request('/api/auth/register', { method: 'POST', body });
export const login = (body) => request('/api/auth/login', { method: 'POST', body });
export const logout = () => request('/api/auth/logout', { method: 'POST' });
export const getMe = () => request('/api/auth/me');

// 2. Users & Storage
export const getMyStorage = () => request('/api/users/me/storage');
export const updateMe = (formData) => request('/api/users/me', { method: 'PUT', body: formData });
export const getUserAvatarUrl = (username) => `/api/users/${encodeURIComponent(username)}/avatar`;
export const searchUsers = (q, page = 1, limit = 30) =>
  request(`/api/users/search?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`);
export const getUserSuggestions = () => request('/api/users/suggestions');
export const getUserProfile = (username) => request(`/api/users/${encodeURIComponent(username)}`);
export const toggleFollowUser = (userId) => request(`/api/users/${userId}/follow`, { method: 'POST' });
export const getUserFollowers = (username, page = 1, limit = 30) =>
  request(`/api/users/${encodeURIComponent(username)}/followers?page=${page}&limit=${limit}`);
export const getUserFollowing = (username, page = 1, limit = 30) =>
  request(`/api/users/${encodeURIComponent(username)}/following?page=${page}&limit=${limit}`);

// 3. Media
export const getMediaLimits = () => request('/api/media/limits');
export const getMediaLibrary = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/api/media${query ? '?' + query : ''}`);
};
export const getMediaStatus = (ids) => {
  const idStr = Array.isArray(ids) ? ids.join(',') : ids;
  return request(`/api/media/status?ids=${encodeURIComponent(idStr)}`);
};
export const getMediaById = (id, token = null) =>
  request(`/api/media/${id}${token ? '?token=' + encodeURIComponent(token) : ''}`);
export const updateMedia = (id, body) => request(`/api/media/${id}`, { method: 'PATCH', body });
export const deleteMedia = (id) => request(`/api/media/${id}`, { method: 'DELETE' });
export const bulkDeleteMedia = (ids) => request('/api/media/bulk-delete', { method: 'POST', body: { ids } });

// 4. Moments
export const createMoment = (body) => request('/api/moments', { method: 'POST', body });
export const getFeedMoments = (page = 1, limit = 20) => request(`/api/moments/feed?page=${page}&limit=${limit}`);
export const getExploreMoments = (page = 1, limit = 20) => request(`/api/moments/explore?page=${page}&limit=${limit}`);
export const getUserMoments = (username, page = 1, limit = 20) =>
  request(`/api/moments/user/${encodeURIComponent(username)}?page=${page}&limit=${limit}`);
export const getOnThisDay = () => request('/api/moments/on-this-day');
export const getMomentById = (id) => request(`/api/moments/${id}`);
export const updateMoment = (id, body) => request(`/api/moments/${id}`, { method: 'PATCH', body });
export const deleteMoment = (id) => request(`/api/moments/${id}`, { method: 'DELETE' });
export const toggleMomentLike = (id) => request(`/api/moments/${id}/like`, { method: 'POST' });
export const createMomentComment = (id, text) => request(`/api/moments/${id}/comments`, { method: 'POST', body: { text } });
export const getMomentComments = (id, page = 1, limit = 30) =>
  request(`/api/moments/${id}/comments?page=${page}&limit=${limit}`);
export const deleteComment = (id) => request(`/api/comments/${id}`, { method: 'DELETE' });

// 5. Albums
export const createAlbum = (body) => request('/api/albums', { method: 'POST', body });
export const getAlbums = (page = 1, limit = 20) => request(`/api/albums?page=${page}&limit=${limit}`);
export const getUserAlbums = (username, page = 1, limit = 20) =>
  request(`/api/albums/user/${encodeURIComponent(username)}?page=${page}&limit=${limit}`);
export const getSharedAlbum = (token) => request(`/api/albums/shared/${encodeURIComponent(token)}`);
export const getAlbumById = (id, params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/api/albums/${id}${query ? '?' + query : ''}`);
};
export const updateAlbum = (id, body) => request(`/api/albums/${id}`, { method: 'PATCH', body });
export const deleteAlbum = (id) => request(`/api/albums/${id}`, { method: 'DELETE' });
export const addAlbumMedia = (id, ids) => request(`/api/albums/${id}/media`, { method: 'POST', body: { ids } });
export const removeAlbumMedia = (id, mediaId) => request(`/api/albums/${id}/media/${mediaId}`, { method: 'DELETE' });
export const reorderAlbumMedia = (id, ids) => request(`/api/albums/${id}/order`, { method: 'PUT', body: { ids } });
export const createAlbumShareToken = (id) => request(`/api/albums/${id}/share`, { method: 'POST' });
export const deleteAlbumShareToken = (id) => request(`/api/albums/${id}/share`, { method: 'DELETE' });

// 6. Notifications
export const getNotifications = (page = 1, limit = 30) => request(`/api/notifications?page=${page}&limit=${limit}`);
export const getUnreadNotificationCount = () => request('/api/notifications/unread-count');
export const markAllNotificationsRead = () => request('/api/notifications/read', { method: 'PUT' });
export const markNotificationRead = (id) => request(`/api/notifications/${id}/read`, { method: 'PUT' });

// 7. System
export const getStats = () => request('/api/stats');
export const getHealth = () => request('/api/health');

