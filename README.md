# Docklet

A self-hosted Docker management UI — one `docker run` command, then manage containers, images, logs, and files from any browser. No accounts, no cloud.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [First-Run Setup](#first-run-setup)
- [HTTPS](#https)
- [Configuration](#configuration)
- [Docker Compose](#docker-compose)
- [Upgrading](#upgrading)
- [Testing](#testing)
- [Common Issues](docs/COMMON_ISSUES.md)
- [Development](#development)

## Features

### Container Management
- Start, stop, restart, and remove containers
- Create containers from saved templates (persisted in the database)
- Real-time log streaming via SSE
- View container details, environment variables, and port mappings
- Auto-managed bind mounts under a single data volume

### Image Management
- List local images with size and tag info
- Pull images from Docker Hub or any registry
- Remove unused images

### Security & Auth
- Setup wizard on first run — no config files needed
- Role-based access control: `admin`, `mod`, `user`
- Passwords hashed with bcrypt, sessions via signed JWTs (httpOnly cookies)
- HTTPS by default with auto-generated self-signed cert; upload your own for a real domain

### Deployment
- Single `docker run` command, zero config files
- All settings stored in SQLite, managed entirely through the web UI
- Persistent data (DB, certs, volumes) in one directory — easy to back up

## Requirements

- **Docker Engine 20.10+** running on the host (exposes `/var/run/docker.sock`)
- **Ports 80 and 443** available on the host
- **Linux host** (Docker Desktop on Mac/Windows may work but is not officially supported)
- A persistent directory for data storage

No other software required — the container bundles Node.js 22, nginx, and OpenSSL.

## Quick Start

```bash
docker run -d --name docklet \
  -p 80:80 -p 443:443 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /home/<user>/docklet-data:/docklet-data \
  --restart always \
  ghcr.io/dandylake/docklet:latest
```

Then open `https://localhost` to complete the setup wizard. Accept the browser warning for the self-signed certificate.

## First-Run Setup

1. Navigate to `https://localhost` — you'll be redirected to the setup wizard
2. Create your admin account (username + password)
3. Click "Go to Dashboard" to start managing containers

## HTTPS

Docklet runs on HTTPS by default. A self-signed certificate is generated automatically at `/docklet-data/certs/` on first start. HTTP (port 80) redirects to HTTPS.

### Custom Domain Certificate

1. Go to **Settings > TLS Certificates**
2. Upload your certificate and private key
3. Restart the container — nginx picks up the new cert on next boot

## Configuration

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DOCKLET_DATA_DIR` | `/docklet-data` | Root data directory |
| `DOCKER_SOCKET` | `/var/run/docker.sock` | Docker daemon socket |

All other configuration is managed through the web UI and stored in the settings table.

### Data Persistence

All data lives in a single volume:

```
/docklet-data/
  db/docklet.db          # Database (users, settings, templates)
  certs/                 # TLS certificates (auto-generated on first run)
  backups/               # Reserved for future automated backups
  volumes/<name>/        # Auto-managed container bind mounts
```

To back up your instance, copy the entire data directory.

## Docker Compose

```yaml
services:
  docklet:
    image: ghcr.io/dandylake/docklet:latest
    container_name: docklet
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /home/<user>/docklet-data:/docklet-data
    restart: always
```

## Upgrading

```bash
docker pull ghcr.io/dandylake/docklet:latest
docker stop docklet && docker rm docklet
# Re-run the docker run command — your data persists in the volume
```

## Testing

Docklet has two layers of automated tests.

**Unit tests** (Vitest) cover service modules and pure logic. Test files live alongside source files (`foo.test.ts` next to `foo.ts`). External dependencies (DB, Docker, filesystem) are mocked at the module level.

```bash
npm test             # run once
npm run test:watch   # watch mode
```

**E2E tests** (Playwright) exercise the full app in a real browser against a running dev server.

```bash
npx playwright install chromium   # first time only
npm run test:e2e
```

Run `npm run typecheck` to catch TypeScript errors before running tests.

## Development

```bash
DOCKLET_DATA_DIR=/tmp/docklet-dev-data npm run dev
```

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for contribution guidelines.
