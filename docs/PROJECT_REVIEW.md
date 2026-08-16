# Top Vino Backend - Project Review & Roadmap

**Date:** July 31, 2026  
**Status:** In Development - Phase 3 (Authentication & Authorization) Complete

---

## 📋 Project Purpose

**Top Vino** is a **spaced repetition learning/flashcard application backend** (similar to Anki or Quizlet) built with Node.js, Express, TypeScript, and Prisma ORM. The system implements intelligent card review scheduling using spaced repetition algorithms (likely FSRS - Free Spaced Repetition Scheduler based on the schema).

---

## 🎯 Core Features (Designed)

### 1. User Management

- User accounts with FREE/PRO subscription tiers
- Authentication via email lookup

### 2. Deck System

- Create/manage flashcard decks
- Public/private deck visibility
- Deck collaboration with role-based access (editor/viewer)
- Topic organization

### 3. Card Types

- Basic flashcards
- Multiple choice questions
- Cloze deletion
- Open-ended (AI-gradable) questions
- Source tracking (manual, AI, upload)

### 4. Spaced Repetition Algorithm

- FSRS algorithm implementation (parameters a, b, c in schema)
- Ease factor tracking
- Review scheduling (nextReviewAt)
- Quality ratings (0-5 scale)
- Streak tracking

### 5. AI Integration (planned)

- Open-ended answer grading
- Feedback generation
- Content generation capabilities

---

## ✅ What's Been Implemented

### Infrastructure ✓

- Express.js server with TypeScript
- Prisma ORM with PostgreSQL
- Docker & Docker Compose setup
- Development environment with hot-reload (`--watch --experimental-strip-types`)
- CORS configuration
- Morgan logging
- Git hooks with Husky
- ESLint & Prettier formatting
- Prisma Accelerate extension for performance

### User Module ✓ (COMPLETE)

- **Model layer**: Full CRUD operations (`src/model/usersModel.ts`)
- **Service layer**: Business logic with error handling (`src/services/user.service.ts`)
- **Controller layer**: HTTP handlers (`src/routes/user/user.controller.ts`)
- **Router**: RESTful endpoints (`src/routes/user/user.router.ts`)
  - `GET /user` - List all users
  - `GET /user/me` - Get the authenticated user (session-derived)
  - `GET /user/:id` - Get by ID
  - `PUT /user/:id` - Update user (owner-only)
  - `DELETE /user/:id` - Delete user (owner-only)
- **Validation**: Zod schema validation middleware (`src/utils/userSchema.ts`)
- ⚠️ `httpCreateUser` / `createUser` still exist in the controller and service but are **no longer wired to a route** — account creation now goes through Better Auth's `/api/auth/sign-up/email`. This is dead code left over from Phase 1; safe to delete once confirmed unused. See the "User creation flow" note below.

### Deck, Card & Review Modules ✓ (COMPLETE — delivered in Phase 2)

- **Deck**: model, service, controller, router with Zod validation (`src/routes/deck/`) — full CRUD, owner-scoped
- **Card**: model, service, controller, router (`src/routes/card/`) — nested under `/deck/:deckId/cards`
- **Review**: model, service, controller, router (`src/routes/review/`) — implements an SM-2-style spaced repetition scheduler (`review.service.ts`), tracking `currentInterval`, `easeFactor`, and `reviewCount` on `UserCardProgress`
- All three modules are protected by `authMiddleware` and covered by both unit and integration tests

### Authentication & Authorization ✓ (COMPLETE — Phase 3)

- **Better Auth** integrated with the Prisma adapter (`src/lib/auth.ts`), using the project's custom `generated/prisma` client output
- Email/password and Google OAuth enabled; Apple OAuth deferred to Phase 6 (requires Team ID/Key ID/`.p8` key)
- Cookie-based sessions (7-day expiry, 1-day rolling `updateAge`, 5-minute cookie cache to avoid a DB hit on every request)
- `customSession` plugin exposes `subscriptionType` on the session for FREE/PRO gating without an extra query
- Better Auth handler mounted at `/api/auth/{*any}` **before** `express.json()`, with an `onAPIError` hook that normalizes Better Auth error responses into the same `{ success, status, statusCode, message }` shape used by `errorHandler`
- **Authorization middleware** (`src/middlewares/`):
  - `authMiddleware.ts` — resolves the session via `auth.api.getSession`, attaches `req.user`, throws `UnauthorizedError` (401) if absent
  - `requireOwnership.ts` — 403s unless `req.user.id` matches the resource owner
  - `requireRole.ts` — checks `DeckCollaborator` role (`EDITOR`/`VIEWER` enum) for shared-deck access
  - `requireSubscription.ts` — gates PRO-only routes on `req.user.subscriptionType`
