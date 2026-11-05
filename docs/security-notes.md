# Security Notes & Audit Review

Date: November 5, 2026

## 1. Automated Dependency Audit (`npm audit`)
An automated audit was conducted across all project dependencies:
- **Critical Severity:** 0 findings
- **High Severity:** 0 findings
- **Moderate Severity:** 2 findings (transitive devDependencies via `nodemon` -> `minimatch`)
- **Low Severity:** 6 findings (transitive devDependencies via `jest` -> `deepmerge`)

### Assessment:
All reported moderate and low advisories reside exclusively in local development tooling (`jest` and `nodemon`) and are never bundled or executed in production. No production runtime dependencies contain known vulnerabilities.

## 2. Hardened Production Security Controls
- **Path Traversal Defense:** Storage driver resolves paths using `path.relative` assertions (`storage.resolveSafePath`), preventing directory traversal attacks.
- **MIME & Magic Bytes Sniffing:** File types are validated using `file-type` header inspection, rejecting spoofed extensions (e.g. `.exe` disguised as `.png`).
- **Sanitized Execution:** All external video processing (`ffmpeg`, `ffprobe`) is invoked via `child_process.spawn` using explicit argument arrays; zero shell execution is permitted.
- **CSRF & Origin Verification:** State-changing HTTP verbs require matching `Origin` / `Referer` headers.
- **Strict Content Security Policy:** Enforced via Helmet, supporting HTTP 206 Range media streaming and self-hosted static assets.
- **Authentication & Rate Limiting:** HttpOnly cookies, bcrypt hashing, and sliding-window rate limiters across auth, upload, and action endpoints.

