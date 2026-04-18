# Testing

Docklet has two test layers: **Vitest unit tests** that validate individual service modules in isolation, and **Playwright end-to-end tests** that drive a real browser against a running dev server. Together they cover the full stack, from pure business logic through Docker API integration to authenticated browser flows.

---

## Unit Tests

```
npm test           # single run (CI)
npm run test:watch # watch mode (development)
```

### Configuration

`vitest.config.ts` sets three things that matter:

- **`environment: "node"`**: no jsdom, no browser globals. Every module under `src/lib/` is pure Node.js; testing it in a browser environment would add noise.
- **`globals: true`**: `describe`, `it`, `expect`, `vi` are available without imports, matching the convention used throughout the project.
- **`@/` alias**: mirrors `tsconfig.json` so path aliases resolve identically in tests and in production.

### What's covered

Tests live next to the code they test (`foo.ts` → `foo.test.ts`). The 79 unit tests cover 11 modules:

| Module | Tests | What's validated |
|--------|------:|-----------------|
| `lib/docker/containers` | 20 | `listContainers`, `inspectContainer`, `createContainer`, volume path resolution, port binding, restart policy mapping |
| `lib/files/service` | 14 | directory listing, read/write, upload streaming, MIME detection, size limits |
| `lib/users/service` | 11 | CRUD, role changes, password reset, self-delete prevention, last-admin guard |
| `lib/docker/images` | 9 | list, remove, pull progress parsing |
| `lib/rate-limit` | 7 | sliding window enforcement, per-key isolation, window reset, client IP extraction |
| `lib/files/paths` | 6 | safe path resolution, directory containment, path traversal rejection |
| `lib/system/stats` | 3 | CPU/memory/disk aggregation, Docker stats rollup, error resilience |
| `lib/config` | 3 | `getSetting`/`setSetting`, setup detection, JWT secret auto-generation |
| `lib/certs/generate` | 3 | self-signed cert generation, idempotency |
| `lib/auth/password` | 2 | bcrypt hash and verify |
| `lib/db` | 1 | directory initialization, migration execution |

**Intentional gaps:** API route handlers, session/JWT logic, auth middleware, and React hooks are not unit tested. These all require either a running HTTP server or a browser context, both of which are covered more meaningfully by the e2e suite.

### DB test pattern

Several modules read `process.env.DOCKLET_DATA_DIR` at load time to locate the SQLite database. Testing them requires a real (but temporary) database:

```typescript
beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "docklet-users-test-"));
  process.env.DOCKLET_DATA_DIR = tmpDir;          // set env BEFORE importing
  const db = await import("@/lib/db");            // dynamic import picks up env
  db.initDataDirs();
  db.runMigrations();
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DOCKLET_DATA_DIR;
});

beforeEach(async () => {
  const { getDb } = await import("@/lib/db");
  const { users } = await import("@/lib/db/schema");
  getDb().delete(users).run();                    // clean slate between tests
});
```

The dynamic `import()` is load-time critical: a static top-level import of `@/lib/db` would run before `beforeAll` sets the env var, causing the module to initialize against the wrong path. Dynamic imports defer resolution until the test body runs, where the env is already set.

### Mocking pattern

Docker service tests mock `dockerode` at the module boundary; the test never touches a real Docker socket:

```typescript
const mockDocker = {
  listContainers: vi.fn(),
  getContainer: vi.fn(() => mockContainer),
  createContainer: vi.fn(),
};

vi.mock("./client", () => ({ getDocker: () => mockDocker }));
vi.mock("@/lib/db", () => ({ getDataDir: () => "/docklet-data" }));
vi.mock("fs", () => ({ mkdirSync: vi.fn() }));

// Imports come AFTER vi.mock() calls (Vitest hoists mocks before module resolution)
import { listContainers, createContainer } from "./containers";

beforeEach(() => vi.clearAllMocks());
```

`vi.clearAllMocks()` in `beforeEach` resets call counts and return values so test order never matters.

### Fake timers for time-dependent logic

The rate limiter uses a sliding window keyed on wall-clock time. Rather than sleeping 60 seconds in a test, we fast-forward:

```typescript
beforeEach(() => {
  __resetRateLimits();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
});

afterEach(() => vi.useRealTimers());

it("unblocks after the window advances", () => {
  for (let i = 0; i < 5; i++) checkRateLimit("k", 5, 60_000);
  vi.advanceTimersByTime(60_001);
  expect(() => checkRateLimit("k", 5, 60_000)).not.toThrow();
});
```

### Error assertions

Service functions throw `AppError` (a typed `Error` subclass with a `status` field). Tests assert the shape without committing to the full error message:

