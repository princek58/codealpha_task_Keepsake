# Bloomly 🌸

> **"Where little moments bloom."**  
> A calm, chronological, sticker-based social web app crafted with love, pastel aesthetics, and mindful interaction design.

![Bloomly Landing Desktop](docs/screenshots/landing_1440.png)

---

## 🌟 Overview & Core Philosophy

Bloomly is designed to feel like a warm hug. In contrast to modern social networks driven by dopamine loops, opaque ranking algorithms, follower count anxiety, and endless doomscrolling, Bloomly offers:

- **Strictly Chronological Feed:** See blooms from friends in the exact order they were planted. No algorithm picks what you feel.
- **12 Original SVG Mood Stickers:** Express emotions naturally with handcrafted SVG stickers (`flower`, `sprout`, `sparkle`, `heart`, `star`, `cloud`, `moon`, `sun`, `cherry`, `butterfly`, `plant`, `smiley_blob`).
- **Wholesome Interactions:** "Plant" instead of follow (with animated sprout-to-flower morph), heart bursts on blooms, soft toast alerts, and gentle modal sheets.
- **Warm Pastel Design System:** Built on soft cream (`#FFF8F3`), peach (`#FFCDB2`), petal pink (`#FFB3C7`), mint (`#CDEFE2`), and high-contrast deep plum (`#4A2C4F`) typography for soothing readability.
- **Strict Token Discipline:** 100% of frontend styling references CSS variables from `client/css/tokens.css`. Zero hardcoded hex colors in application CSS.
- **Zero Heavy Frameworks:** Pure vanilla HTML5, CSS3, and modern JavaScript (ES Modules). Smooth animations powered by GSAP and ScrollTrigger.
- **Accessible & Responsive:** Fully responsive from 320px mobile to 1920px desktop with keyboard shortcuts (`N`, `/`, `G then H`, `Esc`, `?`), skip links, and ARIA landmarks.
- **Production-Grade Security:** Hardened with Helmet Content-Security-Policy, Origin/Referer CSRF protection, stored-XSS sanitization, httpOnly SameSite cookies, and express-rate-limit.

---

## 📸 Responsive Visual Gallery

Every page is responsive across 320px mobile, tablet, and desktop viewports. Automated high-resolution screenshots are captured directly by our headless Chrome verification pipeline in `docs/screenshots/`:

### 1. Landing Page
*Staggered hero reveal, animated SVG hero flower, floating stickers with parallax hover, and live community stats.*

| Desktop (1440px) | Tablet (768px) | Mobile (375px) |
|---|---|---|
| ![Landing Desktop](docs/screenshots/landing_1440.png) | ![Landing Tablet](docs/screenshots/landing_768.png) | ![Landing Mobile](docs/screenshots/landing_375.png) |

---

### 2. Home Feed
*Interactive composer card with character counter and photo preview, chronological feed cards, optimistic likes with heart bursts, and garden sidebar.*

| Desktop (1440px) | Tablet (768px) | Mobile (375px) |
|---|---|---|
| ![Feed Desktop](docs/screenshots/feed_1440.png) | ![Feed Tablet](docs/screenshots/feed_768.png) | ![Feed Mobile](docs/screenshots/feed_375.png) |

---

### 3. Explore & Search
*Greenhouse explore with Fresh Blooms tab, Gardeners search tab, 300ms debounced input with request cancellation (`AbortController`), and "Plant" toggle buttons.*

| Desktop (1440px) | Tablet (768px) | Mobile (375px) |
|---|---|---|
| ![Explore Desktop](docs/screenshots/explore_1440.png) | ![Explore Tablet](docs/screenshots/explore_768.png) | ![Explore Mobile](docs/screenshots/explore_375.png) |

---

### 4. Gardener Profile
*Cozy cover banner with floating stickers, avatar with mood sticker badge, joined date, follower/planted counts, Blooms/Garden/Planted tabs, and modal profile editor.*

| Desktop (1440px) | Tablet (768px) | Mobile (375px) |
|---|---|---|
| ![Profile Desktop](docs/screenshots/profile_1440.png) | ![Profile Tablet](docs/screenshots/profile_768.png) | ![Profile Mobile](docs/screenshots/profile_375.png) |

---

### 5. Single Bloom & Comments
*Individual bloom detail view, comment composer with live counter, and oldest-first comment thread with author delete controls.*

| Desktop (1440px) | Tablet (768px) | Mobile (375px) |
|---|---|---|
| ![Post Desktop](docs/screenshots/post_1440.png) | ![Post Tablet](docs/screenshots/post_768.png) | ![Post Mobile](docs/screenshots/post_375.png) |

---