- All four middlewares have unit tests; Deck/Card/Review/User routes apply them as needed

### Error Handling ✓ (COMPLETE)

- Extended `AppError` hierarchy with specific HTTP error classes (`src/utils/appError.ts`)
- Prisma error transformation utility for database-specific failures (`src/utils/prismaErrorHandler.ts`)
- Global error handler with centralized JSON error responses (`src/middlewares/errorHandler.ts`)
- Validation middleware integrated into centralized error flow (`src/middlewares/validationMiddleware.ts`)
- Async controller wrapper to remove repetitive try/catch blocks (`src/utils/catchAsync.ts`)

### Database Schema ✓

- Complete Prisma schema with 8 models
- Migrations created and applied
- Relations properly defined
- Enums for subscription types

---

## ❌ What's Missing / Incomplete

### Critical Issues

#### 1. Flaky integration tests under `--coverage` 🔴

- `npm test` passes cleanly (130/130), but `npm run test:coverage` intermittently fails ~25 tests across `deck`, `card`, `review`, and `user` integration suites with 404s where 200/201/403 are expected, and occasional `PrismaClientKnownRequestError` unique-constraint violations from `factories.ts`.
- Coverage instrumentation slows execution enough to expose a test-isolation race (most likely overlapping factory data / truncation timing between the `--runInBand` suites), not a real app bug.
- Needs investigation before this can be trusted as a CI gate — see Phase 4/Phase 5 discussion below.

#### 2. Stale generated Prisma client (found & fixed this session) ✅

- `generated/prisma` was out of sync with `prisma/schema.prisma` (missing the `currentInterval` field added by the `add_current_interval_to_progress` migration), which broke TypeScript compilation for `review.service.ts` and failed 3 integration suites outright.
- Fixed by running `npx prisma generate`. **Note for future:** re-run `prisma generate` after every schema/migration change — it isn't automatic in this project's dev workflow.

#### 3. Dead code: unused `POST /user` creation path

- `httpCreateUser` / `createUser` remain in `user.controller.ts` / `user.service.ts` but are no longer mounted on `user.router.ts` now that Better Auth owns sign-up. Low risk, but should be deleted or explicitly repurposed (e.g., admin-only user creation) to avoid confusion.

### Missing Features

- No input sanitization beyond Zod validation
- No rate limiting
- No API documentation (Swagger/OpenAPI)
- No environment variable validation on startup
- No CI/CD pipeline (no `.github/workflows` yet)
- No production deployment configuration
- No health check endpoint
- No graceful shutdown handling
- No database connection pooling configuration
- Apple OAuth not yet configured (deferred to Phase 6)

---

## 🚀 Development Roadmap

### PHASE 1: Complete Error Handling System (Done)

**Status: COMPLETE**

#### Tasks:

1. **Enhance AppError System**

   - Create specific error classes: `NotFoundError`, `ConflictError`, `UnauthorizedError`, `ForbiddenError`
   - Add `isOperational` flag to distinguish operational vs programming errors

2. **Upgrade Error Handler Middleware**

   - Handle Prisma errors (P2002, P2025, P2003, etc.)
   - Integrate ValidationError with Zod validation middleware
   - Implement different responses for dev vs production
   - Add error logging with stack traces
   - Return consistent error response format

3. **Update Validation Middleware**

   - Throw `ValidationError` instead of sending response directly
   - Let error handler manage the response

4. **Add Async Error Wrapper**
   - Create `catchAsync` utility to wrap async route handlers
   - Eliminate try-catch blocks in controllers

#### Outcome:

- Prisma errors are transformed into application-level HTTP responses
- Validation failures flow through the centralized error handler
- Development and production responses are differentiated
- Controllers use shared async error handling

---

