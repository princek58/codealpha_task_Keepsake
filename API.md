# Bloomly API Documentation

Comprehensive reference for all backend endpoints in Bloomly.

## Overview
- **Base URL:** `http://localhost:5000/api`
- **Data Format:** All requests and responses use JSON (except file uploads which use `multipart/form-data`).
- **Authentication:** JWT token stored in an `httpOnly`, `SameSite=Lax` cookie named `token`. Alternatively, a `Bearer <token>` in the `Authorization` header is supported for clients unable to use cookies.
- **Error Format:**
  ```json
  {
    "message": "Human readable error description",
    "errors": {
      "fieldName": "Specific validation failure message"
    }
  }
  ```
  Status codes: `400` (Validation), `401` (Unauthenticated), `403` (Forbidden / Unauthorized), `404` (Not Found), `409` (Conflict / Duplicate), `429` (Rate Limited), `500` (Server Error).

---

## Response Shapes

### Public User Shape
```json
{
  "id": "65b...",
  "username": "daisy_bloom",
  "displayName": "Daisy",
  "bio": "Gardening little moments",
  "avatar": "/uploads/random_hex.png",
  "moodSticker": "flower",
  "followersCount": 12,
  "followingCount": 5,
  "postsCount": 8,
  "isFollowing": false,
  "isMe": false,
  "createdAt": "2026-11-01T20:00:00.000Z"
}
```

### Post Shape
```json
{
  "id": "65c...",
  "text": "Morning bloom in my garden!",
  "image": "/uploads/random_hex.jpg",
  "author": {
    "id": "65b...",
    "username": "daisy_bloom",
    "displayName": "Daisy",
    "avatar": "/uploads/avatar.png",
    "moodSticker": "flower"
  },
  "likesCount": 4,
  "commentsCount": 2,
  "likedByMe": true,
  "createdAt": "2026-11-01T20:10:00.000Z"
}
```

### Comment Shape
```json
{
  "id": "65d...",
  "postId": "65c...",
  "text": "This flower is so pretty!",
  "author": {
    "id": "65e...",
    "username": "rose_petal",
    "displayName": "Rose",
    "avatar": "",
    "moodSticker": "heart"
  },
  "createdAt": "2026-11-01T20:15:00.000Z"
}
```

### Notification Shape
```json
{
  "id": "65f...",
  "type": "like",
  "from": {
    "id": "65e...",
    "username": "rose_petal",
    "displayName": "Rose",
    "avatar": ""
  },
  "postId": "65c...",
  "postPreview": "Morning bloom in my garden!",
  "read": false,
  "createdAt": "2026-11-01T20:20:00.000Z"
}
```

### Paginated List Shape
```json
{
  "items": [],
  "page": 1,
  "hasMore": false
}
```

---

## 1. Health
### `GET /api/health`
Check server health.
- **Auth:** None
- **Response (200):**
  ```json
  { "status": "ok" }
  ```

---

## 2. Authentication

### `POST /api/auth/register`
Create a new user account.
- **Auth:** None (Strict rate limit: 10 per 15 min)
- **Request Body (JSON):**
  ```json
  {
    "username": "daisy_bloom",
    "email": "daisy@example.com",
    "password": "Password123",
    "displayName": "Daisy",
    "bio": "Growing blossoms",
    "moodSticker": "flower"
  }
  ```
- **Response (201):** Sets `token` cookie.
  ```json
  {
    "message": "Registration successful",
    "user": { ... }
  }
  ```
- **Errors:** `400` (Validation), `409` (Username or email already in use), `429` (Rate limit).

### `POST /api/auth/login`
Log into an existing account.
- **Auth:** None (Strict rate limit: 10 per 15 min)
- **Request Body (JSON):**
  ```json
  {
    "email": "daisy@example.com",
    "password": "Password123"
  }
  ```
- **Response (200):** Sets `token` cookie.
  ```json
  {
    "message": "Login successful",
    "user": { ... }
  }
  ```
- **Errors:** `401` (`"Invalid email or password"`), `429` (Rate limit).

### `POST /api/auth/logout`
Clear the authentication cookie.
- **Auth:** None
- **Response (200):** Clears `token` cookie.
  ```json
  { "message": "Logged out successfully" }
  ```

### `GET /api/auth/me`
Retrieve the authenticated user's own profile.
- **Auth:** Required
- **Response (200):**
  ```json
  {
    "user": { ... }
  }
  ```
- **Errors:** `401` (Authentication required).

---

## 3. Users

### `GET /api/users/search?q=:query&page=:page&limit=:limit`
Search users by username or display name.
- **Auth:** Optional
- **Query Params:**
  - `q` (required, string min 2 chars)
  - `page` (optional, default 1)
  - `limit` (optional, default 10, max 30)
- **Response (200):** `{ items: [PublicUser], page: 1, hasMore: false }`
- **Errors:** `400` (Search query too short).

### `GET /api/users/suggestions`
Get up to 6 user recommendations for the current user (excluding self and already followed users, prioritizing second-degree connections then newest users).
- **Auth:** Required
- **Response (200):**
  ```json
  {
    "items": [PublicUser]
  }
  ```

### `GET /api/users/:username`
Get public profile of a user with counts (`followersCount`, `followingCount`, `postsCount`, `isFollowing`, `isMe`).
- **Auth:** Optional
- **Response (200):**
  ```json
  {
    "user": { ...PublicUser }
  }
  ```