```typescript
await expect(createUser({ username: "dup", ... })).rejects.toMatchObject({ status: 409 });
await expect(createUser({ username: "x", password: "short", ... })).rejects.toMatchObject({ status: 400 });
```

---

## End-to-End Tests

```
npm run test:e2e                          # standard run
DOCKER_E2E_NETWORK=1 npm run test:e2e    # include Docker Hub tests
```

**Prerequisite:** `npx playwright install chromium` on first use.

### Project dependency chain

Playwright runs three projects in sequence:

```
setup  →  auth  →  chromium
```

**`setup`** runs `global-setup.ts` once: resets the database and cleans up test containers. This runs before any browser is launched.

**`auth`** runs `auth.spec.ts` in isolation. This is a separate project (not just a separate file), because the setup wizard only works against an empty database. By the time `auth` finishes, the `e2e-admin` account exists and every other spec can rely on it.

**`chromium`** runs the remaining five specs (`containers`, `images`, `users`, `settings`, `rbac`) once `auth` completes.

All specs use `test.describe.configure({ mode: "serial" })`, which means tests within each spec run sequentially on a single worker. The SQLite database is shared global state; running tests in parallel across it would cause races. In CI, `workers: 1` enforces this at the project level as a second safety net.

### Test isolation

**Database reset** happens in `global-setup.ts` before every test run. The DB is truncated in-place rather than deleted:

```typescript
const db = new Database(dbPath);
db.pragma("foreign_keys = OFF");
db.exec(`DELETE FROM sessions; DELETE FROM container_templates; DELETE FROM users; DELETE FROM settings;`);
db.pragma("foreign_keys = ON");
db.close();
```

Deleting the file would be simpler, but the dev server holds an open SQLite file descriptor. Deleting creates a stale inode: the server keeps writing to a deleted file while the next run opens a new one, which starts empty and unmigrated. Truncating rows in-place lets every open connection immediately see the cleared state.

**Docker container cleanup** also runs in global setup, removing any container whose name starts with `e2e-`. This convention (all test containers are named `e2e-<something>`) ensures orphans from crashed test runs are cleaned up automatically.

**Docker unavailability** is handled gracefully: `global-setup.ts` pings Docker before attempting cleanup. If the daemon is unreachable, cleanup is skipped with a warning and the DB reset still proceeds. A missing Docker socket doesn't block auth and settings tests that don't need it.

**Data directory isolation:** The dev server is started by Playwright's `webServer` config with `DOCKLET_DATA_DIR=./tmp/docklet-e2e-data`, keeping test data completely separate from any local development database. `reuseExistingServer: false` ensures the server is always restarted with this env. A stale server would point at a different data directory and cause every test to fail with confusing state mismatches.

### Auth fixtures

Every test that needs an authenticated session uses one of three fixtures: `adminPage`, `userPage`, or `modPage`. These are defined in `fixtures/auth.fixtures.ts` and extended from Playwright's base `test`.

Fixtures log in via the API, not the UI, for two reasons:

1. **Rate limit:** The login endpoint enforces a sliding window of 5 attempts per 15 minutes per IP. A test suite that logs in via form would exhaust this in seconds. The `webServer` config injects `E2E_DISABLE_RATE_LIMIT=1`, which the login route checks before calling the rate limiter.

2. **Reliability:** API calls don't race with React hydration, animation frames, or navigation timing.

The login API sets an `httpOnly` cookie (`docklet_session`). `httpOnly` cookies are intentionally inaccessible to JavaScript, so `document.cookie` can't inject them. Instead, the fixture parses the raw `Set-Cookie` response header and calls `page.context().addCookies()`:

```typescript
const setCookieHeader = res.headers()["set-cookie"];
const cookies = parseSetCookieHeader(setCookieHeader, "localhost");
await page.context().addCookies(cookies);
```

`ensureAdmin` and `ensureUser` are idempotent, ignoring 400/409 responses, so fixtures can be called in any order across parallel workers without failing if the user already exists.

### Page Object Model

Every page has a corresponding POM in `e2e/pom/`. POMs do two things: expose named locators as properties, and encode wait conditions inside action methods.

**Locator strategy**, in priority order:

| Strategy | When to use | Example |
|----------|-------------|---------|
| `getByLabel()` | Form inputs with a `<label>` | `page.getByLabel("Username")` |
| `getByRole()` | Buttons, headings, links with semantic meaning | `page.getByRole("button", { name: "Sign in" })` |
| `getByTestId()` | Dynamic or status UI with no stable role/label | `page.getByTestId("status-badge")` |
| `getByTitle()` | Icon-only buttons where the tooltip is the name | `row.getByTitle("Edit")` |
| CSS / placeholder | Compound queries where the above are ambiguous | `locator('input[placeholder="Host Port"]')` |

