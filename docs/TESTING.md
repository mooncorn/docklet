# Testing

Docklet has three test layers:

- **Unit tests** (Vitest) — individual service modules in isolation. External dependencies mocked at the module boundary.
- **Integration tests** (Vitest, `*.integration.test.ts`) — route handlers invoked directly against an in-memory SQLite DB and a stubbed Docker daemon. This is the workhorse: larger than unit, smaller than E2E, and covers auth, RBAC, CRUD, validation, and Docker state transitions without a browser.
- **End-to-end tests** (Playwright) — real browser, real dev server, real file-backed SQLite. Kept intentionally small: only genuine multi-page user journeys that a browser uniquely validates.

Suite sizes at a glance:

| Layer | Files | Tests | Wall-clock |
|------|------:|------:|-----------:|
| Unit | 11 | 92 | ~0.5s |
| Integration | 15 | 60 | ~6s |
| E2E | 6 | 17 | minutes (browser + dev server) |

---

## DB dependency injection

Integration tests invoke route handlers in-process, which means every DB-backed code path must be able to run against an in-memory SQLite instance instead of the file-backed production DB. `src/lib/db/index.ts` exposes:

```typescript
export function createDbInstance(dbPath: string): Db   // ":memory:" or file path
export function getDb(): Db                            // production accessor (file-backed)
export function setDb(db: Db): void                    // test-only override
export function resetDb(): void                        // test-only reset
```

`createDbInstance()` runs the inline SQL migrations against whatever path you give it, so a test can stand up a fully-migrated in-memory DB in a single call. `setDb`/`resetDb` swap the singleton for tests and restore it afterwards; production code never calls them.

Services (`lib/users/service.ts`, `lib/config/index.ts`, `lib/auth/session.ts`) accept `db: Db = getDb()` as an optional last parameter. Production call sites don't change — routes still call `listUsers()` with no args — but tests can construct an isolated DB and pass it explicitly if they want to bypass the singleton entirely.

Routes use the singleton path: `useTestDb()` calls `setDb(testDb)` in `beforeEach`, so when a handler runs `getDb()` inside the test, it sees the in-memory instance.

---

## Unit Tests

```
npm test            # run all Vitest suites (unit + integration)
npm run test:watch  # watch mode
```

Tests live next to the code they test (`foo.ts` → `foo.test.ts`). Covered modules:

| Module | What's validated |
|--------|-----------------|
| `lib/docker/containers` | `listContainers`, `inspectContainer`, `createContainer`, volume path resolution, port binding, restart policy mapping |
| `lib/files/service` | directory listing, read/write, upload streaming, MIME detection, size limits |
| `lib/users/service` | CRUD, role changes, password reset, self-delete prevention, last-admin guard |
| `lib/docker/images` | list, remove, pull progress parsing |
| `lib/rate-limit` | sliding window enforcement, per-key isolation, window reset, client IP extraction |
| `lib/files/paths` | safe path resolution, directory containment, path traversal rejection |
| `lib/system/stats` | CPU/memory/disk aggregation, Docker stats rollup, error resilience |
| `lib/config` | `getSetting`/`setSetting`, setup detection, JWT secret auto-generation |
| `lib/certs/generate` | self-signed cert generation, idempotency |
| `lib/auth/password` | bcrypt hash and verify |
| `lib/db` | directory initialization, migration execution |

### Mocking pattern

Docker service tests mock `dockerode` at the module boundary; the test never touches a real Docker socket:

```typescript
const mockDocker = {
  listContainers: vi.fn(),
  getContainer: vi.fn(() => mockContainer),
  createContainer: vi.fn(),
};

vi.mock("./client", () => ({ getDocker: () => mockDocker }));
vi.mock("fs", () => ({ mkdirSync: vi.fn() }));

import { listContainers, createContainer } from "./containers";

beforeEach(() => vi.clearAllMocks());
```

