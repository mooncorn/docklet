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
    api/auth/             # Auth API routes
    api/settings/         # Settings API
  lib/
    db/schema.ts          # Drizzle ORM schema
    db/index.ts           # DB connection + migrations
    auth/password.ts      # bcrypt password hashing
    auth/session.ts       # JWT session management
    auth/middleware.ts     # requireAuth/requireRole helpers
    config/index.ts       # Settings from DB
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
docker run -p 3000:3000 -v /var/run/docker.sock:/var/run/docker.sock -v docklet-data:/docklet-data docklet
```

## Tech Stack

- **Framework**: Next.js (App Router, TypeScript)
- **Database**: SQLite via Drizzle ORM + better-sqlite3
- **Auth**: bcrypt + JWT (jose library)
- **Styling**: Tailwind CSS
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Docker**: dockerode
