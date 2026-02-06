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

## Production deployment on AWS

This project is ready to deploy on AWS as a single Node.js app on **EC2**, with **Nginx** for reverse proxy and TLS.

### Recommended AWS architecture (simple + production-ready)

- **EC2 (Ubuntu)**: runs Node.js app via systemd
- **Nginx**: reverse proxy, request size limits, static file serving
- **Route53**: domain DNS
- **AWS Certificate Manager + ALB** *(recommended)* OR Certbot on EC2
- **CloudWatch Agent**: server/app logs and basic metrics
- **Security Group**:
  - allow inbound `80` and `443` from internet
  - allow inbound `22` only from your office/home IP

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
3. Ensure persistent disk space for `storage/audio` and `storage/audits`.
4. Enable HTTPS.
5. Add monitoring against `GET /health`.
6. Restrict SSH in security groups.

---

## Step-by-step: Deploy on AWS EC2

### 1) Launch EC2

- AMI: Ubuntu LTS
- Instance type: at least `t3.small` (or higher for heavy workloads)
- Storage: start with 20+ GB gp3
- Attach a security group with ports 22/80/443 as noted above.

### 2) Connect and install dependencies

```bash
ssh -i <your-key>.pem ubuntu@<ec2-public-ip>
sudo apt update
sudo apt install -y nginx curl git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3) Clone project and configure app

```bash
cd /opt
sudo git clone <your_repo_url> Audit_engine
cd Audit_engine
npm ci --omit=dev
cp .env.example .env
```

Edit `.env` with production values.

Set permissions for runtime folders:

```bash
sudo mkdir -p storage/audio storage/audits
sudo chown -R ubuntu:ubuntu storage
```

### 4) Create systemd service

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

### 5) Configure Nginx

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

### 6) Configure DNS and TLS

#### Option A (recommended): ALB + ACM

- Create an Application Load Balancer in front of EC2.
- Request certificate in ACM.
- Attach cert to HTTPS listener (443).
- Route53 `A` record -> ALB.
- Security group: ALB allows 80/443, EC2 allows traffic from ALB SG.

#### Option B: Certbot directly on EC2

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 7) Health checks and operations

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

### 8) Recommended AWS hardening

- Put EC2 in private subnet and expose only ALB publicly.
- Use AWS Systems Manager Session Manager instead of public SSH where possible.
- Store secrets in **AWS Systems Manager Parameter Store** or **AWS Secrets Manager**.
- Ship Nginx and systemd logs to CloudWatch Logs.
- Set CloudWatch alarm on `/health` failure.

## Optional: container deployment on AWS ECS

If you move to ECS/Fargate later:
- build image and deploy as ECS service,
- place ALB in front,
- mount persistent storage (EFS) if you need local audit artifacts preserved,
- inject secrets from Secrets Manager.

## Important operational note

Current job state is in-memory (`Map`) and will reset on restart/redeploy. For durable production usage, move job metadata to a persistent store (Postgres/Redis) and process jobs via a worker queue.