Imports come after `vi.mock()` calls — Vitest hoists them before module resolution. `vi.clearAllMocks()` in `beforeEach` resets call counts and return values so test order never matters.

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
```

---

## Integration Tests

```
npm run test:integration   # integration only
npm test                   # unit + integration together
```

Integration tests live alongside the route they exercise (`src/app/api/users/route.ts` → `route.integration.test.ts`). Each file owns one route family; collectively they cover every public API surface the app exposes.

### Harness

Everything test-specific lives under `src/test/`:

| File | What it provides |
|------|------------------|
| `setup.ts` | Vitest `setupFile` that mocks `next/headers` cookies against a global `Map` cookie jar |
| `db.ts` | `createTestDb()` stands up an in-memory Drizzle instance with migrations applied; `useTestDb()` returns a hook that sets/resets the DB singleton per test |
| `auth.ts` | `loginAs(db, {role})` creates a user + session and writes the `docklet_session` cookie; `createTestUser(db, opts)` creates without logging in |
| `request.ts` | `buildRequest()` constructs a `NextRequest`; `callHandler(handler, req, ctx?)` invokes it and returns `{status, headers, body}` |
| `docker.ts` | `FakeDocker` — in-memory dockerode replacement with `listContainers`, `createContainer`, `getContainer().{start,stop,restart,remove,inspect,logs,exec}`, `listImages`, `pull`, etc. Scope is deliberately narrow: only methods the routes actually call |
| `faker.ts` | Shared realistic-data helpers (`username()`, `password()`) used by both unit and integration tests |

### Writing an integration test

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/docker/client", () => ({
  getDocker: () => globalThis.__testDocker!,
}));

import { POST } from "./route";
import { useTestDb } from "@/test/db";
import { loginAs } from "@/test/auth";
import { buildRequest, callHandler } from "@/test/request";
import { installFakeDocker, getFakeDocker } from "@/test/docker";

describe("POST /api/images/pull", () => {
  const ctx = useTestDb();

  beforeEach(() => { installFakeDocker(); });

  it("when called as non-admin, returns 403 and does not pull", async () => {
    await loginAs(ctx.get(), { role: "user" });

    const res = await callHandler(
      POST,
      buildRequest({ method: "POST", body: { image: "nginx:latest" } })
    );

    expect(res.status).toBe(403);
    expect(await getFakeDocker().listImages()).toHaveLength(0);
  });
});
```

**Key conventions:**

- Each `describe` gets its own in-memory DB via `useTestDb()` — no shared state between files or between tests.
- `loginAs()` is the entry point for the authenticated path; calling it inside the `it` block means each test sets up its own session against its own DB.
- `vi.mock("@/lib/docker/client")` goes at the top of the file and routes all calls to `globalThis.__testDocker`. `installFakeDocker()` in `beforeEach` creates a fresh fake.
- Assertions hit the five observable outcomes: response status, response body, DB state (read back through the service), Docker fake state, and — for routes that care — cookie changes.

### Why routes, not services

Service-layer unit tests already cover business logic in isolation. Integration tests exist to validate the **full request path**: authentication middleware, schema validation, role checks, rate limiting, DB side effects, and response shape — everything between the HTTP boundary and the DB. That's the layer where bugs that slip past unit tests actually land.

---

## End-to-End Tests

```
npm run test:e2e
```

**Prerequisite:** `npx playwright install chromium` on first use.

The E2E suite is intentionally small (~17 tests). Everything that used to be covered here — RBAC status codes, form validation, CRUD persistence, auth error messages — is now in the integration suite. What remains is what a browser uniquely validates:

| Spec | Tests | What it validates |
|------|------:|-------------------|
| `auth.spec.ts` | 6 | Setup wizard → dashboard, setup → login redirect once admin exists, login → containers, logout via header menu, unauth → login, auth → containers |
| `containers.spec.ts` | 3 | Create via form → detail → list appearance, lifecycle start/stop/restart flow, template save on one form and load on another |
| `rbac.spec.ts` | 4 | Admin sees Users/Settings in sidebar, user does not, non-admin → /users redirect, non-admin → /settings redirect |
| `settings.spec.ts` | 1 | App name update persists on reload and appears on the login page (cross-page state) |
| `users.spec.ts` | 1 | Admin sees user list with `(you)` marker on own row |
| `images.spec.ts` | 1 | Images page loads for admin with Pull button (smoke) |

