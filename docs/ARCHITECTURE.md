# Keepsake Technical Specification & Architecture

This document is the definitive technical specification and single source of truth for **Keepsake**, a calm, editorial, memory-keeping social web application.

---

## 1. Executive Summary & Overview
Keepsake is a chronological social web app crafted for preserving and sharing personal moments, photos, videos, collages, and curated albums. It rejects algorithmic manipulation, endless scrolling addiction, and vanity engagement metrics.

---

## 2. Technology Stack & Tenets
- **Backend:** Node.js CommonJS, Express, Mongoose, MongoDB.
- **Media Processing:** `sharp` (images), `ffmpeg-static` / `ffprobe-static` (video transcoding and metadata inspection via `child_process.spawn`), `file-type` (magic byte validation), `exifr` (EXIF timestamp parsing).
- **Frontend:** Vanilla HTML5, CSS3 (Custom Properties / Design Tokens), modern JavaScript (ES Modules). No heavy JS frameworks. GSAP + ScrollTrigger loaded deferred from CDN as an enhancement with graceful CSS fallbacks.
- **Typography:** Fraunces (editorial headings), Manrope (UI & body text), Caveat (accent hand-written touches).
- **Execution Safety:** Zero shell strings for external binaries (`spawn` with argument arrays only). Native Windows file locking resilience (`sharp.cache(false)` + atomic fallbacks).

---

## 3. Product Vision & Principles
1. **Calm & Editorial:** Warm paper backgrounds, clear typography, generous spacing, and photo-first presentation.
2. **Chronological & Intentional:** Content is ordered by when it happened or was published. No black-box recommendation feeds.
3. **Private by Default:** Strict visibility boundaries (`public`, `followers`, `private`). Media files inherit privacy from their moment/album attachments or owner credentials.
4. **No Vanity Metrics:** No global like counts displayed publicly to fuel comparison. Moments track likes quietly for author notifications only.
5. **Human-Style Code:** No leftover debug logs, no AI markers/TODOs, and clean test-backed implementations.

---

## 4. Design Tokens & Visual Language

### Base Palette
- **Paper:** `#F7F3EC` (Primary canvas background)
- **White:** `#FFFFFF` (Surface, cards, high-contrast panels)
- **Sand:** `#EDE4D3` (Secondary surface, borders, muted backdrops)
- **Ink:** `#1F2A37` (Primary typography and sharp accents)
- **Stone:** `#5F6B7A` (Secondary typography, metadata, borders)
- **Terracotta:** `#B4532A` (Warm primary interactive accent, primary buttons)
- **Teal:** `#2F7F79` (Secondary interactive accent, focus rings, links)
- **Sage:** `#A9B99B` (Success badges, soft natural accents)
- **Mustard:** `#E0A53B` (Highlights, warm alerts, badges)
- **Slate Blue:** `#4C6A92` (Subtle informative elements)
- **Brick:** `#B3261E` (Destructive actions, error states)
- **Charcoal:** `#14171C` (Full-screen lightbox background, deep contrast)

### Typography Scale (Fluid Clamp)
- Headings: `font-family: 'Fraunces', Georgia, serif;`
- Body/UI: `font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;`
- Accents: `font-family: 'Caveat', cursive;`

### Shadows & Radii
- Neutral rgba shadows using Ink tones (no pink or harsh black casts).
- Card radii: `10px` to `16px`. Buttons: `8px` to `9999px` (pill).

---

## 5. Security & Storage Guardrails
- **JWT & Cookies:** `httpOnly`, `SameSite=Lax`, secure in production.
- **CSRF Defense:** Origin/Referer matching against `CLIENT_ORIGIN` for state-changing HTTP verbs (`POST`, `PUT`, `PATCH`, `DELETE`).
- **CSP Headers:** Helmet configured for safe media playback, Range requests, and CDN scripts.
- **Safe Path Traversal Protection:** All storage paths resolved with boundary checks (`storage.resolveSafePath`).
- **Quota Enforced:** User quota tracked atomically via `$inc storageUsedBytes`.

