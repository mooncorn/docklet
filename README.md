# Docklet

Self-hosted Docker container & file management web interface.

## Requirements

- **Docker Engine 20.10+** running on the host (exposes `/var/run/docker.sock`)
- **Ports 80 and 443** available on the host
- **Linux host** (the container mounts the Docker socket directly; Docker Desktop on Mac/Windows may work but is not officially supported)
- A persistent volume or directory for data storage (see [Data Persistence](#data-persistence))

No other software is required — the container bundles Node.js 22, nginx, and OpenSSL.

## Quick Start

```bash
docker run -d --name docklet \
  -p 80:80 -p 443:443 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v docklet-data:/docklet-data \
  --restart always \
  ghcr.io/mooncorn/docklet:latest
```

Then open `https://localhost` to complete the setup wizard. A self-signed certificate is generated automatically on first run — accept the browser warning to proceed.

## First-Run Setup

1. Navigate to `https://localhost` — you'll be redirected to the setup wizard
2. Create your admin account (username + password)
3. Click "Go to Dashboard" to start managing containers

## HTTPS

Docklet runs on HTTPS by default. On first start a self-signed certificate is generated automatically at `/docklet-data/certs/`. HTTP (port 80) redirects to HTTPS.

### Custom Domain Certificate

To use a certificate for your own domain (e.g. from Let's Encrypt):

1. Go to **Settings > TLS Certificates**
2. Upload your certificate and private key
3. Restart the container — nginx picks up the new cert on next boot

## Configuration

All configuration is done via the web UI Settings page. No environment variables required for end users.

### Environment Variables (optional)

| Variable | Default | Purpose |
|----------|---------|---------|
| `DOCKLET_DATA_DIR` | `/docklet-data` | Root data directory |
| `DOCKER_SOCKET` | `/var/run/docker.sock` | Docker daemon socket |

### Data Persistence

All data is stored in a single volume:

```
/docklet-data/
  db/docklet.db      # Database (users, settings, templates)
  certs/             # TLS certificates (auto-generated on first run)
  backups/           # Automated backups (future)
```

To back up your Docklet instance, copy the entire data volume.

## Docker Compose

```yaml
services:
  docklet:
    image: ghcr.io/mooncorn/docklet:latest
    container_name: docklet
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - docklet-data:/docklet-data
    restart: always

volumes:
  docklet-data:
```

## Upgrading

```bash
docker pull ghcr.io/mooncorn/docklet:latest
docker stop docklet && docker rm docklet
# Re-run the docker run command — your data persists in the volume
```
