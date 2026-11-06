# Keepsake Production Deployment Guide

This guide describes how to deploy Keepsake to a production environment using Docker, standard Node.js process managers (PM2 / systemd), and reverse proxies (Nginx / Caddy).

---

## 1. Prerequisites & System Requirements

- **Node.js:** Node 20 LTS or higher
- **Database:** MongoDB 7.0+ (Standalone replica set or MongoDB Atlas)
- **Image/Video Tools:** `sharp` (included in npm packages; pre-compiled native bindings require standard glibc/musl)
- **Disk Storage:** Fast SSD with persistent storage mounted to `/app/server/storage`
- **Memory:** Minimum 1 GB RAM (2 GB recommended for concurrent media transcoding)

---

## 2. Environment Variables Reference

Configure these variables in your production environment or `.env` file:

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | `production` | Enables production security headers, cookies, and caching. |
| `PORT` | No | `5000` | Port on which the Express web server binds. |
| `MONGODB_URI` | Yes | - | MongoDB connection string (e.g. `mongodb+srv://...`). |
| `CLIENT_ORIGIN` | Yes | - | Canonical public origin (e.g. `https://keepsake.app`). Used for CSRF checks. |
| `JWT_SECRET` | Yes | - | High-entropy random secret for signing authentication cookies. |
| `JWT_EXPIRES_IN` | No | `7d` | Lifetime of authentication sessions. |
| `STORAGE_DIR` | No | `server/storage` | Path for processed photos, avatars, and video storage. |
| `USER_QUOTA_MB` | No | `500` | Default per-user storage allocation in megabytes. |
| `MAX_IMAGE_MB` | No | `20` | Maximum single image upload payload limit. |
| `MAX_VIDEO_MB` | No | `150` | Maximum single video upload payload limit. |
| `MAX_VIDEO_SECONDS` | No | `180` | Maximum video duration allowed during upload processing. |
| `VIDEO_CONCURRENCY` | No | `1` | Max concurrent FFmpeg transcoding workers. |

---

## 3. Containerized Deployment (Docker & Docker Compose)

### Dockerfile

```dockerfile
# Multi-stage production build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install runtime utilities for sharp and video processing
RUN apk add --no-cache vips-dev ffmpeg

COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY server ./server
COPY client ./client

# Create persistent storage folder and set ownership
RUN mkdir -p server/storage && chown -R node:node /app
USER node

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

CMD ["node", "server/server.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    restart: unless-stopped
    ports:
      - "127.0.0.1:5000:5000"
    environment:
      - NODE_ENV=production
      - PORT=5000
      - MONGODB_URI=mongodb://mongo:27017/keepsake
      - CLIENT_ORIGIN=https://keepsake.example.com
      - JWT_SECRET=replace_with_64_char_crypto_random_secret
      - STORAGE_DIR=/app/server/storage
    volumes:
      - keepsake_storage:/app/server/storage
    depends_on:
      - mongo

  mongo:
    image: mongo:7.0
    restart: unless-stopped
    volumes:
      - keepsake_db:/data/db

volumes:
  keepsake_storage:
  keepsake_db:
```

---

## 4. Reverse Proxy Configuration

Always run Keepsake behind a TLS-terminating reverse proxy.

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name keepsake.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name keepsake.example.com;

    ssl_certificate /etc/letsencrypt/live/keepsake.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/keepsake.example.com/privkey.pem;

    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Upload size limits for high-res photo albums
    client_max_body_size 160M;

    # Static assets caching
    location ~* \.(css|js|webp|png|jpg|jpeg|svg|woff2)$ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # Application & API routes
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Caddyfile

```caddy
keepsake.example.com {
    encode gzip zstd
    request_body {
        max_size 160MB
    }
    reverse_proxy 127.0.0.1:5000
}
```

---

## 5. Storage Persistence & Permissions

All user uploads (photos, avatars, video transcodes) are written to `server/storage/`.
- Ensure this directory is mounted to persistent block storage or an EBS/NFS volume.
- Set appropriate file permissions so the Node service user can write files:
  ```bash
  chmod 750 server/storage
  ```

---

## 6. Database Backups & Maintenance

### Creating Backups
```bash
mongodump --uri="mongodb://127.0.0.1:27017/keepsake" --archive="/backups/keepsake_$(date +%F).archive" --gzip
```

### Restoring Backups
```bash
mongorestore --uri="mongodb://127.0.0.1:27017/keepsake" --archive="/backups/keepsake_2026-11-06.archive" --gzip --drop
```

---

## 7. Health Check & Monitoring

Use the lightweight health check endpoint for container orchestrators (Kubernetes, AWS ECS, Docker Swarm) and uptime monitors:

- **Endpoint:** `GET /api/health`
- **Success Response:** `200 OK`
  ```json
  {
    "status": "ok",
    "database": "connected",
    "timestamp": "2026-11-06T12:00:00.000Z"
  }
  ```
- **Failure Response:** `503 Service Unavailable` if MongoDB disconnects.

