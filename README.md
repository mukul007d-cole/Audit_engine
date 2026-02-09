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
  6. Uploaded audio is retained for 24 hours (cleanup runs periodically) and then removed.

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

## Simple AWS deployment (low-traffic setup)

If this app is not expected to get much load, keep deployment simple:

- 1 EC2 instance (Ubuntu)
- Node.js app managed by systemd
- Nginx reverse proxy
- HTTPS using Certbot directly on the same EC2

This avoids ALB/ECS complexity and is enough for small-to-moderate traffic.

### Required environment variables

Create `.env` on server:

```env
PORT=3000
OPENAI_API_KEY=<your_key>
ADMIN_TOKEN=<very_long_random_secret>
NODE_ENV=production
```

### Pre-deployment checklist

1. Use a strong `ADMIN_TOKEN` (32+ chars random).
2. Keep `.env` out of git.
3. Ensure persistent disk space for `storage/audio` and `storage/audits` (audio retention defaults to 24 hours).
4. Enable HTTPS.
5. Add at least a basic uptime check against `GET /health`.
6. Restrict SSH in security groups.

---

## Step-by-step: Deploy on AWS EC2 (simple)

### 1) Launch one EC2 instance

- AMI: Ubuntu LTS
- Instance type: `t3.small` is enough for low traffic
- Storage: start with 20+ GB gp3
- Security Group inbound rules:
  - `22` from your IP only
  - `80` from anywhere (`0.0.0.0/0`)
  - `443` from anywhere (`0.0.0.0/0`)

### 2) Connect and install system packages

```bash
ssh -i <your-key>.pem ubuntu@<ec2-public-ip>
sudo apt update
sudo apt install -y nginx curl git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3) Clone app and install dependencies

```bash
cd /opt
sudo git clone <your_repo_url> Audit_engine
cd Audit_engine
sudo chown -R ubuntu:ubuntu /opt/Audit_engine
npm ci --omit=dev
cp .env.example .env
```

Edit `.env` and set:

```env
PORT=3000
OPENAI_API_KEY=<your_key>
ADMIN_TOKEN=<very_long_random_secret>
NODE_ENV=production
```

Set permissions for runtime folders:

```bash
sudo mkdir -p storage/audio storage/audits
sudo chown -R ubuntu:ubuntu storage
```

### 4) Run the app with systemd

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
User=ubuntu
Group=ubuntu

[Install]
WantedBy=multi-user.target
```

Enable and run:

```bash
sudo systemctl daemon-reload
sudo systemctl enable audit-engine
sudo systemctl start audit-engine
sudo systemctl status audit-engine
```

### 5) Configure Nginx reverse proxy

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

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/audit-engine /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6) Point your domain to EC2

- In Route53 (or any DNS provider), create an `A` record:
  - Name: your domain (for example `audit.yourdomain.com`)
  - Value: your EC2 public IPv4 address
- Wait for DNS to propagate.

### 7) Enable HTTPS with Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Certbot will:
- install TLS certificate,
- update Nginx config,
- reload Nginx automatically.

Verify auto-renewal:

```bash
sudo systemctl status certbot.timer
```

### 8) Validate and operate

- Test app health:

```bash
curl http://127.0.0.1:3000/health
```

- Follow logs:

```bash
sudo journalctl -u audit-engine -f
```

- Restart app after deployment:

```bash
sudo systemctl restart audit-engine
```

### 9) (Optional) basic hardening

- Keep SSH (`22`) restricted to your IP.
- Take an AMI snapshot after successful setup.
- Move secrets to AWS Systems Manager Parameter Store later if needed.
- Add CloudWatch alarm on simple uptime check if desired.

## Optional: container deployment on AWS ECS

If you move to ECS/Fargate later:
- build image and deploy as ECS service,
- place ALB in front,
- mount persistent storage (EFS) if you need local audit artifacts preserved,
- inject secrets from Secrets Manager.

## Important operational note

Current job state is in-memory (`Map`) and will reset on restart/redeploy. For durable production usage, move job metadata to a persistent store (Postgres/Redis) and process jobs via a worker queue.
