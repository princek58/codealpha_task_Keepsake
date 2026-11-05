# Keepsake API Documentation

Comprehensive reference for all backend endpoints in Keepsake, a memory-keeping social web app.

## Overview
- **Base URL:** `http://localhost:5000/api`
- **Data Format:** All requests and responses use JSON (except file uploads which use `multipart/form-data`).
- **Authentication:** JWT token stored in an `httpOnly`, `SameSite=Lax` cookie named `token`. Alternatively, a `Bearer <token>` in the `Authorization` header is supported.
- **CSRF Protection:** State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) require matching `Origin` or `Referer` headers matching `CLIENT_ORIGIN`.
- **Standard Error Response:**
  ```json
  {
    "message": "Human readable error description",
    "errors": {
      "fieldName": "Specific validation failure message"
    }
  }
  ```
  Status codes: `400` (Validation / Bad Request), `401` (Unauthenticated), `403` (Forbidden / Unauthorized), `404` (Not Found), `409` (Conflict / Duplicate), `416` (Range Not Satisfiable), `429` (Rate Limited), `500` (Server Error).

---

## Core Entities & Response Shapes

### 1. Public User
```json
{
  "id": "6728e8...",
  "username": "daisy",
  "displayName": "Daisy",
  "bio": "Keeper of little cozy moments",
  "avatarUrl": "/api/users/daisy/avatar",
  "followersCount": 14,
  "followingCount": 8,
  "momentsCount": 12,
  "albumsCount": 3,
  "isFollowing": false,
  "isMe": false,
  "createdAt": "2026-11-04T10:00:00.000Z"
}
```

### 2. Media
```json
{
  "id": "6728f1...",
  "type": "image",
  "status": "ready",
  "failureReason": null,
  "width": 1200,
  "height": 800,
  "durationSec": null,
  "takenAt": "2026-10-15T14:30:00.000Z",
  "caption": "Sunset by the lake",
  "place": "Lake Tahoe",
  "blurDataUrl": "data:image/webp;base64,UklGR...",
  "urls": {
    "thumb": "/api/media/6728f1.../file?variant=thumb",
    "display": "/api/media/6728f1.../file?variant=display",
    "video": null,
    "poster": null,
    "original": "/api/media/6728f1.../file?variant=original"
  },
  "sizeBytes": 142050
}
```
*Note: `urls.original` and `sizeBytes` are present only for the media owner.*
*Note: For token-accessed media (e.g. via shared album link), `&token=<shareToken>` is appended to all URLs.*

### 3. Moment
```json
{
  "id": "672902...",
  "title": "Autumn Afternoon",
  "caption": "Walking under golden trees with cozy tea",
  "media": [
    {
      "id": "6728f1...",
      "type": "image",
      "status": "ready",
      "width": 1200,
      "height": 800,
      "blurDataUrl": "data:image/webp;base64,...",
      "urls": {
        "thumb": "/api/media/6728f1.../file?variant=thumb",
        "display": "/api/media/6728f1.../file?variant=display",
        "video": null,
        "poster": null
      }
    }
  ],
  "layout": {
    "type": "collage",
    "template": "collage-1-2",
    "gap": 8,
    "background": "#ffffff"
  },
  "takenOn": "2026-10-15T14:30:00.000Z",
  "place": "Kyoto, Japan",
  "tags": ["autumn", "travel", "tea"],
  "author": {
    "id": "6728e8...",
    "username": "daisy",
    "displayName": "Daisy",
    "avatarUrl": "/api/users/daisy/avatar"
  },
  "likesCount": 5,
  "commentsCount": 2,
  "likedByMe": false,
  "visibility": "followers",
  "createdAt": "2026-11-04T12:00:00.000Z"
}
```
*Note: `visibility` is only included for the author.*

### 4. Album
```json
{
  "id": "672910...",
  "title": "Kyoto Trip 2026",
  "description": "Photographs and clips from our Kyoto travels",
  "cover": {
    "id": "6728f1...",
    "type": "image",
    "status": "ready",
    "urls": {
      "thumb": "/api/media/6728f1.../file?variant=thumb",
      "display": "/api/media/6728f1.../file?variant=display"
    }
  },
  "mediaCount": 24,
  "author": {
    "id": "6728e8...",
    "username": "daisy",
    "displayName": "Daisy",
    "avatarUrl": "/api/users/daisy/avatar"
  },
  "visibility": "private",
  "shared": true,
  "shareToken": "9f8a7c2b...",
  "createdAt": "2026-11-04T11:00:00.000Z",
  "updatedAt": "2026-11-04T12:30:00.000Z"
}
```
*Note: `visibility`, `shared`, and `shareToken` are only included for the album owner.*

