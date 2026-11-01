# Bloomly - Project Decisions (LOCKED)

CodeAlpha Full Stack Internship, Task 2: Mini Social Media Platform.

Tagline: "Where little moments bloom."

---

## 1. Name and concept
- **Name:** Bloomly
- **Idea:** a cozy, cute social space. A post is called a **Bloom**, a like is a **Heart**, following someone is **Planting** them in your garden, and your followers are your **Garden**. This wording keeps the UI memorable and gives all the animation a reason to exist.
- **Scope:** exactly the task requirements (profiles, posts and comments, like/follow, auth, database for users/posts/comments/followers) plus polish (explore, search, image upload, notifications-lite). No extra heavy modules.

## 2. Stack
| Layer | Choice |
|---|---|
| Frontend | HTML, CSS, vanilla JavaScript (as the task asks) |
| Animation | GSAP (+ ScrollTrigger) via CDN, CSS keyframes, SVG |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Auth | JWT in httpOnly cookie + bcrypt |
| Uploads | multer (avatar + post image, size/type limited) |

## 3. Design system

### Palette (soft, warm, easy on the eyes)
| Role | Color | Hex |
|---|---|---|
| Background | Cream | #FFF8F3 |
| Surface | Milk white | #FFFFFF |
| Primary | Blush pink | #FFB3C7 |
| Primary strong (buttons, hearts) | Berry | #FF6F91 |
| Secondary | Lavender | #D9C8FF |
| Accent 1 | Peach | #FFCDB2 |
| Accent 2 | Mint | #CDEFE2 |
| Accent 3 | Butter | #FFF0B3 |
| Text | Deep plum | #4A2C4F |
| Muted text | Mauve | #8E7391 |

Rules: no pure black, no pure white page background, gradients only between neighbouring pastels, soft pink-tinted shadows (never grey).

### Typography
- Headings and logo: **Fredoka** (round, friendly)
- Body: **Nunito**
- Handwritten accents (captions, sticker labels): **Caveat**

### Shape language
- Big radius (20-28px) on cards, pill buttons, circular avatars with a pastel ring.
- Thick soft borders (2px, slightly darker pastel) to give a sticker-like feel.
- Blob-shaped backgrounds behind sections.

### Stickers (all original SVG, no copyrighted characters)
Heart, star, sparkle, flower, cloud, moon, smiley blob, butterfly, bow, cherry, tiny house plant. Used as floating decor on landing, empty states, loaders, badges and profile cover. Users can pick a sticker as their profile "mood".

## 4. Animation plan (high class, but light on performance)
**Landing**
- Hero: staggered text reveal, floating stickers with gentle parallax following the cursor, a blooming flower that opens on load.
- Scroll sections: ScrollTrigger reveals, cards tilting in, marquee of sample blooms.
- One big CTA button with magnetic hover and a heart-burst on click.

**App**
- Page transitions: soft fade + slide.
- Skeleton shimmer loaders instead of spinners.
- Feed cards stagger in; new bloom drops in with a bounce.
- Heart: pop + particle burst + count rolls up.
- Follow ("Plant"): button morphs into a sprout, then a flower.
- Comments: slide open with spring, new comment fades in.
- Toasts: sticker-style notifications sliding from top.
- Empty states: animated sticker + friendly message.
- Respect `prefers-reduced-motion`.

## 5. UI / UX decisions
- Layout: top pill navbar (logo, search, Home / Explore / Profile, new Bloom button). Mobile: bottom tab bar.
- Home feed: composer card on top, feed of people you follow, "Suggested gardeners" side card.
- Explore: all blooms + user search.
- Profile: cover with stickers, avatar, bio, counts (Blooms / Garden / Planted), Plant/Unplant button, tab for blooms.
- Post detail: comments in a slide-up panel.
- Forms: inline validation, clear errors, show/hide password.
- Fully responsive (mobile first), keyboard accessible, good contrast on plum text.

## 6. Pages
1. `index.html` Landing (hero + features + CTA)
2. `auth.html` Login / Register (one page, animated switch)
3. `feed.html` Home
4. `explore.html` Explore + search
5. `profile.html` Profile (own and others, edit profile)
6. `post.html` Single bloom + comments

## 7. Database
- **User:** username (unique), email (unique), passwordHash, displayName, bio, avatar, mood sticker, followers[], following[], createdAt
- **Post:** author, text, image, likes[], commentsCount, createdAt
- **Comment:** post, author, text, createdAt
- **Notification (lite):** to, from, type (like / comment / follow), post, read, createdAt

## 8. API
| Area | Endpoints |
|---|---|
| Auth | POST /api/auth/register, POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me |
| Users | GET /api/users/:username, PUT /api/users/me, POST /api/users/:id/follow (toggle), GET /api/users/search?q=, GET /api/users/suggestions |
| Posts | POST /api/posts, GET /api/posts/feed, GET /api/posts/explore, GET /api/posts/user/:id, GET /api/posts/:id, DELETE /api/posts/:id, POST /api/posts/:id/like (toggle) |
| Comments | POST /api/posts/:id/comments, GET /api/posts/:id/comments, DELETE /api/comments/:id |
| Notifications | GET /api/notifications, PUT /api/notifications/read |

## 9. Security
bcrypt hashing, JWT in httpOnly + SameSite cookie, helmet, rate limiting on auth, input validation (express-validator), mongo-sanitize, XSS-safe rendering (textContent, never raw innerHTML for user text), upload type/size limits, ownership checks on delete/edit, CORS locked to own origin, secrets only in .env.

## 10. Folder structure
```
bloomly/
├── client/
│   ├── index.html  auth.html  feed.html  explore.html  profile.html  post.html
│   ├── css/  (tokens.css, base.css, components.css, pages.css, animations.css)
│   ├── js/   (api.js, auth.js, feed.js, explore.js, profile.js, post.js, ui.js, animations.js)
│   └── assets/ (stickers/*.svg, fonts if self-hosted)
├── server/
│   ├── server.js
│   ├── config/db.js
│   ├── models/ (User, Post, Comment, Notification)
│   ├── routes/ (auth, users, posts, comments, notifications)
│   ├── controllers/
│   ├── middleware/ (auth, validate, upload, errorHandler)
│   └── uploads/
├── .env.example
├── package.json
├── PROJECT_DECISIONS.md
└── README.md
```

## 11. Work plan (big phases, fewer prompts)
| Phase | Work | Done when |
|---|---|---|
| 1 | Project setup, MongoDB connection, all models, auth (register/login/logout/me), security middleware | Can register and login via API |
| 2 | Users, follow, posts, likes, comments, feed/explore, search, notifications APIs | All endpoints tested |
| 3 | Design system (tokens, components, sticker SVGs) + Landing page with hero animation | Landing looks final |
| 4 | Auth page, Feed, Explore, Profile, Post pages wired to the API | Full user flow works |
| 5 | Animation and micro-interaction pass, skeletons, toasts, empty states, mobile polish | Everything feels smooth |
| 6 | Security review, bug testing, seed demo data, README, screenshots | Ready to submit |

## 12. End-to-end user flow
Landing -> Register/Login -> Feed (empty state suggests people) -> Explore and search -> open a profile -> Plant (follow) -> their blooms appear in Feed -> Heart and comment -> notification shows up -> edit own profile -> logout.

## 13. Open items
- Submission date: to be shared
- Document line about how much of the task is required: to be shared (current scope already covers every listed feature)
