# Docklet

Self-hosted Docker container & file management web interface.

## Quick Start

```bash
docker run -d --name docklet -p 3000:3000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v docklet-data:/docklet-data \
  --restart always \
  docklet:latest
```

Then open `http://localhost:3000` to complete the setup wizard.

## First-Run Setup

1. Navigate to `http://localhost:3000` — you'll be redirected to the setup wizard
2. Create your admin account (username + password)
3. Click "Go to Dashboard" to start managing containers

## Configuration

All configuration is done via the web UI Settings page. No environment variables required for end users.

### Environment Variables (optional)

| Variable | Default | Purpose |
|----------|---------|---------|
| `DOCKLET_DATA_DIR` | `/docklet-data` | Root data directory |
| `DOCKER_SOCKET` | `/var/run/docker.sock` | Docker daemon socket |
| `PORT` | `3000` | Server port |

### TLS / HTTPS

1. Go to Settings > TLS Certificates
2. Upload your certificate (`cert.pem`) and private key (`key.pem`)
3. Restart the container — Docklet will automatically start with HTTPS

### Data Persistence

All data is stored in a single volume:

```
/docklet-data/
  db/docklet.db      # Database (users, settings, templates)
  certs/             # TLS certificates
  backups/           # Automated backups (future)
```

To back up your Docklet instance, copy the entire data volume.

## Docker Compose

```yaml
services:
  docklet:
    image: docklet:latest
    container_name: docklet
    ports:
      - "3000:3000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - docklet-data:/docklet-data
    restart: always

volumes:
  docklet-data:
```

## Upgrading

```bash
docker pull docklet:latest
docker stop docklet && docker rm docklet
# Re-run the docker run command — your data persists in the volume
```