### PHASE 2: TDD Foundation + Core CRUD Vertical Slices (3-5 days)

**Status: COMPLETE** — Jest/Supertest harness, Deck/Card/Review modules, and regression coverage for Phase 1 error handling are all in place.

**Start with tests, then implement Deck, Card, and Card Review slices incrementally**

#### Tasks:

1. **Testing Foundation**

   - Install Jest, Supertest, and TypeScript test tooling
   - Add shared test helpers, fixtures, and database lifecycle utilities
   - Create package scripts for unit, integration, and full test runs

2. **Phase 1 Regression Coverage**

   - Add automated tests for error handling and validation behavior
   - Add regression tests for existing User service and HTTP flows
   - Lock in the current API error contract before extending the system

3. **Deck Module**

   - Model: CRUD operations with user ownership checks
   - Service: Business logic for deck creation/deletion
   - Controller: HTTP handlers
   - Router: RESTful endpoints
   - Zod schema validation
   - Write unit and integration tests before implementation

4. **Card Module**

   - Model: CRUD operations with deck association
   - Service: Handle different card types
   - Controller: HTTP handlers
   - Router: RESTful endpoints
   - Zod schemas for each card type
   - Write unit and integration tests before implementation

5. **Card Review Module**
   - Model: Record review sessions
   - Service: Implement FSRS algorithm
   - Controller: Submit review endpoints
   - Calculate next review date
   - Update user progress
   - Write unit and integration tests before implementation

#### Deliverables:

- Jest + Supertest test harness with reusable helpers
- Automated regression coverage for completed Phase 1 behavior
- Full CRUD for Decks, Cards, CardReviews
- Proper authorization (users can only access their own decks)
- Working spaced repetition scheduling

---

### PHASE 3: Authentication & Authorization via Better Auth (2-3 days)

**Status: COMPLETE**

