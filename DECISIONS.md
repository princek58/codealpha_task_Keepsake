# Bloomly Architectural & Technical Decisions Log

Records technical decisions, rationale, and chosen alternatives throughout the build.

| Date | Phase | Decision | Rationale |
|---|---|---|---|
| 2026-11-02 | Phase 0 | Retain Vanilla JS (ES Modules) without frontend build step | Project decision in PROJECT_DECISIONS.md: simple, fast, zero toolchain friction |
| 2026-11-02 | Phase 0 | Centralize app shell in client/js/shell.js | Ensures DRY header/bottom-bar across all app pages with unified auth and unread sync |
| 2026-11-02 | Phase 0 | Use Headless Chrome with async Node execution for verification | Avoids single-threaded event loop lockup while testing live server endpoints |