---

## 6. Data Models & Indexes

### User
- `username`: unique, 3-20 chars, lowercase.
- `email`: unique, lowercase.
- `password`: bcrypt hashed.
- `displayName`: string, max 30 chars.
- `bio`: string, max 160 chars.
- `avatarPath`: string (relative storage path, 256x256 WebP).
- `storageUsedBytes`: number, default 0.

### Media
- `owner`: ObjectId ref User (indexed).
- `type`: `image` | `video`.
- `status`: `processing` | `ready` | `failed`.
- `failureReason`: string or null.
- `originalName`: string.
- `mime`: string (detected via magic bytes).
- `sizeBytes`: total sum of stored variants.
- `width`, `height`: numbers.
- `durationSec`: number (video).
- `takenAt`: Date (extracted from EXIF or fallback).
- `caption`, `place`: strings.
- `blurDataUrl`: 16px base64 WebP preview.
- `paths`: `{ original, display, thumb, video, poster }`.

### Moment
- `owner`: ObjectId ref User (indexed).
- `title`: max 80 chars.
- `caption`: max 1000 chars.
- `media`: Array of 1-20 Media ObjectIds (ordered).
- `layout`: `{ type: "collage"|"grid"|"carousel", template: string, gap: number (0-24), background: string (hex) }`. Default is `grid`.
- `takenOn`: Date.
- `place`: string.
- `tags`: up to 8 lowercase strings.
- `visibility`: `public` | `followers` | `private` (default `followers`).
- `likes`: Array of User ObjectIds.
- `commentsCount`: number.

### Album
- `owner`: ObjectId ref User (indexed).
- `title`: 1-80 chars.
- `description`: max 500 chars.
- `cover`: Media ObjectId or null.
- `media`: Array of Media ObjectIds (ordered, max 500).
- `visibility`: `public` | `followers` | `private` (default `private`).
- `shareToken`: String or null (24 hex characters, unique sparse partial filter index).

---

## 7. Media & Upload API
Endpoints strictly follow `API.md`:
- `POST /api/media/upload` (and `POST /api/media`): Multipart file upload (`files` field, up to 10 files). Individual file validation and processing with independent error responses.
- `GET /api/media/limits`: Returns upload and platform limits (`maxImageBytes`, `maxVideoBytes`, `maxVideoSeconds`, `maxFilesPerRequest`, `maxItemsPerMoment`, `maxItemsPerAlbum`, `userQuotaBytes`, `allowedImageMimes`, `allowedVideoMimes`).
- `GET /api/media`: Returns user's library with filtering (`type`, `from`, `to`, `sort`, `page`, `limit`).
- `GET /api/media/status`: Polling endpoint for media status (`?ids=id1,id2`).
- `GET /api/media/:id`: Metadata details (404 if private/unviewable).
- `PATCH /api/media/:id`: Update caption, place, takenAt.
- `DELETE /api/media/:id` & `POST /api/media/bulk-delete`: Owner-only deletion with full cascade.
- `GET /api/media/:id/file`: Access-controlled file streaming:
  - Query parameters: `variant=thumb|display|video|poster|original`, `token=<shareToken>`.
  - `variant=original` is restricted to owner only.
  - Video supports HTTP 206 `Range` partial content requests.
  - Token access enables viewing media belonging to a shared album.

---

## 8. Visibility & Access Matrix
- **Moment & Album Viewability:**
  - Owner: Always viewable.
  - Follower: Viewable if `visibility` is `public` or `followers`.
  - Stranger: Viewable if `visibility` is `public`.
  - Anonymous: Viewable only via valid Album `shareToken`.
- **Media File Viewability:**
  - Owner: Always viewable (including `original` variant).
  - Others: Viewable only if the media is attached to at least one Moment or Album the viewer has permission to view.
  - Token: Viewable if media belongs to the album associated with a valid `shareToken`.

