# Stage 0: Build 1 Cleanup & Retirement Log

This document records the components and legacy code retired as part of Stage 0 during the transition from Bloomly to **Keepsake**.

## 1. Product Renaming
- Renamed project in `package.json` from `bloomly` to `keepsake`.
- Updated `README.md` title to `# Keepsake`.
- Updated server bootstrap log in `server/server.js` to announce "Keepsake server running...".

## 2. Removed `moodSticker` Features
- **User Model (`server/models/User.js`):** Removed `STICKER_ENUM`, `moodSticker` field definition, virtual `mood`, and module export of `STICKER_ENUM`. Added `storageUsedBytes` (default 0) and `avatarPath` (default null).
- **Auth Routes & Controllers (`server/routes/auth.js`, `server/controllers/authController.js`):** Removed `moodSticker` input validation and assignment on registration.
- **User Routes & Controllers (`server/routes/users.js`, `server/controllers/usersController.js`):** Removed `moodSticker` validation and field handling in profile update.
- **Formatters (`server/utils/formatters.js`):** Removed `moodSticker` property from public user, comment, and notification serializers. Updated public user schema to include `avatarUrl`, `momentsCount`, and `albumsCount`.
- **Tests (`server/tests/auth.test.js`, `server/tests/users.test.js`, `server/tests/testHelper.js`):** Removed all assertions and mock payloads referencing `moodSticker`.

## 3. Retired Old Posts Architecture (Replacing with Moments)
- **Deleted `server/models/Post.js`:** Legacy single-image post schema retired in favor of multi-item `Moment` with layout engines.
- **Deleted `server/routes/posts.js` & `server/controllers/postsController.js`:** Old post creation, feed, explore, like, and deletion endpoints removed.
- **Deleted `server/tests/posts.test.js`:** Will be replaced by comprehensive `moments.test.js` in Stage 9.
- **App Wiring (`server/app.js`):** Removed `postsRoutes` import and route mount.

## 4. Retired Old Upload Storage
- **Static File Serving (`server/app.js`):** Removed public static hosting of `/uploads`. Media will be served strictly via access-controlled streaming endpoint `/api/media/:id/file`.
- **Deleted `server/middleware/upload.js` & `server/tests/upload.test.js`:** Retired direct disk uploads to `uploads/`. Replaced by driver-backed storage and temp upload pipeline in Stage 1 & 4.
- **Cleaned `server/uploads/`:** Removed legacy SVG seed artwork files.

## 5. Retired Outdated Scripts
- **Deleted `scripts/e2e.js`:** Legacy Bloomly DOM walkthrough script.
- **Deleted `scripts/verify_phase3.js`:** Bloomly Phase 3 static verifier.
- **Deleted `scripts/walkthrough.js`:** Old HTTP walkthrough script (to be replaced with new multi-user Keepsake walkthrough in Stage 10).
- `client/` folder is left untouched as required.