`exact: true` is added whenever a partial name match would resolve to multiple elements. The classic case is `{ name: "Pull" }` matching both the "Pull Image" button and the "Pull" submit button inside the modal, a strict-mode violation that caused a real test failure before the fix.

POM action methods encode their own completion condition. A test that calls `detail.start()` doesn't need to know that it should wait for the Stop button to appear:

```typescript
async start(): Promise<void> {
  await this.startButton.click();
  await this.stopButton.waitFor({ state: "visible", timeout: 15_000 });
}
```

This keeps specs declarative and prevents the common anti-pattern of `click()` followed by an immediate assertion that races against async state updates.

### API-level state setup

Tests that require existing infrastructure (a running container, a set of users) build that state via API in `beforeAll` rather than through the UI:

```typescript
test.beforeAll(async ({ request }) => {
  const cookie = await getAdminCookie(request);
  const res = await request.post("/api/containers", {
    headers: { Cookie: cookie },
    data: { name: "e2e-lifecycle", image: "alpine:latest", cmd: ["sleep", "3600"] },
  });
  containerId = (await res.json()).id;
});

test.afterAll(async ({ request }) => {
  const cookie = await getAdminCookie(request);
  await request.delete(`/api/containers/${containerId}?force=true`, {
    headers: { Cookie: cookie },
  });
});
```

`beforeAll`/`afterAll` with a shared closure variable requires `mode: "serial"` on the describe block. Without serial mode, `fullyParallel: true` would distribute the tests across workers, each running its own `beforeAll` and writing to its own copy of the variable, so the shared state would never be visible.

### Spec summary

| Spec | State setup | What it validates |
|------|-------------|-------------------|
| `auth.spec.ts` | None (requires empty DB) | Setup wizard flow, login, logout, redirect guards |
| `containers.spec.ts` | API create/delete per describe block | Container CRUD, lifecycle transitions, port/env config, template save and load |
| `images.spec.ts` | None | Image list, pull modal, pull + delete (network-gated, see below) |
| `users.spec.ts` | API create/delete per describe block | User CRUD, role changes, password reset, self-delete prevention |
| `settings.spec.ts` | Saves and restores `app_name` in `afterAll` | App name persistence, TLS cert upload UI, restart confirm dialog |
| `rbac.spec.ts` | API creates a running container for exec test | Page-level access control, sidebar visibility, API 403 enforcement, exec input visibility |

### Network-dependent tests

Two tests in `images.spec.ts` pull from Docker Hub and are skipped by default:

```
DOCKER_E2E_NETWORK=1 npm run test:e2e
```

These tests use `test.setTimeout(180_000)` rather than `test.slow()`. `test.slow()` triples the configured default (30s → 90s), but the modal close `waitFor` inside `pullImage` is set to 120s. A pull on a slow connection can take longer than 90s, so an explicit 180s timeout makes the budget clear and avoids the outer timeout firing before the inner one resolves.

The pull modal closes automatically on success (`setPullOpen(false)` is called when the SSE stream emits `data.complete`). The POM's `pullImage` method waits for the modal heading to disappear as its completion signal, a clean observable boundary that doesn't require polling the image list.

### CI and DOCKER_E2E_NETWORK

The main CI workflow does **not** set `DOCKER_E2E_NETWORK=1`, and this is intentional.

GitHub Actions runners share IP address pools. Docker Hub's anonymous pull rate limit (100 pulls per 6 hours per IP) applies across every workflow running on that shared pool, so your CI can start seeing 429 failures that have nothing to do with your code. Authenticated pulls raise the limit per account, but that requires secrets management for a marginal gain.

The network tests also add up to 3 minutes per run for a feature path that rarely changes. The pull modal opening and closing and the SSE progress rendering are covered by the unconditional modal dismiss test that runs without `DOCKER_E2E_NETWORK`.

The CI workflow does pre-pull `alpine:latest` and `nginx:alpine` before the test run, since `docker.createContainer()` does not auto-pull images and a cold runner will have neither cached. `busybox:latest` (used only in the network-gated tests) is intentionally not pre-pulled.

For scheduled full coverage, a separate workflow can run nightly with `DOCKER_E2E_NETWORK=1` and Docker Hub credentials configured as secrets:

```yaml
on:
  schedule:
    - cron: '0 3 * * *'
  workflow_dispatch:

jobs:
  e2e-network:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: docker pull alpine:latest nginx:alpine
      - run: npm run test:e2e
        env:
          DOCKER_E2E_NETWORK: "1"
          DOCKLET_DATA_DIR: /tmp/docklet-e2e-data
```