- **Errors:** `404` (User not found).

### `GET /api/users/:username/followers`
List followers of a user.
- **Auth:** Optional
- **Query Params:** `?page=1&limit=10`
- **Response (200):** `{ items: [PublicUser], page: 1, hasMore: false }`
- **Errors:** `404` (User not found).

### `GET /api/users/:username/following`
List users followed by a user.
- **Auth:** Optional
- **Query Params:** `?page=1&limit=10`
- **Response (200):** `{ items: [PublicUser], page: 1, hasMore: false }`
- **Errors:** `404` (User not found).

### `PUT /api/users/me`
Update current user profile.
- **Auth:** Required
- **Content-Type:** `multipart/form-data` or `application/json`
- **Fields:**
  - `displayName` (optional, string 1-30 chars)
  - `bio` (optional, string max 160 chars)
  - `moodSticker` (optional, enum value)
  - `avatar` (optional, image file: jpg/png/webp/gif <= 2MB)
  - `removeAvatar` (optional boolean, `"true"` to remove current avatar)
- **Response (200):** `{ user: { ...PublicUser } }`
- **Errors:** `400` (Validation failure).

### `POST /api/users/:id/follow`
Toggle follow/unfollow for a user.
- **Auth:** Required (Action rate limited)
- **Response (200):**
  ```json
  {
    "following": true,
    "followersCount": 5
  }
  ```
- **Errors:** `400` (Cannot follow yourself, invalid ID), `404` (User not found).

---

## 4. Posts

### `POST /api/posts`
Create a new bloom.
- **Auth:** Required (Action rate limited)
- **Content-Type:** `multipart/form-data` or `application/json`
- **Fields:**
  - `text` (optional, string max 500 chars)
  - `image` (optional, image file <= 2MB)
  - *At least one of `text` or `image` is required.*
- **Response (201):** `{ post: { ...Post } }`
- **Errors:** `400` (Text or image is required, text too long).

### `GET /api/posts/feed`
Feed of posts from users the current user follows plus their own posts, newest first.
- **Auth:** Required
- **Query Params:** `?page=1&limit=10`
- **Response (200):** `{ items: [Post], page: 1, hasMore: false }`

### `GET /api/posts/explore`
All posts across the platform, newest first.
- **Auth:** Optional
- **Query Params:** `?page=1&limit=10`
- **Response (200):** `{ items: [Post], page: 1, hasMore: false }`

### `GET /api/posts/user/:username`
Posts authored by a specific user (supports username or user ID).
- **Auth:** Optional
- **Query Params:** `?page=1&limit=10`
- **Response (200):** `{ items: [Post], page: 1, hasMore: false }`
- **Errors:** `404` (User not found).

### `GET /api/posts/:id`
Get a single post by ID.
- **Auth:** Optional
- **Response (200):** `{ post: { ...Post } }`
- **Errors:** `404` (Post not found).

### `DELETE /api/posts/:id`
Delete a post (only allowed for the author). Cascades deletion of associated comments, notifications, and uploaded image.
- **Auth:** Required
- **Response (200):** `{ "message": "Post deleted successfully" }`
- **Errors:** `403` (Not authorized to delete this post), `404` (Post not found).

### `POST /api/posts/:id/like`
Toggle like/unlike on a post.
- **Auth:** Required (Action rate limited)
- **Response (200):**
  ```json
  {
    "liked": true,
    "likesCount": 3
  }
  ```
- **Errors:** `404` (Post not found).

---

## 5. Comments

### `POST /api/posts/:id/comments`
Add a comment to a post.
- **Auth:** Required (Action rate limited)
- **Request Body (JSON):**
  ```json
  {
    "text": "Such a cozy post!"
  }
  ```
- **Response (201):** `{ comment: { ...Comment } }`
- **Errors:** `400` (Text required, max 300 chars), `404` (Post not found).

### `GET /api/posts/:id/comments`
List comments for a post, oldest first.
- **Auth:** Optional
- **Query Params:** `?page=1&limit=10`
- **Response (200):** `{ items: [Comment], page: 1, hasMore: false }`
- **Errors:** `404` (Post not found).

### `DELETE /api/comments/:id`
Delete a comment. Allowed for the comment author OR the post author.
- **Auth:** Required
- **Response (200):** `{ "message": "Comment deleted successfully" }`
- **Errors:** `403` (Not authorized to delete this comment), `404` (Comment not found).

---

## 6. Notifications

### `GET /api/notifications`
Get notifications for the authenticated user, newest first.
- **Auth:** Required
- **Query Params:** `?page=1&limit=10`
- **Response (200):** `{ items: [Notification], page: 1, hasMore: false }`

### `GET /api/notifications/unread-count`
Get total unread notification count.
- **Auth:** Required
- **Response (200):**
  ```json
  { "count": 2 }
  ```

### `PUT /api/notifications/read`
Mark all notifications for the authenticated user as read.
- **Auth:** Required
- **Response (200):** `{ "message": "All notifications marked as read" }`

### `PUT /api/notifications/:id/read`
Mark a single notification as read.
- **Auth:** Required
- **Response (200):** `{ "message": "Notification marked as read" }`
- **Errors:** `404` (Notification not found).