### 5. Comment
```json
{
  "id": "672915...",
  "momentId": "672902...",
  "text": "Such a peaceful atmosphere!",
  "author": {
    "id": "6728e9...",
    "username": "willow",
    "displayName": "Willow",
    "avatarUrl": null
  },
  "createdAt": "2026-11-04T12:15:00.000Z"
}
```

### 6. Notification
```json
{
  "id": "672920...",
  "type": "like",
  "from": {
    "id": "6728e9...",
    "username": "willow",
    "displayName": "Willow",
    "avatarUrl": null
  },
  "momentId": "672902...",
  "momentPreview": "Autumn Afternoon",
  "read": false,
  "createdAt": "2026-11-04T12:16:00.000Z"
}
```

---

## Authentication Endpoints

### POST `/api/auth/register`
- **Auth:** None
- **Body:**
  - `username` (string, 3-20 chars, alphanumeric + underscores, required)
  - `email` (string, valid email, required)
  - `password` (string, min 8 chars with 1 letter & 1 number, required)
  - `displayName` (string, max 30 chars, optional)
  - `bio` (string, max 160 chars, optional)
- **Response:** `201 Created` with `{ user }` and `Set-Cookie: token=...`

### POST `/api/auth/login`
- **Auth:** None
- **Body:**
  - `email` or `username` or `identifier` (required)
  - `password` (required)
- **Response:** `200 OK` with `{ user }` and `Set-Cookie: token=...`

### POST `/api/auth/logout`
- **Auth:** None
- **Response:** `200 OK` with `{ message: "Logged out successfully" }` (clears cookie)

### GET `/api/auth/me`
- **Auth:** Protected
- **Response:** `200 OK` with `{ user }`

---

## Users & Storage Endpoints

### GET `/api/users/me/storage`
- **Auth:** Protected
- **Response:** `200 OK`
  ```json
  {
    "usedBytes": 10485760,
    "quotaBytes": 524288000,
    "percent": 2,
    "counts": {
      "images": 15,
      "videos": 2
    }
  }
  ```

### PUT `/api/users/me`
- **Auth:** Protected
- **Content-Type:** `multipart/form-data`
- **Form Fields:**
  - `displayName` (string, 1-30 chars, optional)
  - `bio` (string, max 160 chars, optional)
  - `avatar` (image file, optional, processed to 256x256 webp)
  - `removeAvatar` (boolean string `"true"`, optional)
- **Response:** `200 OK` with `{ user }`

### GET `/api/users/:username/avatar`
- **Auth:** Protected
- **Response:** `200 OK` with `Content-Type: image/webp` and cache headers (`ETag`, `Cache-Control: private, max-age=86400`). Returns `404` if user has no avatar.

### GET `/api/users/search?q=:query`
- **Auth:** Optional
- **Query:** `q` (min 2 chars), `page` (default 1), `limit` (default 30)
- **Response:** `200 OK` with `{ items: [User], page, hasMore }`

### GET `/api/users/suggestions`
- **Auth:** Protected
- **Response:** `200 OK` with `{ items: [User] }` (prioritizes 2nd degree follows)

### GET `/api/users/:username`
- **Auth:** Optional
- **Response:** `200 OK` with `{ user }` (counts reflect what viewer is allowed to see)

### POST `/api/users/:id/follow`
- **Auth:** Protected
- **Response:** `200 OK` with `{ following: boolean, followersCount: number }`

### GET `/api/users/:username/followers`
- **Auth:** Optional
- **Query:** `page`, `limit`
- **Response:** `200 OK` with `{ items: [User], page, hasMore }`

### GET `/api/users/:username/following`
- **Auth:** Optional
- **Query:** `page`, `limit`
- **Response:** `200 OK` with `{ items: [User], page, hasMore }`

---

## Media Endpoints

### POST `/api/media/upload` (and `POST /api/media`)
- **Auth:** Protected
- **Content-Type:** `multipart/form-data`
- **Form Fields:**
  - `files` (array of up to 10 files: JPG, PNG, WebP, GIF, MP4, MOV, WebM)
- **Per-File Error Handling:** Returns `{ items: [Media], errors: [{ originalName, code, message }] }`.
- **Response:** `200 OK`

### GET `/api/media/limits`
- **Auth:** None / Public
- **Response:** `200 OK` with:
  ```json
  {
    "maxImageBytes": 20971520,
    "maxVideoBytes": 157286400,
    "maxVideoSeconds": 180,
    "maxFilesPerRequest": 10,
    "maxItemsPerMoment": 20,
    "maxItemsPerAlbum": 500,
    "userQuotaBytes": 524288000,
    "allowedImageMimes": ["image/jpeg", "image/png", "image/webp", "image/gif"],
    "allowedVideoMimes": ["video/mp4", "video/quicktime", "video/webm"]
  }
  ```

