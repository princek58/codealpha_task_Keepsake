# Keepsake

> **"Keep the moments that matter."**  
> A calm, chronological, memory-keeping social web app crafted for photos, video memories, collages, and shareable albums.

---

## 🌟 Overview & Philosophy

Keepsake is a social memory-keeping platform built around chronological storytelling:
- **Private-First & Chronological:** Share moments with followers or keep them private. No algorithmic manipulation or engagement tricks.
- **Media Pipeline:** High-performance runtime image auto-rotation, EXIF date extraction, webp variant generation (`display`, `thumb`, `blurDataUrl`), and background video transcoding (H.264 720p, faststart, poster generation).
- **Flexible Layouts:** Showcase memories with collages (`collage-1-2`, `collage-2x2`, `collage-mosaic`, etc.), grids, and carousels.
- **Albums & Secure Sharing:** Curate moments into albums and generate secure cryptographic share tokens to let friends and family view albums anonymously without logging in.
- **Strict Privacy & Visibility Matrix:** Owner, followers, public, and token-based access enforcement across moments, albums, and raw media streams with HTTP 206 Range seeking support.

---

## 🛠 Tech Stack (Build 1)

- **Backend:** Node.js (CommonJS), Express.js 4.21
- **Database & ODM:** MongoDB, Mongoose 8.10
- **Media Processing:** `sharp` (vips 8.18+), `ffmpeg-static`, `ffprobe-static`, `exifr`, `file-type`
- **Security:** Helmet CSP, HTTP-only JWT cookies, Same-Origin/Referer CSRF validation, NoSQL sanitization, rate limiting
- **Storage:** Pluggable storage abstraction with local disk driver and safe path resolution preventing directory traversal
- **Testing:** Jest, Supertest, `mongodb-memory-server`

---

## 📋 System Limits & Configuration

| Setting | Default Value | Description |
|---|---|---|
| `STORAGE_DIR` | `server/storage` | Root folder for media and avatar files |
| `MAX_IMAGE_MB` | `20` | Max uploaded image size (JPG, PNG, WebP, GIF) |
| `MAX_VIDEO_MB` | `150` | Max uploaded video size (MP4, MOV, WebM) |
| `MAX_VIDEO_SECONDS`| `180` | Max duration of uploaded video clips |
| `MAX_FILES_PER_REQUEST` | `10` | Max files in a single batch upload |
| `MAX_ITEMS_PER_MOMENT` | `20` | Max media items attached to a Moment |
| `MAX_ITEMS_PER_ALBUM` | `500` | Max media items in an Album |
| `USER_QUOTA_MB` | `500` | Storage quota per user account |
| `VIDEO_CONCURRENCY` | `1` | Max concurrent background video transcoding jobs |

---

## 🚀 Setup & Getting Started

### 1. Prerequisites
- **Node.js** (v18.0.0 or higher recommended, verified on v24)
- **MongoDB** (local daemon running on `localhost:27017` or a MongoDB Atlas connection URI)

### 2. Installation
```bash
git clone <repo-url> keepsake
cd bloomy
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory (see `.env.example`):
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/keepsake
JWT_SECRET=your_jwt_secret_change_in_production
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:5000
NODE_ENV=development

# Keepsake Media & Storage Configuration
STORAGE_DIR=server/storage
MAX_IMAGE_MB=20
MAX_VIDEO_MB=150
MAX_VIDEO_SECONDS=180
MAX_FILES_PER_REQUEST=10
MAX_ITEMS_PER_MOMENT=20
MAX_ITEMS_PER_ALBUM=500
USER_QUOTA_MB=500
VIDEO_CONCURRENCY=1
```

### 4. Running the Server

**Development Mode (auto-reload via nodemon):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

---

## 🧪 Testing & Verification Scripts

Keepsake includes comprehensive automated test suites and real-HTTP walkthrough simulations:

```bash
# Run full backend Jest test suite (11 suites, 68 tests)
npm test

# Run real-HTTP walkthrough script (registers users, uploads media, transcode, moments, albums, share token, cascade)
node scripts/walkthrough.js
```

---

## 📁 Repository Structure (Backend)

```
server/
├── app.js                      # Express application setup, security, route mounting
├── server.js                   # Server boot listener, boot recovery, tmp cleaner
├── config/
│   ├── index.js                # Validated environment configuration
│   └── db.js                   # Mongoose connection handler
├── models/
│   ├── User.js                 # User accounts and storage accounting
│   ├── Media.js                # Media records (variants, blurDataUrl, dimensions, takenAt)
│   ├── Moment.js               # Moments (collages, grids, carousels, tags, visibility)
│   ├── Album.js                # Albums (cover, media order, shareToken)
│   ├── Comment.js              # Comments on moments
│   └── Notification.js         # Notifications (like, comment, follow)
├── routes/
│   ├── auth.js                 # Register, login, logout, me
│   ├── users.js                # Profiles, avatar upload/stream, storage stats, follow
│   ├── media.js                # Upload, library, status, file streaming, bulk delete
│   ├── moments.js              # Feed, explore, user moments, on-this-day, comments, likes
│   ├── albums.js               # CRUD, media reorder, share token lifecycle
│   ├── comments.js             # Delete comment
│   ├── notifications.js        # Notifications list and read status
│   └── stats.js                # Cached public stats
├── controllers/                # Business logic for all routes
├── middleware/
│   ├── auth.js                 # protect and optionalAuth
│   ├── csrfCheck.js            # Same-origin state-changing check
│   ├── rateLimiters.js         # Upload, action, and auth limiters
│   ├── validate.js             # Request validator handler
│   └── errorHandler.js         # Centralized error handler
├── services/
│   ├── storage/                # Storage driver interface & local safe driver
│   ├── media/                  # Magic-bytes detection, sharp image processor, ffmpeg video processor, background queue
│   └── visibility.js           # Privacy & access control matrix
├── utils/                      # Serializers and helpers
└── tests/                      # Jest test suites
```

---

## 📄 API Documentation

For the full list of endpoints, request bodies, and response examples, refer to [API.md](API.md).

## 🌸 License

Code licensed under the ISC License.
