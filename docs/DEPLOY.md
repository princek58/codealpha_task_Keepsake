# Keepsake Deployment Guide

This guide describes how to deploy **Keepsake** to [Render](https://render.com) using Infrastructure-as-Code Blueprints. The repository includes two ready-to-use blueprint specifications:
1. **`render.yaml` (Default - Free Demo Mode):** Zero-cost deployment on Render's free tier with automated demo bundle restore on every cold start.
2. **`render.persistent.yaml` (Persistent SSD Mode):** Starter tier deployment featuring a persistent SSD disk (`/var/data`) for permanent user uploads and 24/7 uptime.

> [!NOTE]
> Pricing, free tier limits, and compute specifications are governed by Render and MongoDB Atlas and may change over time. Review [render.com/pricing](https://render.com/pricing) and [mongodb.com/pricing](https://www.mongodb.com/pricing) for the latest terms.

---

## 1. Comparing Deployment Modes

| Feature | Free Demo Mode (`render.yaml`) | Persistent Disk Mode (`render.persistent.yaml`) |
| :--- | :--- | :--- |
| **Render Plan** | `free` ($0 / month) | `starter` ($7 / month) |
| **Disk Storage** | Ephemeral (`/tmp/keepsake-storage`) | 1 GB Persistent SSD Disk ($0.25 / GB / mo) |
| **Inactivity Sleep** | Spins down after 15 min of inactivity | Always awake (24/7 continuous uptime) |
| **Cold Start** | ~30–50 seconds on initial wake-up | Instant response (no cold start delay) |
| **Data Retention** | Ephemeral files reset on sleep; demo data auto-restores | All user photos, videos, and avatars persist across restarts |
| **Upload Limits** | 10 MB photo, 25 MB video (30s max), 100 MB quota | 20 MB photo, 150 MB video (180s max), 500 MB quota |
| **Recommended For** | Demos, portfolio reviews, evaluation | Real-world personal or group memory keeping |

---

## 2. Step-by-Step Blueprint Deployment

### Step 1: Push Repository to GitHub
Ensure your repository is pushed to your GitHub account:
```bash
git push origin main
```

### Step 2: Set Up MongoDB Atlas
Keepsake requires a MongoDB database. MongoDB Atlas provides a generous free tier (M0):
1. Sign in or create an account at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Create a free shared cluster (e.g. M0 sandbox in your closest region).
3. Under **Security → Network Access**, click **Add IP Address** and enter `0.0.0.0/0` (Allow Access from Anywhere).  
   *Why: Render's free outbound IP addresses are dynamically assigned and not fixed.*
4. Under **Security → Database Access**, create a database user (e.g. `keepsake_app`) with a secure password and `Read and write to any database` privilege.
5. Click **Connect → Drivers (Node.js)** to copy your connection string. Include your chosen database name (e.g. `keepsake`):
   ```text
   mongodb+srv://keepsake_app:<PASSWORD>@cluster0.abcde.mongodb.net/keepsake?retryWrites=true&w=majority
   ```

### Step 3: Deploy via Render Dashboard
1. Log in to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** in the top navigation bar and select **Blueprint**.
3. Connect your GitHub repository (`keepsake`).
4. Blueprint File Selection:
   - For **Free Demo Mode**, leave the default path: `render.yaml`.
   - For **Persistent Disk Mode**, enter the blueprint path: `render.persistent.yaml`.
5. Enter Environment Variables:
   - When prompted for `MONGODB_URI`, paste your MongoDB Atlas connection string from Step 2.
   - `JWT_SECRET` is automatically generated with high-entropy cryptographic randomness (`generateValue: true`).
6. Click **Apply**. Render will create the web service, provision resources, and trigger the build.

---

## 3. What to Expect on First Deploy

1. **Build Phase (~1.5 – 2.5 minutes):**
   Render runs `npm ci --omit=dev`. This installs only production dependencies (`express`, `mongoose`, `sharp`, `ffmpeg-static`, etc.), skipping dev packages. Pre-compiled native binaries for Linux (glibc) are resolved automatically.
2. **Boot Phase (~15 – 30 seconds):**
   - Express connects to MongoDB.
   - If `RECONCILE_STORAGE_ON_BOOT=true`, storage reconciliation verifies disk state.
   - If `DEMO_MODE=true` and `SEED_DEMO_ON_BOOT=true`, the demo bundle restores 8 personas, 28 moments, and 10 albums.
   - Express binds to `0.0.0.0:${PORT}` and listens for incoming requests.
3. **Health Check:**
   Render sends a `GET /api/health` request. Once the app reports `status: "ok"` and `database: "connected"`, Render marks the service as **Live**.
4. **Assigned URL:**
   Your app is accessible at `https://<service-name>.onrender.com`.

---

## 4. Custom Domains & Configuration

### Adding a Custom Domain
1. In your Render Dashboard, open your `keepsake` web service.
2. Go to **Settings → Custom Domains** and click **Add Custom Domain**.
3. Enter your domain name (e.g., `memories.yourdomain.com`).
4. In your DNS provider (Cloudflare, Namecheap, Route 53), add the `CNAME` or `ALIAS` record provided by Render.
5. In Render's **Environment** tab, update:
   - `CLIENT_ORIGIN`: `https://memories.yourdomain.com`
   - `PUBLIC_URL`: `https://memories.yourdomain.com`
   - (Optional) `ALLOWED_ORIGINS`: `https://memories.yourdomain.com,https://keepsake.onrender.com`

---

## 5. Ongoing Operations & Logs

- **Auto-Deploy on Push:** Pushing new commits to your connected GitHub branch automatically triggers a zero-downtime redeploy.
- **Viewing Live Logs:** Navigate to the **Logs** tab in the Render service dashboard to view real-time HTTP requests, startup logs, and storage reconciliation outputs.
- **Manual Redeploy:** Click **Manual Deploy → Deploy latest commit** to restart or rebuild without code changes.

---

## 6. Complete Environment Variables Reference

| Variable | Blueprint Default | Required | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | `production` | Yes | Enables production optimizations, secure cookies, and CSP. |
| `NODE_VERSION` | `20` | Yes | Specifies Node.js 20 LTS runtime. |
| `PORT` | Auto-provided | No | Port on which the server listens. Bound to `0.0.0.0`. |
| `MONGODB_URI` | Dashboard prompt | Yes | MongoDB Atlas connection string (`sync: false`). |
| `JWT_SECRET` | Auto-generated | Yes | Secret key for signing session JWT cookies (`generateValue: true`). |
| `JWT_EXPIRES_IN` | `7d` | No | Session duration for auth tokens. |
| `STORAGE_DIR` | `/tmp/keepsake-storage` | Yes | Path for media storage. `/var/data/storage` in persistent mode. |
| `TRUST_PROXY` | `1` | No | Enables Express proxy trust behind Render's reverse proxy. |
| `PUBLIC_URL` | Auto-fallback | No | Canonical public URL. Falls back to `RENDER_EXTERNAL_URL`. |
| `CLIENT_ORIGIN` | Auto-fallback | No | Allowed frontend origin for CORS and CSRF verification. |
| `ALLOWED_ORIGINS` | - | No | Optional comma-separated origins for CSRF exemptions. |
| `DEMO_MODE` | `true` (free) / `false` (persistent) | No | Enables demo notice and auth page hint. |
| `SEED_DEMO_ON_BOOT` | `true` (free) / `false` (persistent) | No | Restores demo bundle into database and storage on boot. |
| `RECONCILE_STORAGE_ON_BOOT` | `true` (free) / `false` (persistent) | No | Purges orphan DB records if storage was reset by ephemeral restart. |
| `MAX_IMAGE_MB` | `10` (free) / `20` (persistent) | No | Maximum image upload size in megabytes. |
| `MAX_VIDEO_MB` | `25` (free) / `150` (persistent) | No | Maximum video upload size in megabytes. |
| `MAX_VIDEO_SECONDS` | `30` (free) / `180` (persistent) | No | Maximum video duration in seconds. |
| `USER_QUOTA_MB` | `100` (free) / `500` (persistent) | No | Per-user storage limit in megabytes. |
| `VIDEO_CONCURRENCY` | `1` | No | Concurrent FFmpeg worker limit to conserve CPU memory. |
| `PEXELS_API_KEY` | - | No | Optional. Only needed if executing `npm run fetch-demo-media`. |

---

## 7. Troubleshooting

### 1. Build Fails during `npm ci --omit=dev`
- **Cause:** Development dependencies or scripts were invoked during build.
- **Resolution:** Keepsake does not require compilation or dev tools in production. Verify `package.json` contains native `engines` (`>=20.0.0`) and that buildCommand is strictly `npm ci --omit=dev`.

### 2. Service Fails Health Check (`503 Service Unavailable`)
- **Cause:** Express is alive but `/api/health` reports `status: "degraded"` because MongoDB failed to connect.
- **Resolution:** Check MongoDB Atlas **Network Access** IP whitelist (`0.0.0.0/0`) and verify database username and password in `MONGODB_URI`.

### 3. Cookies Not Stored in Browser
- **Cause:** Cross-origin cookie blocking or insecure protocol mismatch.
- **Resolution:** Verify `TRUST_PROXY=1` is set in environment variables so Express recognizes `X-Forwarded-Proto: https`. Ensure you access the app over `https://`.

### 4. CSRF Rejection (`403 Cross-origin request rejected`)
- **Cause:** Request `Origin` header does not match Render external URL.
- **Resolution:** Render automatically supplies `RENDER_EXTERNAL_URL`. If using a custom domain, add your domain to `ALLOWED_ORIGINS` or set `CLIENT_ORIGIN=https://yourdomain.com`.

### 5. Media Files Disappeared After Inactivity
- **Cause:** Expected behavior on Render's free tier. Ephemeral disks reset when the service spins down after 15 minutes of inactivity.
- **Resolution:** On the free plan, `SEED_DEMO_ON_BOOT=true` and `RECONCILE_STORAGE_ON_BOOT=true` automatically recover demo data on cold start. For permanent user uploads, switch to `render.persistent.yaml` with a Persistent SSD Disk.

---

## 8. Pre-Launch Production Checklist

- [ ] MongoDB Atlas cluster created with `0.0.0.0/0` IP whitelist and dedicated database user.
- [ ] Render Blueprint applied (`render.yaml` or `render.persistent.yaml`).
- [ ] Health check verified at `https://<your-app>.onrender.com/api/health` (`status: "ok"`).
- [ ] Test user registered and authenticated over HTTPS.
- [ ] Sample photo and short video uploaded and verified in gallery and lightbox.
- [ ] Custom domain configured with SSL certificate (if applicable).
