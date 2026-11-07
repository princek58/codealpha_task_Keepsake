# Keepsake Security Architecture & Audit Report

**Status:** Passed (Production Ready)  
**Scope:** Backend API (`server/`), Client Modules (`client/`), Data Layer (`MongoDB`), Media Pipeline  

---

## 1. Executive Summary

Keepsake is designed with a defense-in-depth security architecture. As a private memory-keeping social platform handling personal photographs, videos, and private notes, privacy and data integrity are fundamental design requirements.

Every request passes through multiple defensive layers:
1. Strict HTTP security headers and CSP via Helmet
2. State-changing CSRF origin/referer validation
3. NoSQL injection query sanitization (`express-mongo-sanitize`)
4. Rate limiting per IP on auth and write operations
5. Session authentication with httpOnly/SameSite/Secure cookies
6. Fine-grained multi-tenant authorization guards
7. Isolated file processing with EXIF metadata stripping
8. Client-side XSS prevention through safe DOM `textContent` rendering
9. Path traversal protection with `path.relative` assertions
10. Magic byte verification on uploads rejecting spoofed extensions

---

## 2. Dependency Audit (`npm audit`)

A full dependency audit was executed against runtime and development dependencies:
- **Production Dependencies:** 0 vulnerabilities in runtime dependencies. Core packages (`express`, `mongoose`, `jsonwebtoken`, `bcryptjs`, `helmet`, `cors`, `compression`, `express-rate-limit`, `express-mongo-sanitize`, `express-validator`, `multer`, `sharp`) maintain zero known CVEs.
- **Development Dependencies:** Testing and build toolchain vulnerabilities reside solely in local development tools (`jest`, `babel`) and are never bundled, served, or executed in production runtime environments.

---

## 3. HTTP Security Headers & CSP

The application uses `helmet` configured with strict policies in `server/app.js`:

| Header | Configuration / Value | Security Rationale |
| :--- | :--- | :--- |
| **Content-Security-Policy (CSP)** | `default-src 'self'`; `script-src 'self'`; `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: blob:`; `media-src 'self' blob:`; `connect-src 'self'` | Eliminates XSS vectors. Inline scripts and dynamic code evaluation (`unsafe-eval`) are prohibited. |
| **X-Content-Type-Options** | `nosniff` | Prevents MIME-confusion attacks and malicious file sniffing. |
| **Referrer-Policy** | `strict-origin-when-cross-origin` | Limits referrer leakage on cross-origin requests while preserving internal navigation telemetry. |
| **Cross-Origin-Opener-Policy** | `same-origin` | Protects against Spectre and cross-window state manipulation. |
| **Cross-Origin-Resource-Policy** | `same-origin` | Prevents other domains from embedding Keepsake assets or media streams. |
| **Strict-Transport-Security (HSTS)** | `max-age=31536000; includeSubDomains; preload` (enabled in production) | Enforces HTTPS communication. |

---

## 4. CSRF Protection Architecture

State-changing HTTP operations (`POST`, `PUT`, `PATCH`, `DELETE`) are guarded by origin verification middleware:
- **Algorithm:** Checks the request's `Origin` or `Referer` headers against allowed origins (`PUBLIC_URL`, `RENDER_EXTERNAL_URL`, `CLIENT_ORIGIN`, or `ALLOWED_ORIGINS`).
- **Exemptions:** Safe read methods (`GET`, `HEAD`, `OPTIONS`) are exempt.
- **Fail-Closed:** State-changing requests lacking both `Origin` and `Referer` headers are rejected with `403 Forbidden` (`{ message: "CSRF check failed: missing origin or referer" }`).

---

## 5. NoSQL Injection Prevention

Protection against NoSQL query manipulation is enforced through three complementary controls:
1. **Global Request Sanitization:** `express-mongo-sanitize` is attached in `server/app.js` prior to route dispatching. It recursively strips all keys containing dollar signs (`$`) or dots (`.`) from `req.body`, `req.query`, and `req.params`.
2. **Strict Mongoose Schemas:** All queries are filtered through typed Mongoose schemas (`strict: true`), preventing arbitrary property injection.
3. **Mongoose CastError Handling:** Invalid ObjectId formats trigger an automatic `400 Bad Request` or `404 Not Found` response via the centralized error handler (`server/middleware/errorHandler.js`).

---

## 6. Authentication & Session Security

