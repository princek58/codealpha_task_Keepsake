# Keepsake Performance & Architecture Audit

## 1. Executive Summary
Keepsake is engineered with a **zero-framework, vanilla Web Standards architecture** designed to achieve instantaneous loads, minimal footprint, and zero runtime hydration overhead.

- **Zero Client Frameworks:** 0 React, 0 Vue, 0 Tailwind runtime. Native ES Modules and native CSS Custom Properties.
- **Critical CSS Budget:** Core styling (tokens + base + components) weighs **7.63 KB gzipped**.
- **Page Payloads:** HTML shell pages average under **4 KB gzipped**.
- **Compression:** Gzip/Brotli compression middleware active on all responses.
- **Asset Caching:** ETag and 304 Not Modified validation active on all static assets.

---

## 2. Asset Weight Breakdown

| Asset | Type | Raw Size | Gzip Size | Cache Strategy |
| :--- | :--- | :--- | :--- | :--- |
| CSS Tokens | Web Standards | 3.80 KB | 1.34 KB | ETag + Revalidation |
| CSS Base | Web Standards | 3.07 KB | 1.13 KB | ETag + Revalidation |
| CSS Components | Web Standards | 32.69 KB | 5.16 KB | ETag + Revalidation |
| CSS Pages | Web Standards | 11.88 KB | 2.39 KB | ETag + Revalidation |
| JS Shell (Nav/Drawer) | Web Standards | 33.72 KB | 7.51 KB | ETag + Revalidation |
| JS API Client | Web Standards | 9.02 KB | 2.32 KB | ETag + Revalidation |
| JS UI Components | Web Standards | 19.03 KB | 4.65 KB | ETag + Revalidation |
| JS Justified Gallery | Web Standards | 8.78 KB | 2.68 KB | ETag + Revalidation |
| JS Lightbox | Web Standards | 14.47 KB | 3.46 KB | ETag + Revalidation |
| Landing (index.html) | Web Standards | 11.98 KB | 3.62 KB | ETag + Revalidation |
| Home HTML | Web Standards | 7.65 KB | 2.42 KB | ETag + Revalidation |
| Library HTML | Web Standards | 10.66 KB | 2.89 KB | ETag + Revalidation |

---

## 3. Local Endpoint Latencies

| Endpoint | Target Metric | Measured Latency | Transfer Size | Status |
| :--- | :--- | :--- | :--- | :--- |
| `/api/health` | < 100 ms | **27.98 ms** | 0.01 KB | HTTP 200 |
| `/index.html` | < 100 ms | **2.34 ms** | 11.98 KB | HTTP 200 |
| `/home.html` | < 100 ms | **1.06 ms** | 7.65 KB | HTTP 200 |
| `/library.html` | < 100 ms | **0.97 ms** | 10.66 KB | HTTP 200 |
| `/css/tokens.css` | < 100 ms | **1.02 ms** | 3.80 KB | HTTP 200 |
| `/css/components.css` | < 100 ms | **1.15 ms** | 32.69 KB | HTTP 200 |
| `/js/api.js` | < 100 ms | **1.88 ms** | 9.02 KB | HTTP 200 |
| `/api/moments/explore?limit=10` | < 100 ms | **191.73 ms** | 19.66 KB | HTTP 200 |

---

## 4. Database Indexing Strategy

All MongoDB collections implement compound indexes tailored to primary user queries:

### `Moment` Collection
- **`{ owner: 1, createdAt: -1 }`**: Powers user profile chronologies and authenticated library feeds with zero in-memory sorting.
- **`{ visibility: 1, createdAt: -1 }`**: Powers global explore streams and public discovery filtering.
- **`{ takenOn: -1 }`**: Powers "On This Day" anniversary lookups.
- **`{ media: 1 }`**: Ensures lightning-fast reverse lookups during photo deletion and album associations.

### `Album` Collection
- **`{ owner: 1, updatedAt: -1 }`**: Powers user album dashboards sorted by recent activity.
- **`{ shareToken: 1 }`**: Unique sparse partial index ensuring instant (O(1)) resolution of anonymous secret links.
- **`{ media: 1 }`**: Optimizes album membership queries and batch image population.

### `Media` Collection
- **`{ owner: 1, createdAt: -1 }`**: High-performance pagination for the main infinite library view.
- **`{ owner: 1, takenAt: -1 }`**: Enables chronology sorting by original camera EXIF date.

### `User` Collection
- **`{ username: 1 }`**: Unique index for username lookups and profile URLs.
- **`{ email: 1 }`**: Unique index for authentication and duplicate prevention.

---

## 5. Network & Image Optimizations
1. **Multi-Variant WebP Generation:** Every image upload automatically creates responsive WebP variants (thumbnail `320x320`, display `1600x1200`) using high-performance libvips via Sharp.
2. **BlurHash / Blur Data URL:** Tiny base64 micro-previews render instantly before full imagery downloads, eliminating layout shift (CLS = 0).
3. **Lazy Loading:** All masonry grid and gallery tiles leverage native browser `loading="lazy"` and IntersectionObserver pagination.
4. **EXIF Privacy Stripping:** GPS coordinates and camera serial numbers are purged from binary files during normalization; creation timestamps are securely preserved.
