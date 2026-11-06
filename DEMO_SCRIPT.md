# Keepsake Evaluator Walkthrough & Demo Script

**Target Duration:** 3–5 minutes  
**Goal:** Demonstrate all core memory-keeping capabilities, calm design system, privacy controls, accessibility, and zero-setup demo mode.

---

## Preparation & Quickstart

In your terminal, navigate to the project directory and run:

```bash
npm run demo
```

You will see the Keepsake banner appear with credentials and direct links.
Open your browser and navigate to:  
👉 **`http://localhost:5000`**

---

## 3-Minute Evaluation Walkthrough

### Flow 1: Landing Experience & Calm Aesthetic (30s)
1. **Explore the Landing Page:**
   - Observe the calm, warm aesthetic (linen, sand, terracotta, sage).
   - Notice the complete absence of vanity metrics (no follower counts, no algorithmic ranking, no endless ad feeds).
2. **Toggle Theme:**
   - In the navigation bar, click the Theme Toggle button (or press in Settings) to switch between **Light**, **Dark**, and **Auto (System)**.
   - Notice smooth CSS variable transitions across surfaces without hard-coded color leaks.
3. **Browse Public Moments:**
   - Click **Explore** in the header or scroll down to view public chronological moments.

---

### Flow 2: Authentication & Feed Experience (30s)
1. **Log In:**
   - Click **Sign In** in the top navigation.
   - Enter credentials:
     - **Email / Username:** `clara`
     - **Password:** `Password123`
   - Click **Log In**.
2. **Home Feed:**
   - You will land on Clara's home feed (`/home.html`).
   - Observe moments posted by accounts Clara follows (`@daisy`, `@leo`, `@maya`).
   - Notice the editorial collage layouts, custom date stamps (`takenOn`), and quiet atmosphere.
   - Click on any photo to open the accessible **Lightbox viewer**. Use arrow keys (`←`, `→`) or click outside to close (`Esc`).

---

### Flow 3: Media Library & Instant Uploads (30s)
1. **Open Media Library:**
   - Click **Library** in the navigation bar (or press `G` then `L`).
   - Notice the storage quota meter showing used vs. allocated space.
2. **Upload Photos:**
   - Click **Upload Media** or drag and drop image files into the upload dropzone.
   - Watch the upload manager progress bars and real-time status updates.
   - Notice the instant generation of WebP thumbnails and preview variants with EXIF metadata stripped.

---

### Flow 4: Composing a Memory Moment (45s)
1. **Create Moment:**
   - Click the **+ New Moment** button in the navigation (or press `G` then `C`).
2. **Configure Details:**
   - **Title:** `Afternoon in the Latin Quarter`
   - **Caption:** `Old paperbacks, hot espresso, and autumn rain outside.`
   - **Date Taken (`takenOn`):** Select an authentic past date (e.g. October 14, 2024).
   - **Place:** `Paris, France`
   - **Layout:** Switch between `Editorial`, `Masonry`, `Grid`, and `Story` to preview the collage arrangement.
   - **Visibility:** Select `Friends Only` (demonstrating mutual-follow privacy masking).
3. **Publish:**
   - Click **Publish Moment**. You are redirected to the newly created memory page with its custom collage rendering.

---

### Flow 5: Curating an Album & Secret Share Link (45s)
1. **Open Albums:**
   - Navigate to **Albums** (`/albums.html` or press `G` then `A`).
2. **Create New Album:**
   - Click **Create Album**.
   - **Title:** `Summer by the Sea`
   - **Description:** `Coastal strolls and driftwood memories.`
   - **Visibility:** Select `Private`.
   - Click **Save Album**.
3. **Add Media & Reorder:**
   - Click into the album. Add items from your media library.
   - Test keyboard album reordering: select a media item, and use the `Move Left` / `Move Right` buttons to reorganize the layout.
4. **Generate Secret Link:**
   - Click **Share Album**.
   - Click **Generate Secret Link**.
   - Copy the generated 32-byte cryptographic URL (e.g. `http://localhost:5000/shared.html?token=...`).

---

### Flow 6: Verifying Privacy & Anonymous Access (30s)
1. **Open an Incognito / Private Window:**
   - Paste the secret share link copied in Flow 5.
2. **Verify Access Isolation:**
   - The shared album opens smoothly without requiring login.
   - All photos and collage layouts are fully interactive in the lightbox.
   - **Notice:** All editing controls (Add Media, Delete, Visibility Settings) are strictly hidden.
   - Try navigating to `/home.html` or `/library.html` in this incognito tab; unauthenticated users are redirected safely to the landing page with zero data leaks.

---

### Flow 7: Accessibility & Keyboard Navigation (30s)
1. **Keyboard Shortcuts:**
   - Press `?` (Shift + `/`) anywhere to bring up the Keyboard Shortcuts modal.
   - Press `Escape` to close.
   - Press `G` then `H` to navigate to Home.
   - Press `G` then `L` to navigate to Library.
   - Press `G` then `E` to navigate to Explore.
2. **A11y Audit Check:**
   - Tab through forms and modal dialogs; notice the visible, high-contrast focus rings and trap-and-restore focus behavior.
   - The entire application complies 100% with **WCAG 2.1 AA** standards (verified with `axe-core`).

---

### Flow 8: Clean Exit
In the terminal where `npm run demo` is running, press:
```bash
Ctrl + C
```
The server closes HTTP connections, terminates Mongoose, stops the in-memory database, and exits cleanly.

