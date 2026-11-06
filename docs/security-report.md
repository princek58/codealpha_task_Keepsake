# Keepsake Security Architecture & Audit Report

**Date:** November 2026  
**Status:** Passed (Production Ready)  
**Scope:** Backend API (`server/`), Client Modules (`client/`), Data Layer (`MongoDB`), Media Pipeline  

---

## 1. Executive Summary

Keepsake is designed with a defense-in-depth security architecture. As a private memory-keeping social platform handling personal photographs, videos, and private notes, privacy and data integrity are fundamental design requirements.

Every request passes through multiple defensive layers:
1. Strict HTTP security headers and CSP via Helmet
2. State-changing CSRF origin/referer validation
3. NoSQL injection query sanitization
4. Rate limiting per IP on auth and write operations
5. Session authentication with httpOnly/SameSite cookies
6. Fine-grained multi-tenant authorization guards
7. Isolated file processing with EXIF metadata stripping
8. Client-side XSS prevention through safe DOM textContent rendering

A comprehensive automated privacy audit (`scripts/privacy-audit.js`) verifying 586 assertions across 4 simulated user personas confirms zero unauthorized data leaks across all visibility tiers.

---

## 2. Dependency Audit (`npm audit`)

A full dependency audit was executed against the project dependencies:

```bash
npm audit --omit=dev
```

### Production Dependencies
- **Status:** **0 vulnerabilities found in runtime production dependencies.**
- Core runtime packages (`express`, `mongoose`, `jsonwebtoken`, `bcryptjs`, `helmet`, `cors`, `compression`, `express-rate-limit`, `express-mongo-sanitize`, `express-validator`, `multer`, `sharp`) are up-to-date and maintain zero known CVEs.

### Development Dependencies
- 14 low-to-moderate vulnerabilities are present solely within the testing toolchain (`jest` and its transitive `@babel/*` dependencies). These tools are used exclusively during CI/CD test runs and are never bundled, served, or executed in production runtime environments.

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

State-changing HTTP operations (`POST`, `PUT`, `PATCH`, `DELETE`) are guarded by custom origin verification middleware (`server/middleware/csrf.js`):

- **Algorithm:** Checks the request's `Origin` or `Referer` headers against `CLIENT_ORIGIN` (configured via environment variable, defaulting to `http://localhost:5000`).
- **Exemptions:** Safe read methods (`GET`, `HEAD`, `OPTIONS`) are exempt.
- **Fail-Closed:** State-changing requests lacking both `Origin` and `Referer` headers are rejected with `403 Forbidden` (`{ message: "CSRF check failed: missing origin or referer" }`).
- **Benefit:** Provides complete protection against Cross-Site Request Forgery without requiring stateful token synchronization in Single Page Applications.

---

## 5. NoSQL Injection Prevention

Protection against NoSQL query manipulation is enforced through three complementary controls:

1. **Global Request Sanitization:** `express-mongo-sanitize` is attached in `server/app.js` prior to route dispatching. It recursively strips all keys containing dollar signs (`$`) or dots (`.`) from `req.body`, `req.query`, and `req.params`.
2. **Strict Mongoose Schemas:** All queries are filtered through typed Mongoose schemas (`strict: true`), preventing arbitrary property injection.
3. **Mongoose CastError Handling:** Invalid ObjectId formats (e.g. `{ $ne: null }` passed as an ID) trigger an automatic `400 Bad Request` or `404 Not Found` response via the centralized error handler (`server/middleware/errorHandler.js`).

---

## 6. Authentication & Session Security

Authentication is managed via `server/controllers/authController.js` and `server/middleware/auth.js`:

- **Credentials Storage:** Passwords are never stored in plaintext. They are salted and hashed using `bcryptjs` with a work factor of 12 rounds (`salt = 12`).
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
- **`friends`**: Accessible only by mutual follows (reciprocal follower relationship).
- **`private`**: Accessible strictly by the author and explicitly invited collaborators.

### Anonymous Secret Link Tokens
- Secret album sharing generates a cryptographically secure 32-byte hex token (`crypto.randomBytes(32).toString('hex')`).
- Access via `/api/albums/shared/:shareToken` requires an exact constant-time string match. Tokens are non-guessable ($2^{256}$ entropy).
- Secret links grant read-only access to album media, never edit permissions or private author metadata.

### Horizontal Privilege Escalation Defenses
- Attempting to update or delete another user's moment, album, or comment returns `403 Forbidden`.
- Adding media to another user's private album without collaborator status returns `403 Forbidden`.
- Direct ID probing on private moments or media by non-owners returns `404 Not Found` to prevent resource existence disclosure.

---

## 8. File Upload & Processing Security

Uploaded files undergo validation in `server/middleware/upload.js` and `server/controllers/mediaController.js`:

1. **Storage Isolation:** Uploaded raw files are buffered in memory and processed into `uploads/` outside the web root. Files are never exposed via directory browsing.
2. **MIME & Extension Whitelist:**
   - Allowed Images: `image/jpeg` (`.jpg`, `.jpeg`), `image/png` (`.png`), `image/webp` (`.webp`), `image/gif` (`.gif`).
   - Allowed Videos: `video/mp4` (`.mp4`), `video/quicktime` (`.mov`), `video/webm` (`.webm`).
   - Disallowed files (e.g. `.exe`, `.html`, `.svg`, `.sh`) are rejected with `400 Bad Request`.
3. **Payload Size Caps:**
   - Images capped at 10 MB.
   - Videos capped at 50 MB.
4. **EXIF Privacy Stripping:**
   - Sharp processes all images on ingestion (`sharp(buffer).rotate()`), creating optimized variants (`original`, `preview`, `thumbnail`) while completely stripping EXIF metadata, preventing geolocation leakage or device fingerprinting.

---

## 9. Client-Side XSS Mitigation

The frontend client (`client/js/`) operates under strict DOM rendering rules:

- **Zero Untrusted `innerHTML`:** User-generated content (display names, usernames, captions, locations, comments, album titles) is inserted solely using `element.textContent = ...` or `document.createTextNode(...)`.
- **SVG Safe DOM Generation:** Icons and badges are instantiated using `document.createElementNS('http://www.w3.org/2000/svg', ...)` rather than innerHTML strings.
- **Link Protocol Sanitization:** Any external links validate `http://` or `https://` schemas before attribute assignment to prevent `javascript:` pseudoprotocol execution.
- **Verification:** Verified via `scripts/e2e.js` test 16 (`Prevents XSS script execution in captions, comments, and locations`).

---

## 10. Automated Security Test Results

| Test Suite | Assertions / Coverage | Status |
| :--- | :--- | :--- |
| `server/tests/security.test.js` | CSP headers, CSRF rejection, NoSQL injection, timing attacks, rate limiting | **PASS** |
| `server/tests/auth.test.js` | Cookie flags, password hashing, enumeration prevention, password security | **PASS** |
| `scripts/privacy-audit.js` | 586 fine-grained visibility assertions across 4 user personas | **PASS (0 leaks)** |
| `scripts/e2e.js` | Real browser navigation, token protection, XSS injection deterrence | **PASS (18/18)** |
| `scripts/a11y.js` | WCAG 2.1 AA axe-core compliance across 16 targets | **PASS (0 violations)** |

