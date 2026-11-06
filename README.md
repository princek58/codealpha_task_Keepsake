# Keepsake

> **A calm, photo-first, chronological memory-keeping social web app.**  
> Keep the moments that matter — free from algorithmic ranking, vanity metrics, and noisy ads.

---

## 📸 Overview & Screenshots

Keepsake is a social space designed for slow, authentic memory preservation. Photos, videos, and journals are shared in chronological order, with flexible collage layouts, quiet interactions, and fine-grained privacy controls.

### Desktop Experience (1440px)
![Keepsake Home Feed](docs/screenshots/home-1440px.png)

### Multi-Device Responsive Gallery

| Mobile (375px) | Tablet (768px) | Desktop (1440px) |
| :---: | :---: | :---: |
| ![Mobile Feed](docs/screenshots/home-375px.png) | ![Tablet Feed](docs/screenshots/home-768px.png) | ![Desktop Library](docs/screenshots/library-1440px.png) |
| *Chronological feed & touch lightbox* | *Curated collage arrangements* | *Complete media library & quota meter* |

| Albums Collection | Moment Detail View | Secret Link Sharing |
| :---: | :---: | :---: |
| ![Albums View](docs/screenshots/albums-1440px.png) | ![Moment Detail](docs/screenshots/moment-1440px.png) | ![Shared Album](docs/screenshots/shared-1440px.png) |
| *Cover previews & drag-less reorder* | *Editorial collage & quiet comments* | *Read-only cryptographic token access* |

---

## ⚡ Quickstart

### 1. Zero-Setup Demo Mode (Recommended)
Run a single command to spin up an in-memory MongoDB database, seed 8 demo personas with realistic photos and albums, and start the app:

```bash
npm run demo
```

Open **`http://localhost:5000`** in your browser.  
Log in with test account `@clara` (password: `Password123`) or browse public moments as a guest.

### 2. Standard Production Mode
```bash
git clone <repository-url> keepsake
cd keepsake
npm install
cp .env.example .env
npm start
```

---

## 🏗 Architecture Overview

Keepsake is built without bulky client frameworks. The client uses modern native ES modules with zero build steps, while the backend leverages Node.js, Express, Sharp, and MongoDB.

```mermaid
flowchart TD
    subgraph Client["Vanilla JS Frontend (Zero Build Step)"]
        HTML["Semantic HTML5 Shells (client/*.html)"]
        CSS["Design System (tokens.css, base.css, components.css)"]
        Modules["ES Modules (api.js, ui.js, collage.js, lightbox.js)"]
        Pages["Page Controllers (client/js/pages/*.js)"]
    end

    subgraph Server["Express.js 4.21 Backend"]
        MW["Security Middleware (Helmet, CSRF Check, Mongo Sanitize, Rate Limiters)"]
        Auth["Auth Controller (JWT in httpOnly/SameSite Cookie, Bcrypt)"]
        Controllers["API Controllers (Moments, Albums, Media, Users, Notifications)"]
        Storage["Storage Abstraction Layer (Local Storage Driver)"]
    end

    subgraph MediaPipeline["Media & Privacy Pipeline"]
        Sharp["Sharp Image Processing (EXIF Stripped, WebP Variants)"]
        FFmpeg["FFmpeg Video Pipeline (H.264 Transcoding & Posters)"]
    end

    subgraph Database["MongoDB Data Layer"]
        Mongoose["Mongoose Schemas & Strict Indexes"]
    end

    HTML --> CSS
    HTML --> Modules
    Modules --> Pages
    Pages -- "JSON / Multipart (fetch)" --> MW
    MW --> Auth
    MW --> Controllers
    Controllers --> Storage
    Controllers --> MediaPipeline
    Controllers --> Mongoose
```

---

## 🗄 Entity-Relationship Diagram