### 6. Authentication Page
*Single card with smooth Login/Register tab switching, password show/hide toggle, live password strength meter, and floating sticker animations.*

| Desktop (1440px) | Tablet (768px) | Mobile (375px) |
|---|---|---|
| ![Auth Desktop](docs/screenshots/auth_1440.png) | ![Auth Tablet](docs/screenshots/auth_768.png) | ![Auth Mobile](docs/screenshots/auth_375.png) |

---

### 7. Custom 404 "Lost in the Garden"
*Cozy illustrated error page with return navigation to feed and explore.*

| Desktop (1440px) | Tablet (768px) | Mobile (375px) |
|---|---|---|
| ![404 Desktop](docs/screenshots/404_1440.png) | ![404 Tablet](docs/screenshots/404_768.png) | ![404 Mobile](docs/screenshots/404_375.png) |

---

## 🛠 Tech Stack

### Backend
- **Runtime:** Node.js (CommonJS)
- **Framework:** Express.js 4.21
- **Database & ODM:** MongoDB, Mongoose 8.10
- **Authentication:** `bcryptjs` (salt rounds: 12), `jsonwebtoken` with `httpOnly`, `sameSite: 'lax'` cookies
- **Security Middleware:** `helmet` (with custom Content-Security-Policy), `express-mongo-sanitize`, `express-rate-limit`, `cors`, custom Origin/Referer CSRF check
- **File Uploads:** `multer` (restricted to jpeg, png, webp, gif under 2MB)
- **Testing:** Jest, Supertest, `mongodb-memory-server`

### Frontend
- **Markup & Styling:** Vanilla HTML5, semantic tags, pure CSS3 design system with CSS custom properties (`tokens.css`, `base.css`, `components.css`, `pages.css`)
- **Scripting:** Vanilla JavaScript with ES Modules (`api.js`, `app.js`, `ui.js`, `stickers.js`, `animations.js`, `validators.js`, `landing.js`)
- **Typography:** Google Fonts (`Fredoka`, `Nunito`, `Caveat`)
- **Motion:** GSAP 3.12.5 and ScrollTrigger via CDN with full `prefers-reduced-motion` compliance

---

## 🚀 Quickstart & Setup

### 1. Prerequisites
- **Node.js** (v18.0.0 or higher recommended, verified on v24)
- **MongoDB** (local daemon running on `localhost:27017` or a MongoDB Atlas connection URI)

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone <repo-url> bloomy
cd bloomy
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory (or copy from `.env.example`):
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/bloomly
JWT_SECRET=cozy_bloomly_super_secret_jwt_key_2026
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:5000
NODE_ENV=development
```

### 4. Seed Demo Data
Populate the database with 8 demo gardeners, garden connections (follows), 25 cozy blooms with pastel uploads, hearts, and comments:
```bash
npm run seed
```

### 5. Running the Application

**Development Mode (auto-reload via nodemon):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```
Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## 👥 Demo Gardeners & Logins

All demo accounts share the password: **`Password123`**

| Handle | Name | Email | Mood Sticker | Bio |
|---|---|---|---|---|
| `@daisy_bloom` | Daisy | `daisy@bloomly.app` | 🌸 `flower` | Planting quiet moments and afternoon chamomile tea 🌼 |
| `@sunny_sprout` | Sunny | `sunny@bloomly.app` | 🌱 `sprout` | Windowsill herb gardener, sourdough enthusiast, morning light seeker. |
| `@lavender_sky` | Lavender | `lavender@bloomly.app` | ☁️ `cloud` | Rainy afternoons, vintage notebooks, and soft piano chords. |
| `@rose_petal` | Rose | `rose@bloomly.app` | 💖 `heart` | Baking cinnamon scones and sharing gentle words. |
| `@starry_moth` | Orion | `orion@bloomly.app` | ⭐ `star` | Night sky watcher, midnight sketches, and astronomy books. |
| `@cherry_blossom` | Sakura | `sakura@bloomly.app` | 🍒 `cherry` | Watercolor artist painting tiny wildflowers. |
| `@gentle_blob` | Mochi | `mochi@bloomly.app` | 😊 `smiley_blob` | Soft cardigans, warm oat milk, and taking things one day at a time. |
| `@fern_green` | Fern | `fern@bloomly.app` | 🌿 `plant` | Repotting ferns, woodland walks, and moss appreciation. |

---

## 🧪 Test Suite & Verification

Bloomly features comprehensive multi-layered automated testing:

### 1. Automated Jest Test Suite (62 passing tests)
Runs in-memory MongoDB tests across 8 test suites without touching external databases:
```bash
npm test
```
*Coverage includes auth endpoints, user profiles, follow toggles, feed & explore pagination, blooms creation/deletion, comments, notifications, stats caching, image upload validation, CSRF checks, and stored-XSS sanitization.*