Authentication is handled by [Better Auth](https://better-auth.com/) with the Prisma adapter. The frontend triggers sign-in/sign-up flows (email/password, Google, Apple); the backend validates Better Auth cookie-based sessions and enforces authorization decisions.

#### Tasks:

1. **Install & Configure Better Auth**

   - Install `better-auth` and `@better-auth/prisma-adapter`
   - Create `src/lib/auth.ts` — configure Prisma adapter (using custom output path `generated/prisma`), enable email/password, Google, and Apple providers
   - Add required env vars: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and OAuth credentials
   - Run `npx auth@latest generate` to append Better Auth models to `prisma/schema.prisma`, then `prisma migrate dev`
   - Mount `toNodeHandler(auth)` in `src/app.ts` using Express v5 pattern (`/api/auth/{*any}`), **before** `express.json()`

2. **Configure Session Management**

   - Cookie-based sessions with 7-day expiry (Better Auth default)
   - Enable cookie cache (5-minute `maxAge`) to avoid a DB read on every request
   - Use `customSession` plugin to expose `subscriptionType` in session data for FREE vs PRO gating
   - Configure CORS with `credentials: true` and an explicit `origin` for the frontend domain

3. **Add Authorization Middleware**

   - `authMiddleware.ts` — resolves session via `auth.api.getSession({ headers: fromNodeHeaders(req.headers) })`, attaches `req.user`, returns 401 if unauthenticated
   - `requireSubscription.ts` — gates PRO-only routes on `req.user.subscriptionType`
   - `requireOwnership.ts` — enforces resource ownership by comparing `req.user.id` against the resource's `userId`
   - `requireRole.ts` — checks deck collaborator roles

4. **Protect Existing Endpoints**
   - Apply `authMiddleware` to all Deck, Card, Review, and user-mutation routes
   - Replace hardcoded `req.query.userId` references with `req.user.id`

#### Future (Phase 6+):
   - MFA, Passkeys, Admin roles, device management, audit logs

---

### PHASE 4: Test Expansion & Quality Gates (3-4 days)

#### Tasks:

1. **Expand Test Coverage**

   - Extend unit and integration coverage across all completed modules
   - Fill gaps discovered during Phase 2 and Phase 3 delivery
   - Improve fixture reuse and test data setup ergonomics

2. **Unit Tests**

   - Service layer tests (business logic)
   - Utility function tests
   - Error class tests

3. **Integration Tests**

   - API endpoint tests with Supertest
   - Database operation tests
   - Authentication flow tests
   - Error handling tests

4. **Test Coverage**
   - Aim for 80%+ coverage
   - Setup coverage reporting
   - Add pre-commit test hook

#### Test Structure:

```
server/
  __tests__/
    unit/
      services/
      utils/
    integration/
      routes/
      models/
    fixtures/
      testData.ts
    setup.ts
```

---

### PHASE 5: Production Readiness (2-3 days)

#### Tasks:

1. **Environment Configuration**

   - Install `dotenv-safe` for validation
   - Create `.env.example`
   - Validate required variables on startup
   - Add different configs for dev/staging/prod

2. **Security Enhancements**

   - Install `helmet` for security headers
   - Add rate limiting with `express-rate-limit`
   - Input sanitization with `express-validator`
   - Enable CORS properly for production
   - Add request size limits

3. **Logging & Monitoring**

   - Replace Morgan with Winston or Pino
   - Structured logging with log levels
   - Log rotation
   - Add health check endpoint (`/health`)
   - Add metrics endpoint

4. **Graceful Shutdown**
   - Handle SIGTERM/SIGINT
   - Close database connections
   - Finish pending requests

---

### PHASE 6: Scalability & Deployment (Variable timeline)

#### Option A: Simple Deployment (1-2 days)

**PM2 Process Manager**

- Install PM2: `npm install -g pm2`
- Create `ecosystem.config.js`
- Configure cluster mode (use all CPU cores)
- Setup automatic restart on crashes
- Configure log management

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "top-vino-api",
      script: "./dist/server.js",
      instances: "max",
      exec_mode: "cluster",
      env_production: {
        NODE_ENV: "production",
        PORT: 8000,
      },
    },
  ],
};
```

**Deploy to VPS**

- Use Digital Ocean, Linode, or AWS EC2
- Setup Nginx as reverse proxy
- SSL with Let's Encrypt
- Setup PostgreSQL on same server or managed DB

#### Option B: Cloud Native (1-2 weeks)

**AWS Deployment**

- **ECS/Fargate**: Containerized deployment
- **RDS**: Managed PostgreSQL
- **ALB**: Load balancing with health checks
- **CloudWatch**: Logging and monitoring
- **Secrets Manager**: Environment variables
- **Auto Scaling**: Scale based on CPU/memory

**Alternative: Platform as a Service**

- **Render**: Zero-config deployment
- **Railway**: Easy PostgreSQL + app deployment
- **Fly.io**: Global edge deployment
- **Heroku**: Simple but pricey

**Infrastructure as Code**

- Terraform or AWS CDK
- Define all infrastructure in code
- Reproducible deployments

**CI/CD Pipeline**

- GitHub Actions or GitLab CI
- Automated testing on PR
- Automated deployment on merge to main
- Blue-green deployments

> ⚠️ **Split CI from CD.** The *deployment* automation above genuinely depends on picking a hosting option in Phase 6. But *continuous integration* — running lint, `check-types`, and `npm test` on every PR — has no dependency on hosting and is cheap to add now. Don't wait for Phase 6 to get a basic GitHub Actions test-on-PR workflow in place; it should happen as soon as the coverage flakiness (see Critical Issues) is resolved.

---

## 📊 Recommended Timeline

### Weeks 1-3: Foundation & Security — ✅ complete

- Phase 1: Error Handling
- Phase 2: Test harness + Deck/Card/Review slices
- Phase 3: Authentication & Authorization (Better Auth)

### Now: Stabilize before expanding

- Fix coverage-mode test flakiness (Critical Issue #1)
- Stand up a minimal CI workflow (lint + types + tests on PR)
- Clean up dead `POST /user` code path

### Next: Production hardening (Phase 5), test expansion as-needed (Phase 4)

- Phase 5: env validation, security middleware, structured logging, health check, graceful shutdown
- Phase 4: fold in as gaps are discovered rather than as a dedicated block of work

### Later: Deployment (Phase 6)

- Phase 6A: Simple PM2 deployment, or
- Phase 6B: Cloud-native deployment + CD pipeline (build on the CI workflow started above)
- Performance optimization
- Caching layer (Redis)
- Real-time features (WebSockets)
- Analytics tracking

---

## 🎯 Immediate Next Steps

1. Investigate and fix the coverage-mode test flakiness (see Critical Issue #1) — this blocks trusting `test:coverage` as a quality gate
2. Stand up a minimal CI workflow (lint + `check-types` + `npm test`) so regressions are caught on every PR, independent of the Phase 6 deployment timeline
3. Decide the fate of the unused `POST /user` creation path
4. Prioritize Phase 5 security/production hardening items (rate limiting, helmet, env validation, health check) over broad Phase 4 test-coverage expansion — see discussion below
5. Revisit Phase 4 (deeper test coverage) opportunistically as gaps are found, rather than as a dedicated phase

---

## 📁 Project Architecture

### Current Structure

```
server/
├── src/
│   ├── app.ts                  # Express app config — mounts Better Auth before express.json()
│   ├── server.ts               # Server entry point
│   ├── lib/
│   │   ├── auth.ts             # Better Auth config: Prisma adapter, sessions, customSession, onAPIError (COMPLETE)
│   │   └── prisma.ts           # Prisma client instance
│   ├── middlewares/
│   │   ├── authMiddleware.ts       # Resolves Better Auth session -> req.user (COMPLETE)
│   │   ├── requireOwnership.ts     # 403 unless req.user.id owns the resource (COMPLETE)
│   │   ├── requireRole.ts          # DeckCollaborator role check (COMPLETE)
│   │   ├── requireSubscription.ts  # FREE/PRO gating (COMPLETE)
│   │   ├── errorHandler.ts         # Global error handler (COMPLETE)
│   │   └── validationMiddleware.ts # Zod validation wired into error handling
│   ├── model/                  # Data access layer
│   │   ├── usersModel.ts       # User CRUD operations (COMPLETE)
│   │   ├── deckModel.ts        # Deck CRUD (COMPLETE)
│   │   ├── cardModel.ts        # Card CRUD (COMPLETE)
│   │   └── reviewModel.ts      # Review CRUD (COMPLETE)
│   ├── routes/                 # Controllers & routes
│   │   ├── user/                # GET /, GET /me, GET /:id, PUT /:id, DELETE /:id (COMPLETE)
│   │   ├── deck/                 # Full CRUD, owner-scoped (COMPLETE)
│   │   ├── card/                 # Nested under /deck/:deckId/cards (COMPLETE)
│   │   └── review/                # Review submission + SM-2 scheduling (COMPLETE)
│   ├── services/                # Business logic layer
│   │   ├── user.service.ts      # User service (COMPLETE)
│   │   ├── deck.service.ts      # Deck service (COMPLETE)
│   │   ├── card.service.ts      # Card service (COMPLETE)
│   │   └── review.service.ts    # SM-2 spaced repetition logic (COMPLETE)
│   └── utils/
│       ├── appError.ts          # Custom error classes (COMPLETE)
│       ├── catchAsync.ts        # Async controller wrapper
│       ├── prismaErrorHandler.ts # Prisma error translation
│       ├── userSchema.ts / deckSchema.ts / cardSchema.ts / reviewSchema.ts # Zod schemas (COMPLETE)
├── prisma/
│   └── schema.prisma           # Database schema incl. Better Auth models (COMPLETE)
├── generated/prisma/           # Custom Prisma client output — re-run `npx prisma generate` after schema changes
├── docker-compose.yml          # Local development setup
└── package.json                # Dependencies
```

---

## 🔑 Key Technologies

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js v5
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: Better Auth (Prisma adapter, cookie sessions, email/password + Google OAuth)
- **Validation**: Zod
- **Testing**: Jest, Supertest, ts-jest (ESM)
- **Development**: Docker, Hot-reload
- **Code Quality**: ESLint, Prettier, Husky

---

## 📝 Notes

- Phase 1 error handling has been completed and covered by regression tests
- Phase 2 (Deck/Card/Review CRUD) and Phase 3 (Better Auth) are both complete
- User account creation now flows entirely through Better Auth (`/api/auth/sign-up/email`), not the app's own `POST /user` route
- The roadmap treats testing as part of feature delivery, not a later standalone phase
- Coverage-mode test flakiness (see Critical Issues) should be resolved before adding a CI gate
- Docker setup is ready for development but needs production optimization
