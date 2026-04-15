# Docklet — Developer Guide for AI Agents

@AGENTS.md

## Project Overview

Docklet is a self-hosted Docker container & file management web interface. Single TypeScript codebase using Next.js App Router. Designed for easy deployment via `docker run` with all configuration through the web UI.

## Commands

- `npm run dev` — Start dev server (set `DOCKLET_DATA_DIR=/tmp/docklet-dev-data`)
- `npm run build` — Production build (standalone output)
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript type checking
- `npm test` — Unit tests (Vitest)
- `npm run test:watch` — Unit tests in watch mode
- `npm run test:e2e` — E2E tests (Playwright, requires `npx playwright install chromium` first)
- `docker build -t docklet .` — Build Docker image

## Architecture

### Route Groups
- `(auth)/` — Unauthenticated pages: `/login`, `/setup`
- `(dashboard)/` — Authenticated pages with sidebar layout: `/containers`, `/images`, `/files`, `/users`, `/settings`
- `api/` — Route Handlers (REST API)

### Core Libraries (`src/lib/`)
- `db/schema.ts` — Drizzle ORM schema (users, settings, sessions, container_templates)
- `db/index.ts` — DB connection singleton, `initDataDirs()`, `runMigrations()` (raw SQL, not drizzle-kit)
- `auth/password.ts` — bcrypt hash/verify via bcryptjs
- `auth/session.ts` — JWT creation/verification via jose, httpOnly cookie management
- `auth/middleware.ts` — `requireAuth()`, `requireRole()` helpers that throw `AuthError`
- `config/index.ts` — `getSetting()`/`setSetting()` backed by settings table

### Middleware (`src/middleware.ts`)
Next.js edge middleware handles:
- Setup redirect: if `docklet_setup` cookie missing → redirect to `/setup`
- Auth gating: if `docklet_session` cookie missing → redirect to `/login` or 401 for API

### Custom Server (`server.ts`)
Node.js server wrapping Next.js for conditional TLS. Runs migrations and initializes data dirs on startup. This runs in production only — dev uses `next dev`.

## Key Conventions

### Database
- Drizzle ORM with better-sqlite3 (synchronous driver)
- Use `.get()` for single row, `.all()` for multiple rows
- Use `.returning().get()` for insert/update that returns the row
- Tables auto-created via raw SQL in `runMigrations()`, not drizzle-kit push
- `better-sqlite3` must be in `serverExternalPackages` in next.config.ts

### Auth
- Passwords hashed with bcrypt (12 rounds)
- JWT signed with HS256, 72-hour expiry, stored in httpOnly cookie `docklet_session`
- JWT secret auto-generated and stored in settings table
- Three roles: `admin`, `mod`, `user`
- API routes use `await requireAuth()` or `await requireRole("admin")` which throw `AuthError`
- Catch errors with `handleApiError(error)` which returns proper JSON responses

### Validation
- Zod v4 — import from `zod/v4`
- Use `.refine()` for cross-field validation (not `.check()`)

### Styling
- Tailwind CSS v4 — dark theme only (gray-900 bg, gray-800 cards, gray-700 borders)
- Custom component classes in `globals.css`: `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-icon`, `.input-field`, `.card`, `.spinner`
- Badge classes: `.badge`, `.badge-green`, `.badge-red`, `.badge-yellow`, `.badge-blue`, `.badge-gray`
- Tab classes: `.tab-bar`, `.tab-item`, `.tab-active`, `.tab-inactive`
- Misc: `.log-viewer`, `.form-label`
- Sidebar classes: `.nav-link`, `.nav-link-active`, `.nav-link-inactive`, `.sidebar`
- Icons from react-icons: use HeroIcons v2 outline set (`react-icons/hi2`)
- Shared UI components in `src/components/ui/`: `Button`, `Modal`, `ConfirmDialog`, `PageHeader`, `StatusBadge`, `Tabs`, `FormInput`, `FormSection`, `DynamicList`

### Data Directory
Single volume at `DOCKLET_DATA_DIR` (default `/docklet-data`):
```
db/docklet.db          — SQLite database
certs/                 — TLS cert.pem + key.pem
backups/               — Future automated backups
volumes/<name>/<path>  — Auto-managed container bind mounts
```

### Environment Variables
Only two, both with defaults:
- `DOCKLET_DATA_DIR` — default `/docklet-data`
- `DOCKER_SOCKET` — default `/var/run/docker.sock`

All other config is in the settings DB table, managed via web UI.

## Testing

Testability is a first-class concern. Write code that is easy to test:
- Keep side-effectful code (DB, Docker, filesystem) in a thin layer that can be mocked
- Pure functions and service modules should have unit tests alongside them
- Run `npm run typecheck` and `npm test` after every batch of changes

### Unit Tests
- Vitest with path alias `@/` → `./src/`
- Place test files next to source: `foo.ts` → `foo.test.ts`
- Mock external dependencies at the module level with `vi.mock()`
- For tests needing DB: create temp dir, set `DOCKLET_DATA_DIR`, call `initDataDirs()` + `runMigrations()`, clean up in `afterAll`
- Use dynamic `import()` when module behavior depends on env vars set during test setup

### E2E Tests
- Playwright tests in `e2e/` directory
- Config starts dev server automatically on port 3000

## Implementation Status

### Phase 1 (Complete): Foundation
Scaffolding, DB, auth, config, middleware, setup wizard, login, dashboard shell, settings page, TLS cert upload, server.ts, Dockerfile, CI/CD, docs.

### Phase 2 (Complete): Docker Management
Container CRUD, image management, SSE log/event streaming via dockerode. Docker service layer in `src/lib/docker/` (client, containers, images, types). Container templates backed by DB. Auto-managed volume bind mounts under `volumes/`.

### Phase 3 (TODO): File Management & System Monitoring
File browser/editor/upload, system resource streaming via systeminformation.

### Phase 4 (TODO): User Management & Polish
User CRUD, rate limiting.