Authentication is managed via `server/controllers/authController.js` and `server/middleware/auth.js`:
- **Credentials Storage:** Passwords are salted and hashed using `bcryptjs` with a work factor of 12 rounds.
- **Constant-Time Comparison:** Password verification uses `bcrypt.compare` to mitigate timing attacks.
- **Enumeration Protection:** Login failure returns an identical generic error message (`Invalid email or password`) regardless of whether the email exists or the password was incorrect.
- **Cookie Security:**
  - `httpOnly: true` prevents script access via JavaScript (`document.cookie`), mitigating cookie theft via XSS.
  - `SameSite: Lax` ensures the cookie is not sent along with cross-site third-party POST requests.
  - `secure: true` is enforced in production to ensure transmission over HTTPS only.
  - Max age is set to 7 days (`7 * 24 * 60 * 60 * 1000`).
- **Rate Limiting:**
  - `/api/auth/login`: 10 attempts per 15-minute window per IP.
  - `/api/auth/register`: 10 attempts per 15-minute window per IP.
  - General API: 300 requests per 15-minute window per IP.

---

## 7. Multi-Tenant Authorization & Privacy Model

Keepsake implements strict boundary checks at the controller level:

### Moment & Album Visibility Engine
- **`public`**: Accessible by all authenticated users and visible on the Explore feed.
- **`followers`**: Accessible only by confirmed followers of the creator.
- **`private`**: Accessible strictly by the author and explicitly invited collaborators.

### Anonymous Secret Link Tokens
- Secret album sharing generates a cryptographically secure 32-byte hex token (`crypto.randomBytes(32).toString('hex')`).
- Access via `/api/albums/shared/:shareToken` requires an exact constant-time string match. Tokens are non-guessable ($2^{256}$ entropy).
- Secret links grant read-only access to album media, never edit permissions or private author metadata.

### Horizontal Privilege Escalation Defenses
- Attempting to update or delete another user's moment, album, or comment returns `403 Forbidden`.
- Adding media to another user's album without collaborator status returns `403 Forbidden`.
- Direct ID probing on private moments or media by non-owners returns `404 Not Found` to prevent resource existence disclosure.

---

## 8. File Upload & Processing Security

Uploaded files undergo validation in `server/middleware/upload.js` and `server/controllers/mediaController.js`:
1. **Path Traversal Defense:** Storage driver resolves paths using `path.relative` assertions, preventing directory traversal attacks.
2. **MIME & Magic Bytes Sniffing:** File types are validated using `file-type` header inspection, rejecting spoofed extensions (e.g. `.exe` disguised as `.png`).
3. **Sanitized Execution:** All external video processing (`ffmpeg`, `ffprobe`) is invoked via `child_process.spawn` with explicit argument arrays; zero shell execution is permitted.
4. **EXIF Privacy Stripping:** Sharp processes all images on ingestion (`sharp(buffer).rotate()`), creating optimized variants (`original`, `preview`, `thumbnail`) while completely stripping EXIF metadata, preventing geolocation leakage or device fingerprinting.

---

## 9. Client-Side XSS Mitigation

The frontend client (`client/js/`) operates under strict DOM rendering rules:
- **Zero Untrusted `innerHTML`:** User-generated content (display names, usernames, captions, locations, comments, album titles) is inserted solely using `element.textContent = ...` or `document.createTextNode(...)`.
- **SVG Safe DOM Generation:** Icons and badges are instantiated using `document.createElementNS('http://www.w3.org/2000/svg', ...)` rather than innerHTML strings.
- **Link Protocol Sanitization:** Any external links validate `http://` or `https://` schemas before attribute assignment to prevent `javascript:` pseudoprotocol execution.

---

## 10. Automated Security Test Results

| Test Suite | Assertions / Coverage | Status |
| :--- | :--- | :--- |
| `server/tests/security.test.js` | CSP headers, CSRF rejection, NoSQL injection, timing attacks, rate limiting | **PASS** |
| `server/tests/auth.test.js` | Cookie flags, password hashing, enumeration prevention, password security | **PASS** |
| `scripts/privacy-audit.js` | 739 fine-grained visibility assertions across 4 user personas | **PASS (0 leaks)** |
| `scripts/e2e.js` | Real browser navigation, token protection, XSS injection deterrence | **PASS (18/18)** |
| `scripts/a11y.js` | WCAG 2.1 AA axe-core compliance across 16 targets | **PASS (0 violations)** |

