<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Docklet Agent Rules

## Do

- Run `npm run typecheck` after modifying TypeScript files to catch errors early
- Run `npm test` after modifying any `src/lib/` code
- Use `await requireAuth()` or `await requireRole("admin")` in API route handlers — they throw `AuthError` on failure
- Wrap API route handler bodies in try/catch and return `handleApiError(error)` in the catch
- Use Drizzle's `.get()` for single rows and `.all()` for lists
- Use `.returning().get()` when inserting/updating and needing the result
- Import zod as `import { z } from "zod/v4"`
- Use `.refine()` for cross-field zod validation
- Keep all user-facing config in the settings DB table — no new env vars
- Place unit tests alongside source files (`foo.test.ts` next to `foo.ts`)
- Use HeroIcons v2 outline set from `react-icons/hi2` for UI icons
- Add `"use client"` directive to components using hooks, state, or browser APIs

## Don't

- Don't use `zod`'s `.check()` method — it has a different signature in v4 than expected. Use `.refine()` instead
- Don't destructure Drizzle insert results as arrays (`const [row] = ...`) — use `.get()` or `.all()`
- Don't add environment variables for configuration — use the settings table via `getSetting()`/`setSetting()`
- Don't access the database from Next.js edge middleware (`src/middleware.ts`) — it runs in the edge runtime which can't use better-sqlite3
- Don't import `better-sqlite3` directly in application code — use the `getDb()` singleton from `src/lib/db`
- Don't store secrets in env vars or files — JWT secret is auto-generated and stored in the settings table
- Don't use light theme colors — this is a dark-theme-only app (gray-900/800/700 palette)
- Don't create API routes without auth checks unless they are explicitly public (login, setup)
- Don't use `next/font/google` for Geist fonts — we use Inter
