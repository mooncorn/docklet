# Contributing to Docklet

## Prerequisites

- Node.js 22+
- npm

## Local Development

```bash
# Clone the repo
git clone <repo-url>
cd docklet

# Install dependencies
npm install

# Start dev server (uses /tmp/docklet-dev-data by default in dev mode)
DOCKLET_DATA_DIR=/tmp/docklet-dev-data npm run dev
```

Open `http://localhost:3000` and complete the setup wizard.

## Project Structure

```
src/
  app/
    (auth)/login/         # Login page
    (auth)/setup/         # First-run setup wizard
    (dashboard)/          # Dashboard layout + pages
      containers/         # Container management UI
      images/             # Image management UI
      files/              # File browser UI
      users/              # User management UI
      settings/           # Settings UI
    api/auth/             # Auth API routes
    api/containers/       # Container CRUD + log streaming
    api/images/           # Image management
    api/templates/        # Container templates
    api/events/           # Docker event streaming (SSE)
    api/files/            # File browser API
    api/users/            # User management API
    api/settings/         # Settings API
    api/system/           # System info API
    api/health/           # Health check
  lib/
    db/schema.ts          # Drizzle ORM schema
    db/index.ts           # DB connection + migrations
    auth/password.ts      # bcrypt password hashing
    auth/session.ts       # JWT session management
    auth/middleware.ts    # requireAuth/requireRole helpers
    config/index.ts       # Settings from DB
    docker/               # Docker service layer (dockerode)
    files/                # File system service layer
    system/               # System info service layer
    users/                # User service layer
    certs/                # TLS certificate helpers
    errors.ts             # Shared error types
  middleware.ts           # Next.js middleware (auth gating)
  components/             # UI components
  hooks/                  # Client-side hooks
server.ts                 # Custom Node.js server (TLS support)
```

## Testing

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# E2E tests (requires Playwright)
npx playwright install chromium
npm run test:e2e
```

## Building

```bash
# Build Next.js
npm run build

# Build Docker image
docker build -t docklet .

# Run Docker image
docker run -p 80:80 -p 443:443 -v /var/run/docker.sock:/var/run/docker.sock -v docklet-data:/docklet-data docklet
```

## Tech Stack

- **Framework**: Next.js (App Router, TypeScript)
- **Database**: SQLite via Drizzle ORM + better-sqlite3
- **Auth**: bcrypt + JWT (jose library)
- **Styling**: Tailwind CSS
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Docker**: dockerode