### 2. Design Token Audit (0 hardcoded hex colors)
Ensures every CSS file in `client/css/` adheres to design tokens without rogue hex values:
```bash
npm run audit:tokens
```

### 3. Full Headless Chrome E2E Walkthrough (CDP)
Starts a real server, launches Headless Chrome with native Chrome DevTools Protocol, executes the entire user walkthrough (landing → register/login → feed → publish bloom → like → explore & search → profile edit → post detail & comment → 404 → logout), and generates 21 fresh screenshots:
```bash
npm run test:e2e
```

### 4. One-Stop Master Verification
Runs token audit, full test suite, and verification pipeline in one command:
```bash
npm run verify:all
```

---

## ⌨️ Global Keyboard Shortcuts

Bloomly supports mindful desktop navigation:

| Key | Action |
|---|---|
| `N` | Open "New Bloom" composer modal |
| `/` | Focus global search bar |
| `G` then `H` | Go to Home feed |
| `Esc` | Close any active modal, notifications panel, or lightbox |
| `?` | Show Keyboard Shortcuts help modal |

---

## 🛡 Security & Hardening Highlights

1. **Content-Security-Policy (CSP):** Helmet configured with strict policies:
   - Scripts restricted to `'self'` and trusted CDN (`cdnjs.cloudflare.com` for GSAP).
   - Styles restricted to `'self'` and `'unsafe-inline'` for Google Fonts and dynamic themes.
   - Fonts from `'self'` and `fonts.gstatic.com`.
   - Images allowed from `'self'`, `data:`, and `blob:`.
2. **CSRF Mitigation:** State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) verified via `server/middleware/csrfCheck.js` using `Origin` / `Referer` headers against allowed hosts, returning `403 Forbidden` for foreign origins.
3. **Stored-XSS Sanitization:** All user-generated text (blooms, comments, display names, bios) is safely escaped with `textContent` DOM binding and utility escaping before rendering. Verified with automated payloads (`<script>`, `<img onerror>`) in `server/tests/security.test.js`.
4. **Credential Protection:** Passwords hashed with bcrypt cost factor 12. JWT stored exclusively in `httpOnly`, `sameSite: 'lax'` cookies, inaccessible to client JavaScript.
5. **Rate Limiting:** Dedicated rate limiters for registration (10/15m), login (10/15m), post creation (30/15m), and general API traffic.

---

## 📋 API Summary

For detailed schemas and examples, see [API.md](API.md).

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Create account and set auth cookie | No |
| `POST` | `/api/auth/login` | Sign in with email or username | No |
| `POST` | `/api/auth/logout` | Clear auth cookie | Yes |
| `GET` | `/api/auth/me` | Fetch authenticated user data | Yes |
| `GET` | `/api/stats` | Public community counts (cached 60s) | No |
| `GET` | `/api/users/search?q=` | Search gardeners by handle or display name | No |
| `GET` | `/api/users/suggestions` | Suggested gardeners | Yes |
| `GET` | `/api/users/:username` | Public profile details | No |
| `GET` | `/api/users/:username/followers` | Paginated list of followers | No |
| `GET` | `/api/users/:username/following` | Paginated list of followed users | No |
| `PUT` | `/api/users/me` | Update bio, display name, mood sticker, avatar | Yes |
| `POST` | `/api/users/:id/follow` | Toggle follow (Plant / Unplant) | Yes |
| `POST` | `/api/posts` | Plant a new bloom (text and/or image) | Yes |
| `GET` | `/api/posts/feed` | Chronological feed of followed gardeners | Yes |
| `GET` | `/api/posts/explore` | Public global explore feed | No |
| `GET` | `/api/posts/user/:username` | Blooms planted by a specific gardener | No |
| `GET` | `/api/posts/:id` | Single bloom detail | No |
| `DELETE` | `/api/posts/:id` | Prune (delete) own bloom | Yes |
| `POST` | `/api/posts/:id/like` | Toggle heart on a bloom | Yes |
| `POST` | `/api/posts/:id/comments` | Add comment to a bloom | Yes |
| `GET` | `/api/posts/:id/comments` | List comments (oldest first) | No |
| `DELETE` | `/api/comments/:id` | Delete comment (author or post owner) | Yes |
| `GET` | `/api/notifications` | Paginated notifications list | Yes |
| `GET` | `/api/notifications/unread-count` | Unread notifications count badge | Yes |
| `PUT` | `/api/notifications/read` | Mark all notifications as read | Yes |
| `PUT` | `/api/notifications/:id/read` | Mark individual notification as read | Yes |

---

## 📁 Repository Structure