### GET `/api/media`
- **Auth:** Protected (returns authenticated user's library)
- **Query:**
  - `type`: `image` or `video` (optional)
  - `from`, `to`: ISO date strings (optional)
  - `sort`: `taken` (default uploaded newest first)
  - `page`, `limit` (default 30, max 60)
- **Response:** `200 OK` with `{ items: [Media], page, hasMore }`

### GET `/api/media/status?ids=a,b,c`
- **Auth:** Protected
- **Query:** `ids` (comma-separated, max 30)
- **Response:** `200 OK` with `{ items: [Media] }`

### GET `/api/media/:id`
- **Auth:** Optional
- **Query:** `token` (optional share token)
- **Response:** `200 OK` with `{ media: Media }` if permitted; `404 Not Found` if private or unviewable.

### PATCH `/api/media/:id`
- **Auth:** Protected (owner only)
- **Body:** `caption` (max 300), `place` (max 80), `takenAt` (date or null)
- **Response:** `200 OK` with `{ media: Media }`

### DELETE `/api/media/:id`
- **Auth:** Protected (owner only)
- **Response:** `200 OK` with `{ success: true, deletedCount: 1 }`

### POST `/api/media/bulk-delete`
- **Auth:** Protected (owner only)
- **Body:** `{ ids: ["id1", "id2"] }` (max 100)
- **Response:** `200 OK` with `{ success: true, deletedCount }`

### GET `/api/media/:id/file`
- **Auth:** Optional
- **Query:**
  - `variant`: `thumb` | `display` | `video` | `poster` | `original` (default `display`)
  - `token`: Album share token if accessing via shared link
- **Notes:**
  - `variant=original` is strictly owner-only (strangers get 404).
  - Video supports HTTP `Range` requests (`206 Partial Content`) for seeking.
  - Returns `404` for missing files or unauthorized access.

---

## Moments Endpoints

### POST `/api/moments`
- **Auth:** Protected
- **Body:**
  - `media`: array of ObjectIds (1 to 20, must belong to creator, ready or processing status, no duplicates)
  - `title`: string (max 80, optional)
  - `caption`: string (max 1000, optional)
  - `layout`: object `{ type: "collage"|"grid"|"carousel", template: string, gap: number (0-24), background: string (hex) }` (defaults to grid)
  - `takenOn`: date string (optional, defaults to first media takenAt or now)
  - `place`: string (max 80, optional)
  - `tags`: array of up to 8 strings (1-24 chars, lowercase, trimmed)
  - `visibility`: `public` | `followers` | `private` (default `followers`)
- **Allowed Collage Templates:**
  - `collage-1x2`: 2 items
  - `collage-2x1`: 2 items
  - `collage-1-2`: 3 items
  - `collage-2-1`: 3 items
  - `collage-3col`: 3 items
  - `collage-2x2`: 4 items
  - `collage-1-3`: 4 items
  - `collage-2x3`: 6 items
  - `collage-3x2`: 6 items
  - `collage-1-4`: 5 items
  - `collage-3x3`: 9 items
  - `collage-mosaic`: 3 to 10 items
- **Response:** `201 Created` with `{ moment: Moment }`

### GET `/api/moments/feed`
- **Auth:** Protected
- **Query:** `page`, `limit`
- **Response:** `200 OK` with `{ items: [Moment], page, hasMore }` (shows following's public/followers moments + own)

### GET `/api/moments/explore`
- **Auth:** Optional
- **Query:** `page`, `limit`
- **Response:** `200 OK` with `{ items: [Moment], page, hasMore }` (shows public moments only)

### GET `/api/moments/user/:username`
- **Auth:** Optional
- **Query:** `page`, `limit`
- **Response:** `200 OK` with `{ items: [Moment], page, hasMore }` (filtered by viewer relationship)

### GET `/api/moments/on-this-day`
- **Auth:** Protected
- **Response:** `200 OK` with `{ groups: [{ year, moments: [Moment], media: [Media] }] }`

### GET `/api/moments/:id`
- **Auth:** Optional
- **Response:** `200 OK` with `{ moment: Moment }` (404 if not allowed)

### PATCH `/api/moments/:id`
- **Auth:** Protected (owner only)
- **Body:** `title`, `caption`, `media`, `layout`, `takenOn`, `place`, `tags`, `visibility`
- **Response:** `200 OK` with `{ moment: Moment }`

### DELETE `/api/moments/:id`
- **Auth:** Protected (owner only)
- **Response:** `200 OK` with `{ success: true, message: "Moment deleted successfully" }` (cascades comments and notifications; media stays in Library)

### POST `/api/moments/:id/like`
- **Auth:** Protected
- **Response:** `200 OK` with `{ liked: boolean, likesCount: number }`

### POST `/api/moments/:id/comments`
- **Auth:** Protected
- **Body:** `{ text: string }` (1-300 chars)
- **Response:** `201 Created` with `{ comment: Comment }`

### GET `/api/moments/:id/comments`
- **Auth:** Optional
- **Query:** `page`, `limit`
- **Response:** `200 OK` with `{ items: [Comment], page, hasMore }` (oldest first)

### DELETE `/api/comments/:id`
- **Auth:** Protected (comment author or moment author)
- **Response:** `200 OK` with `{ success: true, message: "Comment deleted successfully" }`

---

## Albums Endpoints

### POST `/api/albums`
- **Auth:** Protected
- **Body:**
  - `title`: string (1-80 chars, required)
  - `description`: string (max 500 chars, optional)
  - `visibility`: `public` | `followers` | `private` (default `private`)
  - `media`: array of ObjectIds (optional, max 500)
  - `cover`: ObjectId (optional)
- **Response:** `201 Created` with `{ album: Album }`

### GET `/api/albums`
- **Auth:** Protected
- **Query:** `page`, `limit`
- **Response:** `200 OK` with `{ items: [Album], page, hasMore }` (newest updated first)

### GET `/api/albums/user/:username`
- **Auth:** Optional
- **Query:** `page`, `limit`
- **Response:** `200 OK` with `{ items: [Album], page, hasMore }` (filtered by viewer relationship)

### GET `/api/albums/shared/:token`
- **Auth:** None (anonymous allowed)
- **Response:** `200 OK` with `{ album: Album, media: [Media] }` where media URLs carry the token; `404` if token is invalid or revoked.

### GET `/api/albums/:id`
- **Auth:** Optional
- **Query:** `token` (optional), `page` (default 1), `limit` (default 40)
- **Response:** `200 OK` with `{ album: Album, media: { items: [Media], page, hasMore } }` (404 if not allowed)

### PATCH `/api/albums/:id`
- **Auth:** Protected (owner only)
- **Body:** `title`, `description`, `visibility`, `cover`
- **Response:** `200 OK` with `{ album: Album }`

### DELETE `/api/albums/:id`
- **Auth:** Protected (owner only)
- **Response:** `200 OK` with `{ success: true, message: "Album deleted successfully" }` (media stays in Library)

### POST `/api/albums/:id/media`
- **Auth:** Protected (owner only)
- **Body:** `{ ids: ["mediaId1", "mediaId2"] }`
- **Response:** `200 OK` with `{ album: Album }`

### DELETE `/api/albums/:id/media/:mediaId`
- **Auth:** Protected (owner only)
- **Response:** `200 OK` with `{ album: Album }`

### PUT `/api/albums/:id/order`
- **Auth:** Protected (owner only)
- **Body:** `{ ids: ["mediaId2", "mediaId1"] }` (must be a valid permutation of current items)
- **Response:** `200 OK` with `{ album: Album }`

### POST `/api/albums/:id/share`
- **Auth:** Protected (owner only)
- **Description:** Generates or rotates the album's share token (24 hex characters, generated from 12 crypto random bytes).
- **Response:** `200 OK` with `{ shareToken: string, shareUrl: "/api/albums/shared/:token" }`

### DELETE `/api/albums/:id/share`
- **Auth:** Protected (owner only)
- **Response:** `200 OK` with `{ success: true, message: "Share link revoked" }`

---

## Notifications Endpoints

### GET `/api/notifications`
- **Auth:** Protected
- **Query:** `page`, `limit`
- **Response:** `200 OK` with `{ items: [Notification], page, hasMore }`

### GET `/api/notifications/unread-count`
- **Auth:** Protected
- **Response:** `200 OK` with `{ count: number }`

### PUT `/api/notifications/read`
- **Auth:** Protected
- **Response:** `200 OK` with `{ message: "All notifications marked as read" }`

### PUT `/api/notifications/:id/read`
- **Auth:** Protected (recipient only)
- **Response:** `200 OK` with `{ message: "Notification marked as read" }`

---

## System Endpoints

### GET `/api/stats`
- **Auth:** None
- **Response:** `200 OK` with `{ users: number, moments: number }` (moments counts public only, cached 60 seconds)

### GET `/api/health`
- **Auth:** None
- **Response:** `200 OK` with `{ status: "ok" }`