---

## 9. Albums API & Share Tokens
- `POST /api/albums`: Create album.
- `GET /api/albums`: List user's albums.
- `GET /api/albums/user/:username`: List public/followers albums.
- `GET /api/albums/:id`: Album details with paginated media items.
- `PATCH /api/albums/:id`, `DELETE /api/albums/:id`: Owner operations.
- `POST /api/albums/:id/media`, `DELETE /api/albums/:id/media/:mediaId`, `PUT /api/albums/:id/order`: Item management.
- `POST /api/albums/:id/share`: Generates or rotates the 24 hex character share token (`crypto.randomBytes(12).toString('hex')`).
- `DELETE /api/albums/:id/share`: Revokes the token, causing future token requests to return 404.
- `GET /api/albums/shared/:token`: Read-only public access to the album and its media.

---

## 10. Moments & Layouts
Moments display media collections in three distinct layout formats:
1. **Grid:** Responsive justified or uniform grid of items with fluid aspect ratios.
2. **Carousel:** Horizontal scroll-snap slider with swipe, navigation dots, and arrow controls.
3. **Collage:** High-editorial structured grid using 12 predefined CSS grid templates:
   - `collage-1x2` (2 items), `collage-2x1` (2 items)
   - `collage-1-2` (3 items), `collage-2-1` (3 items), `collage-3col` (3 items)
   - `collage-2x2` (4 items), `collage-1-3` (4 items)
   - `collage-1-4` (5 items)
   - `collage-2x3` (6 items), `collage-3x2` (6 items)
   - `collage-3x3` (9 items)
   - `collage-mosaic` (3-10 items)

---

## 11. Media Processing Pipeline
1. **Magic Bytes:** Inspected via `file-type`. Unsupported formats and HEIC files rejected immediately (`UNSUPPORTED_HEIC`).
2. **Images:** Auto-rotated from EXIF orientation, metadata/GPS stripped for WebP display and thumb variants, capture timestamp extracted with `exifr`, 16px blur thumbnail generated.
3. **Videos:** Probed via `ffprobe`, transcoded via `ffmpeg` to 720p H.264 CRF 26 faststart with AAC audio, 1s poster extracted, blur thumbnail generated. Concurrency limited in-process.

---

## 12. Notification & Interaction Rules
- Like toggles: Notifications created on like, deleted on unlike; never sent for self-likes. Duplicate likes do not create duplicate notifications.
- Comments: Cascade deleted when parent moment is deleted.
- Avatar: Processed to 256x256 WebP square, cached with ETag.

---

