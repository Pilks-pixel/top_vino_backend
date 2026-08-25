## Plan: Phase 5 Production Readiness + Test Flakiness Fix

Addresses the coverage-mode test flakiness first (blocker for CI), then delivers the four Phase 5 pillars: env validation, security middleware, structured logging with health/ready endpoints, and graceful shutdown. All changes target the `server/` subtree.

**Phases (5)**

1. **Phase 1: Fix Coverage-Mode Test Isolation**
    - **Objective:** Make `npm run test:coverage` reliably green. Root cause: Jest re-isolates modules per test file, so `userCounter` resets to `0` in each file. If `cleanDb()` hasn't fully committed by the time the next file's `beforeEach` calls `createTestUser()`, both files race to insert `user1@test.com` → unique-constraint violation → `beforeEach` throws → test runs with `undefined` fixtures → 404s.
    - **Files/Functions to Modify/Create:** `__tests__/setup/factories.ts` — replace module-level counter suffixes with `crypto.randomUUID()` suffixes on all generated emails and names.
    - **Tests to Write:** No new tests — success is measured by running `npm run test:coverage` three times and getting 130/130 each time.
    - **Steps:**
        1. Run `npm run test:coverage` twice to confirm the flaky pattern.
        2. Import `randomUUID` from `node:crypto`; suffix every generated email as `` `user-${randomUUID()}@test.com` `` and names similarly — ensuring uniqueness regardless of module reload timing.
        3. Run `npm run test:coverage` three times; confirm consistent green.

2. **Phase 2: Environment Validation & `.env.example`**
    - **Objective:** Fail fast at startup when required env vars are missing; document all vars.
    - **Files/Functions to Modify/Create:** `src/utils/env.ts` (new) — exports `validateEnv()`; `src/server.ts` — call `validateEnv()` before `startServer()`; `.env.example` (new at `server/`) — documents all required and optional vars.
    - **Tests to Write:** `__tests__/unit/env.test.ts` — verifies `validateEnv()` throws a descriptive `Error` listing all missing vars when `DATABASE_URL`, `BETTER_AUTH_SECRET`, or `BETTER_AUTH_URL` is absent, and returns cleanly when all are present.
    - **Steps:**
        1. Write the failing unit tests.
        2. Implement `src/utils/env.ts` — check each required var, collect missing names, throw with a clear message listing all missing vars at once.
        3. Wire `validateEnv()` into `server.ts`.
        4. Create `.env.example` covering `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `FRONTEND_URL`, `NODE_ENV`, `PORT`.
        5. Run unit tests green.

3. **Phase 3: Security Middleware**
    - **Objective:** Add `helmet`, rate limiting (in-memory), and request size limits; tighten production CORS.
    - **Files/Functions to Modify/Create:** `src/app.ts` — add middleware; `src/config/rateLimits.ts` (new) — rate limiter instances; `package.json` — new runtime deps.
    - **Tests to Write:** `__tests__/integration/security.test.ts` — verifies `x-frame-options` and `x-content-type-options` headers present in API responses, and that `ratelimit-*` headers are returned.
    - **Steps:**
        1. Write failing integration tests.
        2. `npm install helmet express-rate-limit`.
        3. Create `src/config/rateLimits.ts` — general API limiter (100 req/15 min, standard headers) and auth-specific limiter (20 req/15 min); both use default in-memory store.
        4. In `app.ts`: add `helmet()` immediately after the Better Auth handler; apply auth limiter to `/api/auth`; apply general limiter to all other routes; pass `{ limit: '10kb' }` to `express.json()`.
        5. Run integration tests green.

4. **Phase 4: Structured Logging (Pino) + Health & Ready Endpoints**
    - **Objective:** Remove Morgan; add `pino-http` for structured JSON logs; add `GET /health` (liveness) and `GET /ready` (readiness with DB check).
    - **Files/Functions to Modify/Create:** `src/lib/logger.ts` (new) — shared pino instance; `src/app.ts` — swap Morgan for pino-http, add `/health` and `/ready` routes; `src/middlewares/errorHandler.ts` — use pino logger; `package.json` — add/remove deps.
    - **Tests to Write:** `__tests__/integration/health.test.ts` —
        - `GET /health` → 200 with `{ status: 'ok', uptime: <number>, timestamp: <string> }` (no DB query)
        - `GET /ready` → 200 with `{ status: 'ready' }` when DB is reachable; 503 with `{ status: 'unavailable' }` when DB fails
    - **Steps:**
        1. Write failing integration tests for both endpoints.
        2. `npm install pino pino-http` and `npm install --save-dev pino-pretty`.
        3. Create `src/lib/logger.ts` — dev transport uses `pino-pretty`, prod emits raw JSON.
        4. In `app.ts`: replace Morgan with pino-http; add `GET /health` returning `{ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() }`.
        5. Add `GET /ready` — runs `prisma.$queryRaw\`SELECT 1\`` and returns 200 `{ status: 'ready' }` on success, or catches and returns 503 `{ status: 'unavailable' }`.
        6. In `errorHandler.ts`: replace `console.error` calls with the shared pino logger.
        7. `npm uninstall morgan` and remove `@types/morgan` from devDeps.
        8. Run tests.

5. **Phase 5: Graceful Shutdown**
    - **Objective:** Handle `SIGTERM`/`SIGINT` — drain in-flight requests, disconnect Prisma, then exit cleanly.
    - **Files/Functions to Modify/Create:** `src/server.ts` — `shutdown()` function + signal handlers.
    - **Tests to Write:** No automated signal tests; correctness validated by the existing integration suite passing after changes, plus a manual `kill -TERM` check.
    - **Steps:**
        1. In `server.ts`: implement `shutdown(signal: string)` — calls `server.close()` (stops accepting new connections), awaits `prisma.$disconnect()`, logs via the pino logger, then calls `process.exit(0)`; register a 10-second hard-exit fallback `setTimeout`.
        2. Register `process.on('SIGTERM', () => shutdown('SIGTERM'))` and `process.on('SIGINT', () => shutdown('SIGINT'))`.
        3. Run full test suite to confirm no regressions.