```
bloomy/
├── client/
│   ├── index.html              # Landing page (hero, features, community stats)
│   ├── auth.html               # Login & Register tabbed portal
│   ├── feed.html               # Chronological home feed with live composer
│   ├── explore.html            # Greenhouse explore & debounced gardener search
│   ├── profile.html            # Gardener profile (own & others, edit modal)
│   ├── post.html               # Single bloom view & comments thread
│   ├── 404.html                # Custom "Lost in the Garden" 404 page
│   ├── styleguide.html         # Interactive design system & component viewer
│   ├── favicon.svg             # Bloomly SVG favicon
│   ├── css/
│   │   ├── tokens.css          # Design tokens (colors, typography, spacing, shadows)
│   │   ├── base.css            # CSS reset, typography rules, accessibility
│   │   ├── components.css      # Buttons, cards, modals, toasts, navbars, tabs
│   │   └── pages.css           # Page-specific layouts and responsive grids
│   ├── js/
│   │   ├── api.js              # Fetch wrapper with error handling & auth credentials
│   │   ├── app.js              # Unified app shell, navbar, tabbar, notifications, shortcuts
│   │   ├── ui.js               # Component builders (cards, avatars, toasts, modals)
│   │   ├── stickers.js         # 12 handcrafted original SVG stickers library
│   │   ├── animations.js       # GSAP & particle animation helpers (heart bursts)
│   │   ├── validators.js       # Client form validation rules & password strength meter
│   │   └── landing.js          # Landing page GSAP animations & stats fetching
│   └── assets/
│       └── stickers/           # Raw SVG stickers
├── server/
│   ├── server.js               # Main HTTP listener & DB connection init
│   ├── app.js                  # Express app setup, security middleware, static hosting
│   ├── config/
│   │   └── db.js               # Mongoose connection handler
│   ├── models/
│   │   ├── User.js             # User schema with stickers enum & indexes
│   │   ├── Post.js             # Bloom schema with text, image, likes
│   │   ├── Comment.js          # Comment schema
│   │   └── Notification.js     # Notification schema (like, comment, follow)
│   ├── routes/
│   │   ├── auth.js             # Auth endpoints
│   │   ├── users.js            # User profile, follow, search routes
│   │   ├── posts.js            # Bloom CRUD, feed, explore, like routes
│   │   ├── comments.js         # Comment routes
│   │   ├── notifications.js    # Notification routes
│   │   └── stats.js            # Public cached community stats endpoint
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── usersController.js
│   │   ├── postsController.js
│   │   ├── commentsController.js
│   │   ├── notificationsController.js
│   │   └── statsController.js
│   ├── middleware/
│   │   ├── auth.js             # JWT verification middleware
│   │   ├── validate.js         # Express-validator error handler
│   │   ├── upload.js           # Multer configuration with MIME & size checks
│   │   ├── csrfCheck.js        # Origin/Referer CSRF protection
│   │   ├── rateLimiters.js     # Endpoint-specific rate limiting
│   │   └── errorHandler.js     # Centralized operational error handler
│   ├── utils/
│   │   ├── formatters.js       # Safe public user & post serializers
│   │   ├── fileHelper.js       # Upload file deletion utility
│   │   └── notificationHelper.js # Safe notification trigger
│   ├── uploads/                # User uploaded images directory
│   └── tests/                  # Automated Jest test suite
│       ├── setup.js            # In-memory MongoDB lifecycle
│       ├── testHelper.js       # Test user & cookie fixtures
│       ├── auth.test.js
│       ├── users.test.js
│       ├── posts.test.js
│       ├── comments.test.js
│       ├── notifications.test.js
│       ├── upload.test.js
│       ├── stats.test.js
│       └── security.test.js    # CSRF & stored-XSS verification
├── docs/
│   ├── audit.md                # Project audit log
│   └── screenshots/            # 21 high-res responsive screenshots
├── scripts/
│   ├── seed.js                 # Database seeder (8 gardeners, 25 blooms)
│   ├── e2e.js                  # Headless Chrome E2E runner via native CDP
│   ├── e2e_runner.js           # CLI hook for npm run test:e2e
│   ├── audit_tokens.js         # CSS token enforcement validator
│   ├── verify_phase3.js        # Static asset & DOM sanity checker
│   ├── verify_all.js           # Master verification suite
│   └── walkthrough.js          # CLI HTTP multi-user simulation
├── API.md                      # Comprehensive REST API documentation
├── PROJECT_DECISIONS.md        # Single source of truth & architectural decisions
├── package.json
└── README.md
```

---

## 🌸 License

Built for the Bloomly Social App development initiative. Code licensed under the ISC License. Hand-drawn sticker designs and cozy vibes are free to brighten your day.