## 13. Client Architecture & Folder Layout
```
client/
├── assets/
│   ├── brand/       # Keepsake logo, wordmark, and favicons
│   ├── demo/        # Curated showcase photo/video assets for landing page
│   ├── icons/       # Original 24px SVG stroke icons
│   └── stickers/    # 12 original palette stickers
├── css/
│   ├── tokens.css   # Design tokens: palette, typography clamps, radii, scrims
│   ├── base.css     # Modern reset, typography, focus rings, base styles
│   ├── components.css # Reusable UI components (buttons, cards, badges, nav)
│   └── pages.css    # Page layouts, feeds, collages, lightboxes, galleries
├── js/
│   ├── animations.js# Motion helpers, reduced-motion fallbacks
│   ├── api.js       # Typed fetch client, structured errors, upload progress
│   ├── collage-templates.js # Grid definitions for all 12 collage templates
│   ├── collage.js   # Collage layout renderer, canvas PNG export
│   ├── gallery.js   # Justified gallery layout engine and timeline grouping
│   ├── guard.js     # Auth route guard and redirection logic
│   ├── icons.js     # SVG icon and sticker rendering helpers
│   ├── lightbox.js  # Accessible full-screen media viewer
│   ├── media-url.js # Media file variant URL builder with token support
│   ├── shell.js     # Navigation shell, mobile drawer, notification drawer
│   ├── ui.js        # Safe DOM builders, toasts, modals, formatters
│   ├── upload-manager.js # Upload queue, validation, status polling
│   └── pages/       # Page-specific controllers
│       ├── album.js
│       ├── albums.js
│       ├── auth.js
│       ├── explore.js
│       ├── home.js
│       ├── landing.js
│       ├── library.js
│       ├── moment-new.js
│       ├── moment.js
│       ├── profile.js
│       ├── settings.js
│       └── shared.js
├── tests/           # Jest + jsdom client unit test suites
├── 404.html         # Editorial 404 error page
├── album.html       # Album detail & media grid page
├── albums.html      # Curated albums index
├── auth.html        # Authentication (sign in / register)
├── explore.html     # Public explore feed
├── home.html        # Chronological personal feed
├── index.html       # Editorial landing page with showcase & video
├── library.html     # User media library and timeline view
├── moment-new.html  # Multi-media moment creation flow
├── moment.html      # Single moment detail with comments & likes
├── playground.html  # Developer component & template testbed
├── profile.html     # User profile and memory collection
├── settings.html    # Profile editing and preference controls
├── shared.html      # Anonymous secret-link shared album viewer
└── styleguide.html  # Interactive design system & component catalog
```

---

## 14. Testing & Verification Standards
- **Backend Tests:** 100% pass rate across all test suites in `server/tests/`.
- **Client Tests:** Unit testing via Jest & jsdom for client layout calculation, collage template mapping, upload queue logic, and safe element rendering.
- **Design Tokens Audit:** `npm run audit:tokens` verifying zero hard-coded colors outside `tokens.css` and SVGs.
- **Contrast Audit:** `npm run audit:contrast` verifying WCAG AA compliance across all palette pairs.
- **Visual Verification:** Browser inspection at 375px, 768px, and 1440px with zero console warnings, zero horizontal overflow, and complete accessibility support.

---

## 15. Repository Structure (Two Levels Deep)
```
keepsake/
├── .env.example
├── .gitignore
├── LICENSE
├── README.md
├── package-lock.json
├── package.json
├── render.persistent.yaml
├── render.yaml
├── client/
│   ├── 404.html
│   ├── album.html
│   ├── albums.html
│   ├── assets/
│   ├── auth.html
│   ├── css/
│   ├── explore.html
│   ├── favicon.png
│   ├── favicon.svg
│   ├── home.html
│   ├── index.html
│   ├── js/
│   ├── library.html
│   ├── moment-new.html
│   ├── moment.html
│   ├── playground.html
│   ├── profile.html
│   ├── settings.html
│   ├── shared.html
│   ├── styleguide.html
│   └── tests/
├── demo-bundle/
│   ├── bundle.json
│   └── media/
├── demo-media/
│   ├── CREDITS.md
│   ├── README.md
│   ├── manifest.json
│   ├── photos/
│   └── videos/
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── DEMO_SCRIPT.md
│   ├── DEPLOY.md
│   ├── PERFORMANCE.md
│   ├── SECURITY.md
│   └── images/
├── scripts/
│   ├── a11y.js
│   ├── audit-contrast.js
│   ├── audit-tokens.js
│   ├── build-demo-bundle.js
│   ├── build-landing-assets.js
│   ├── capture-screenshots.js
│   ├── check-images.js
│   ├── demo.js
│   ├── e2e.js
│   ├── fetch-demo-media.js
│   ├── privacy-audit.js
│   ├── seed.js
│   ├── verify-responsive.js
│   └── verify_all.js
└── server/
    ├── app.js
    ├── config/
    ├── controllers/
    ├── middleware/
    ├── models/
    ├── routes/
    ├── server.js
    ├── services/
    ├── storage/
    ├── tests/
    ├── uploads/
    └── utils/
```