```mermaid
erDiagram
    User ||--o{ Media : owns
    User ||--o{ Moment : creates
    User ||--o{ Album : curates
    User ||--o{ Comment : writes
    User ||--o{ Notification : receives
    User }o--o{ User : follows

    Moment ||--|{ Media : contains
    Moment ||--o{ Comment : has
    Moment ||--o{ User : likedBy

    Album ||--o{ Media : organizes
    Album ||--o{ User : collaborators

    User {
        ObjectId _id PK
        string username UK
        string email UK
        string passwordHash
        string displayName
        string bio
        string avatarPath
        number storageUsedBytes
        number storageQuotaBytes
        ObjectId[] following
        ObjectId[] followers
    }

    Media {
        ObjectId _id PK
        ObjectId owner FK
        string type
        string status
        string mimeType
        number sizeBytes
        number width
        number height
        object variants
        date takenOn
    }

    Moment {
        ObjectId _id PK
        ObjectId author FK
        string title
        string caption
        ObjectId[] media FK
        object layout
        string visibility
        date takenOn
        string place
        string[] tags
        ObjectId[] likes
    }

    Album {
        ObjectId _id PK
        ObjectId owner FK
        string title
        string description
        string visibility
        ObjectId[] media FK
        ObjectId cover FK
        ObjectId[] collaborators FK
        string shareToken UK
    }

    Comment {
        ObjectId _id PK
        ObjectId moment FK
        ObjectId author FK
        string text
        date createdAt
    }

    Notification {
        ObjectId _id PK
        ObjectId to FK
        ObjectId from FK
        string type
        ObjectId moment FK
        boolean read
    }
```

---

## 🎨 Design System & Philosophy

Keepsake's visual identity rejects aggressive engagement patterns and garish neon accents in favor of a quiet, tactile paper aesthetic:

- **Tokens (`client/css/tokens.css`):** Strict design tokens with zero hard-coded hex colors in component styles (enforced by `npm run audit:tokens`).
- **Color Palette:** Warm cream (`#FBF9F5`), sand canvas (`#F4EFE6`), terracotta accents (`#B4532A`), deep teal (`#2F7F79`), and charcoal ink (`#1F2A37`).
- **Typography:** Classic editorial serif headings (`Georgia`, `serif`) paired with clean, accessible sans-serif body typography.
- **Theme Modes:** Seamless Light, Dark (`#18191B`), and Auto (System Preference) support.
- **Accessibility:** 100% compliant with **WCAG 2.1 AA** color contrast and focus visibility requirements (enforced by `npm run audit:contrast` and `npm run test:a11y`).

---

## ✨ Features & Capabilities

1. **Collage Layout Engine:**
   - Arrange moments dynamically in `editorial`, `masonry`, `grid`, and `story` layouts.
   - Automatically repositions based on photo aspect ratios.
2. **Media Pipeline & Privacy:**
   - Multi-variant processing generating thumbnail (`300px`), display (`1200px`), and blur placeholder WebP images.
   - **EXIF Stripping:** Removes GPS coordinates and camera hardware identifiers on upload.
   - Video streaming with HTTP 206 partial content support.
3. **Multi-Tier Privacy & Anonymous Links:**
   - **Public:** Visible to all users and on the Explore feed.
   - **Friends Only:** Restricted to mutual followers.
   - **Private:** Restricted strictly to author and explicit collaborators.
   - **Cryptographic Share Tokens:** 32-byte secret tokens allowing anonymous, read-only album viewing without requiring account creation.
4. **Full Keyboard Navigation:**
   - `?` (Shift + `/`): Opens keyboard shortcuts cheatsheet.
   - `G` then `H`: Navigate to Home Feed.
   - `G` then `L`: Navigate to Media Library.
   - `G` then `A`: Navigate to Albums.
   - `G` then `E`: Navigate to Explore.
   - `G` then `C`: Compose New Moment.
   - `Escape`: Closes open modals, notifications drawer, and lightbox.
   - Keyboard-accessible album reordering (`Move Left` / `Move Right`).
5. **Real-Time Notification Drawer:**
   - Accessible slide-over drawer with unread badges, polling, and "Mark All as Read" actions.
6. **Account Storage Meter:**
   - Visual progress meter tracking storage utilization against account quota.

---

## 📋 API Overview

Comprehensive documentation of all 28 backend endpoints is maintained in [`API.md`](API.md).