Every remaining test either spans multiple pages, depends on real browser rendering, or verifies cross-page state that the integration suite can't see.

### Project dependency chain

Playwright runs three projects in sequence:

```
setup  →  auth  →  chromium
```

- **`setup`** runs `global-setup.ts` once: resets the DB and cleans up any orphan `e2e-*` containers.
- **`auth`** runs `auth.spec.ts` in isolation, because the setup wizard only works against an empty database. By the time `auth` finishes, the `e2e-admin` account exists.
- **`chromium`** runs the remaining five specs.

All specs use `test.describe.configure({ mode: "serial" })`. The dev server's SQLite file is shared global state; running tests in parallel across it would cause races.

### Test isolation

**Database reset** in `global-setup.ts` truncates rows in-place rather than deleting the file. The dev server holds an open SQLite file descriptor, so `rm` would leave a stale inode — the server keeps writing to the deleted file while the next run opens a fresh, unmigrated one:

```typescript
const db = new Database(dbPath);
db.pragma("foreign_keys = OFF");
db.exec(`DELETE FROM sessions; DELETE FROM container_templates; DELETE FROM users; DELETE FROM settings;`);
db.pragma("foreign_keys = ON");
db.close();
```

**Docker container cleanup** removes any container whose name starts with `e2e-`.

**Docker unavailability** is handled gracefully: `global-setup.ts` pings Docker before cleanup. If unreachable, cleanup is skipped with a warning and DB reset still proceeds.

**Data directory isolation:** the dev server starts with `DOCKLET_DATA_DIR=./tmp/docklet-e2e-data`, completely separate from any local dev database. `reuseExistingServer: false` ensures a fresh server every run.

### Auth fixtures

Every test that needs a session uses `adminPage`, `userPage`, or `modPage`, defined in `fixtures/auth.fixtures.ts`.

Fixtures log in via the API, not the UI, for two reasons:

1. **Rate limit.** The login endpoint enforces 5 attempts per 15 minutes per IP. `webServer` injects `E2E_DISABLE_RATE_LIMIT=1` to bypass this for tests.
2. **Reliability.** API calls don't race with React hydration or navigation timing.

The login API sets an `httpOnly` cookie. Since JavaScript can't read `httpOnly` cookies, the fixture parses the raw `Set-Cookie` header and calls `page.context().addCookies()`.

`ensureAdmin` / `ensureUser` are idempotent, ignoring 400/409 so fixtures can be called across workers without failing if the user already exists.

### Page Object Model

Each page has a POM in `e2e/pom/`. POMs expose named locators and encode wait conditions inside action methods.

**Locator strategy**, in priority order:

| Strategy | When to use | Example |
|----------|-------------|---------|
| `getByLabel()` | Form inputs with a `<label>` | `page.getByLabel("Username")` |
| `getByRole()` | Buttons, headings, links with semantic meaning | `page.getByRole("button", { name: "Sign in" })` |
| `getByTestId()` | Dynamic UI with no stable role/label | `page.getByTestId("status-badge")` |
| `getByTitle()` | Icon-only buttons where the tooltip is the name | `row.getByTitle("Edit")` |

`exact: true` is added whenever a partial name match would resolve to multiple elements (e.g. `{ name: "Pull" }` matching both "Pull Image" and the modal's "Pull" submit button).

POM action methods encode their own completion condition:

```typescript
async start(): Promise<void> {
  await this.startButton.click();
  await this.stopButton.waitFor({ state: "visible", timeout: 15_000 });
}
```

This keeps specs declarative and avoids the `click()`-then-assert race.
