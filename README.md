# Audit Engine

Audit Engine is a Node.js + Express service that accepts seller onboarding call recordings, runs asynchronous AI analysis, and generates downloadable audit outputs (PDF, report JSON, transcript TXT).

## What the project does

- **User portal (`/user`)**: upload call audio and track job progress.
- **Admin portal (`/admin`)**: monitor all jobs, view job id + status, and download:
  - generated PDF report,
  - extracted JSON report,
  - transcript text file.
- **Async processing pipeline**:
  1. Upload audio (`POST /jobs`).
  2. Job is queued in memory.
  3. Audio is transcribed using OpenAI.
  4. Checklist extraction is generated using a strict JSON schema.
  5. PDF report is produced and saved under `storage/audits`.

## Tech stack

- Node.js (ES modules)
- Express
- Multer (file uploads)
- OpenAI API (transcription + analysis)
- PDFKit
- Static frontend (vanilla HTML/CSS/JS)

## Local development

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

```bash
cp .env.example .env
```

Set:
- `OPENAI_API_KEY`
- `ADMIN_TOKEN` (long random string for admin APIs)
- optional `PORT`

### 3) Run checks

```bash
npm run check
```

### 4) Start the app

```bash
npm start
```

Endpoints:
- User page: `http://localhost:3000/user`
- Admin page: `http://localhost:3000/admin`
- Health endpoint: `http://localhost:3000/health`

## API overview

- `POST /jobs` (multipart/form-data: `audio`, `sellerId`) => queues a job.
- `GET /jobs/:id` => fetch one job status.
- `GET /sellers/:sellerId/jobs` => fetch jobs for seller.
- `GET /admin/jobs` => admin list all jobs.
- `GET /admin/jobs/:id/report` => admin download extracted report JSON.
- `GET /admin/jobs/:id/transcript` => admin download transcript TXT.

Admin endpoints require:

```http
Authorization: Bearer <ADMIN_TOKEN>
```

## Production deployment guide

This project can run in production as a single Node.js service behind Nginx.

### Recommended production architecture

- **Nginx** (TLS termination, reverse proxy)
- **Node app** managed by systemd/PM2
- Persistent writable disk for `storage/audio` and `storage/audits`
- Centralized logs (journald, CloudWatch, Datadog, etc.)

### Pre-deployment checklist

1. Set strong `ADMIN_TOKEN`.
2. Set valid `OPENAI_API_KEY`.
3. Keep `.env` out of git.
4. Ensure disk space and backup policy for `storage/audits`.
5. Put service behind HTTPS.
6. Monitor `GET /health` for uptime checks.

### Deploy on Linux VM (systemd)

#### 1) Prepare server

```bash
sudo apt update
sudo apt install -y nginx nodejs npm
```

#### 2) Copy project and install

```bash
cd /opt
sudo git clone <your_repo_url> Audit_engine
cd Audit_engine
npm ci --omit=dev
cp .env.example .env
```

Edit `.env` with real secrets.

#### 3) Create systemd service

Create `/etc/systemd/system/audit-engine.service`:

```ini
[Unit]
Description=Audit Engine
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/Audit_engine
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/opt/Audit_engine/.env
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable audit-engine
sudo systemctl start audit-engine
sudo systemctl status audit-engine
```

#### 4) Configure Nginx reverse proxy

Create `/etc/nginx/sites-available/audit-engine`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/audit-engine /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Add TLS (Let's Encrypt):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Optional: deploy with Docker

If you use containers, mount a persistent volume for `/app/storage` so audit files remain available after restarts.

## Important operational note

Current job state is in-memory (`Map`) and will reset on restart. For true production durability and horizontal scaling, move job state to a database (e.g., Postgres/Redis) and use a queue worker.