| Category | Key Endpoints | Description |
| :--- | :--- | :--- |
| **Auth** | `POST /api/auth/register`<br>`POST /api/auth/login`<br>`POST /api/auth/logout`<br>`GET /api/auth/me` | JWT authentication via secure cookies, session retrieval, rate-limited attempts. |
| **Media** | `POST /api/media/upload`<br>`GET /api/media/:id`<br>`GET /api/media/:id/stream`<br>`DELETE /api/media/:id` | Batch media upload, variant retrieval, byte-range video streaming, quota tracking. |
| **Moments** | `GET /api/moments/feed`<br>`GET /api/moments/explore`<br>`POST /api/moments`<br>`GET /api/moments/:id`<br>`POST /api/moments/:id/like` | Chronological feeds, collage definitions, likes, privacy masking. |
| **Albums** | `GET /api/albums`<br>`POST /api/albums`<br>`POST /api/albums/:id/share-token`<br>`GET /api/albums/shared/:token` | Album curation, collaboration, cryptographic secret link sharing. |
| **Comments** | `GET /api/moments/:id/comments`<br>`POST /api/moments/:id/comments`<br>`DELETE /api/comments/:id` | Moment commenting and author moderation. |
| **Users** | `GET /api/users/:username`<br>`POST /api/users/:username/follow`<br>`PUT /api/users/profile` | Profiles, mutual-follow relationships, avatar uploads. |
| **System** | `GET /api/health`<br>`GET /api/stats` | System health check and platform statistics. |

---

## 🧪 Comprehensive Verification Scorecard

Every layer of the platform is validated by automated CI/CD test suites:

| Suite / Check | Command | Assertions / Targets | Status |
| :--- | :--- | :--- | :--- |
| **CSS Token Audit** | `npm run audit:tokens` | 0 hard-coded hex colors outside `tokens.css` | **PASS** |
| **WCAG Token Contrast** | `npm run audit:contrast` | All surface-to-text pairs exceed 4.5:1 ratio | **PASS** |
| **Responsive Viewports** | `npm run verify:responsive` | 320, 375, 768, 1024, 1440, 1920px (0 overflow) | **PASS** |
| **Backend & Scaffolding** | `npm test` | 11 suites, 70 integration tests | **PASS** |
| **Privacy & Access Control** | `npm run test:privacy` | 586 fine-grained visibility assertions | **PASS** |
| **WCAG 2.1 AA Accessibility** | `npm run test:a11y` | 16 browser targets audited with axe-core (0 violations) | **PASS** |
| **Real Browser E2E** | `npm run test:e2e` | 18 isolated Chrome navigations, uploads, token checks | **PASS** |
| **Full Regression Suite** | `npm run verify:all` | Runs all 7 checks in sequence and prints scorecard | **PASS** |

---

## 🎯 Internship Requirements Matrix

| Requirement | Category | Status | Implementation Details & Proof |
| :--- | :--- | :--- | :--- |
| **Calm Social Philosophy** | Product | **Done** | Anti-algorithmic chronological ordering, no follower vanity counts, warm paper palette. |
| **Complete Backend REST API** | Backend | **Done** | Express 4.21, Mongoose 8, 28 endpoints verified in `API.md` and `server/tests/`. |
| **File Processing & EXIF Strip** | Media | **Done** | Sharp WebP pipeline stripping GPS/device data (`server/controllers/mediaController.js`). |
| **Video Transcoding & Stream** | Media | **Done** | FFmpeg background worker with HTTP 206 range seeking (`server/services/videoProcessor.js`). |
| **Multi-Tier Privacy Matrix** | Security | **Done** | Public, Friends-only, Private, and 32-byte secret tokens (`scripts/privacy-audit.js`). |
| **Vanilla JS Architecture** | Frontend | **Done** | ES modules in `client/js/`, 0 client frameworks, 1 script per page. |
| **Collage Layout Engine** | Frontend | **Done** | Responsive editorial, masonry, grid templates in `client/js/collage.js`. |
| **Zero XSS Insertion** | Security | **Done** | Safe DOM creation and `textContent` across all templates; verified in `scripts/e2e.js`. |
| **WCAG 2.1 AA Accessibility** | A11y | **Done** | Zero axe-core violations across 16 targets (`scripts/a11y.js`, focus traps, ARIA). |
| **Zero Hardcoded Colors** | Design | **Done** | Pure token architecture in `client/css/tokens.css` verified by `scripts/audit-tokens.js`. |
| **Zero-Setup Demo Mode** | DX | **Done** | In-memory MongoDB, realistic seed data, clean banner on `npm run demo`. |
| **Production Ready Guides** | DevOps | **Done** | Full Dockerfile, Compose, Nginx, Caddy, backup guides in `DEPLOY.md`. |

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).
