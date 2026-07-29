# Workforce Pulse — Production Deployment & DevOps Guide

This guide covers deploying **Workforce Pulse** to a production Linux VPS utilizing **Docker Compose** (PostgreSQL + Backend + Frontend + Nginx) and setting up automated zero-downtime CI/CD via **GitHub Actions**.

---

## 1. System Architecture & Port Topology
In production, external users communicate exclusively with the high-performance **Nginx** reverse proxy on port `80` (or `443` with SSL). All application services run in isolated Docker containers:

```
[ Internet / Users ]
         │ (HTTP Port 80)
         ▼
[ Nginx Reverse Proxy Container (Alpine) ]
         ├── /api/*   ──► [ Backend Container ]  (Port 4000 - Internal Only)
         └── /*       ──► [ Frontend Container ] (Port 3000 - Internal Only)
                                 │
                         [ PostgreSQL 16 ]       (Port 5432 - Internal Only & Persisted Volume)
```

---

## 2. Server Preparation (VPS / Ubuntu)

1. **Provision a Linux VPS** (Ubuntu 22.04 LTS recommended, min 2GB RAM for Chromium PDF rendering & Docker).
2. **Install Docker & Docker Compose**:
   ```bash
   sudo apt update
   sudo apt install -y docker.io docker-compose-v2 git rsync
   sudo systemctl enable --now docker
   ```
3. **Create Application Directory**:
   ```bash
   sudo mkdir -p /opt/workforce-pulse
   sudo chown $USER:$USER /opt/workforce-pulse
   ```

---

## 3. Manual Deployment & Execution

If deploying manually directly on the server without GitHub Actions:

1. **Clone Repo & Configure `.env`**:
   ```bash
   git clone https://github.com/yourusername/workforce-pulse.git /opt/workforce-pulse
   cd /opt/workforce-pulse
   cp .env.example .env
   # Edit .env with secure POSTGRES_PASSWORD and OpenRouter API Key
   nano .env
   ```
2. **Build and Launch Containers**:
   ```bash
   docker compose up -d --build
   ```
3. **Run Database Migrations & Ingestion Seed**:
   ```bash
   docker compose exec backend npm run db:migrate
   docker compose exec backend npm run db:seed
   ```
4. **Verify Health**:
   ```bash
   curl http://localhost/api/health
   # Output: {"status":"ok","timestamp":"...","env":"production"}
   ```

---

## 4. GitHub Actions CI/CD Setup (`.github/workflows/deploy.yml`)

Our automated CI/CD pipeline triggers on every push to the `main` branch:
1. **CI Verification**: Type-checks frontend (`npx tsc`) and backend codebases in parallel.
2. **Artifact Sync**: Securely mirrors codebase changes via SSH/Rsync to `/opt/workforce-pulse/`.
3. **Container Rebuild**: Rebuilds changed Docker layers without downtime and executes schema migrations & pipeline seeding automatically.
4. **Automated Health Audit**: Queries `/api/health` post-deploy to verify HTTP `200 OK` success before confirming the job.

### Required GitHub Repository Secrets
Navigate to **Settings $\rightarrow$ Secrets and variables $\rightarrow$ Actions** in your GitHub repository and add:

| Secret Name | Example Value | Purpose |
| :--- | :--- | :--- |
| `SERVER_HOST` | `198.51.100.45` | IP Address or DNS domain of your VPS |
| `SERVER_USER` | `ubuntu` or `root` | SSH Login username on VPS |
| `SERVER_SSH_KEY` | `-----BEGIN OPENSSH...` | Private SSH key authorized in server's `~/.ssh/authorized_keys` |
| `POSTGRES_PASSWORD` | `SecureProdPassword99` | Production database password |
| `OPENROUTER_API_KEY`| `sk-or-v1-...` | Free AI Key from openrouter.ai |
| `NEXT_PUBLIC_API_URL`| `http://198.51.100.45` | Publicly accessible URL (or domain) of your deployment |

---

## 5. Maintenance & Useful Operational Commands

- **View Active Backend Logs**:
  ```bash
  docker compose logs -f backend
  ```
- **Re-trigger Data Ingestion Pipeline via CLI**:
  ```bash
  docker compose exec backend npm run db:seed
  ```
- **Access PostgreSQL Terminal (psql)**:
  ```bash
  docker compose exec postgres psql -U postgres -d workforce
  ```
- **Restart Web Application**:
  ```bash
  docker compose restart frontend
  ```
