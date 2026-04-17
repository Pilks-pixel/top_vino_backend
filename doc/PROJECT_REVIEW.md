# Top Vino Backend - Project Review & Roadmap

**Date:** April 17, 2026  
**Status:** In Development - Phase 2 TDD-First Kickoff

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
  - `GET /user/auth/:email` - Get by email
  - `GET /user/:id` - Get by ID
  - `POST /user` - Create user
  - `PUT /user/:id` - Update user
  - `DELETE /user/:id` - Delete user
- **Validation**: Zod schema validation middleware (`src/utils/userSchema.ts`)

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

#### 1. Automated Testing Harness 🔴

- No Jest test runner configured yet
- No Supertest integration suite for HTTP behavior yet
- No shared test helpers, fixtures, or database lifecycle utilities yet
- Phase 1 behavior has been manually verified but not yet locked down with regression tests

#### 2. Core Feature Controllers 🔴

- `src/routes/CardController.ts` - **EMPTY**
- `src/routes/DeckController.ts` - **EMPTY**
- `src/routes/CardReviewController.ts` - **EMPTY**

#### 3. Core Feature Models 🔴

- `src/model/cardModel.ts` - **EMPTY**
- `src/model/deckModel.ts` - **EMPTY**
- Other models appear stub-only

### Missing Features

- No authentication/authorization system
- No JWT or session management
- No password hashing (users have no password field!)
- No input sanitization
- No rate limiting
- No API documentation (Swagger/OpenAPI)
- No environment variable validation
- No automated testing infrastructure installed yet (Jest/Supertest planned as Phase 2 kickoff)
- No CI/CD pipeline
- No production deployment configuration
- No health check endpoints
- No graceful shutdown handling
- No database connection pooling configuration

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

### PHASE 3: Authentication & Authorization (2-3 days)

#### Tasks:

1. **Add Authentication**

   - Add password field to User model (migration)
   - Install bcrypt for password hashing
   - Install jsonwebtoken (JWT)
   - Create `/auth/register` and `/auth/login` endpoints
   - Implement JWT generation and validation

2. **Add Authorization Middleware**

   - Extract user from JWT token
   - Protect routes requiring authentication
   - Implement role-based access (FREE vs PRO features)
   - Add ownership checks (users can only modify their data)

3. **Update Existing Endpoints**
   - Add auth middleware to all protected routes
   - Replace hardcoded user lookups with `req.user`

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

---

## 📊 Recommended Timeline

### Week 1-2: Foundation

- Phase 1: Error Handling ✓ complete
- Phase 2 kickoff: test harness + Phase 1 regression coverage
- Phase 2 delivery: Deck and Card slices

### Week 3: Security

- Phase 2 delivery: Card Review slice
- Phase 3: Authentication & Authorization

### Week 4: Quality

- Phase 4: Test expansion and quality gates

### Week 5: Production

- Phase 5: Production Readiness
- Phase 6A: Simple PM2 deployment

### Week 6+ (Optional):

- Phase 6B: Cloud deployment
- Performance optimization
- Caching layer (Redis)
- Real-time features (WebSockets)
- Analytics tracking

---

## 🎯 Immediate Next Steps

1. Set up Jest, Supertest, and shared test helpers
2. Backfill automated tests for completed Phase 1 error handling and User flows
3. Implement Deck, Card, and Card Review slices using TDD
4. Add authentication once core CRUD behavior is covered by tests
5. Continue production hardening after functional coverage improves

---

## 📁 Project Architecture

### Current Structure

```
server/
├── src/
│   ├── app.ts                 # Express app configuration
│   ├── server.ts              # Server entry point
│   ├── lib/
│   │   └── prisma.ts          # Prisma client instance
│   ├── middlewares/
│   │   ├── errorHandler.ts    # Global error handler (COMPLETE)
│   │   └── validationMiddleware.ts  # Zod validation wired into error handling
│   ├── model/                 # Data access layer
│   │   └── usersModel.ts      # User CRUD operations (COMPLETE)
│   ├── routes/                # Controllers & routes
│   │   └── user/
│   │       ├── user.controller.ts  # User HTTP handlers (COMPLETE)
│   │       └── user.router.ts      # User routes (COMPLETE)
│   ├── services/              # Business logic layer
│   │   └── user.service.ts    # User service (COMPLETE)
│   └── utils/
│       ├── appError.ts        # Custom error classes (COMPLETE)
│       ├── catchAsync.ts      # Async controller wrapper
│       ├── prismaErrorHandler.ts # Prisma error translation
│       └── userSchema.ts      # Zod schemas (COMPLETE)
├── prisma/
│   └── schema.prisma          # Database schema (COMPLETE)
├── docker-compose.yml         # Local development setup
└── package.json               # Dependencies
```

---

## 🔑 Key Technologies

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js v5
- **Database**: PostgreSQL with Prisma ORM
- **Validation**: Zod
- **Development**: Docker, Hot-reload
- **Code Quality**: ESLint, Prettier, Husky

---

## 📝 Notes

- Phase 1 error handling has been completed and manually verified
- User module is complete and serves as a template for other modules
- The roadmap now treats testing as part of feature delivery, not a later standalone phase
- The next implementation step is test harness setup plus Phase 1 regression coverage
- Authentication system needs to be added before production
- Docker setup is ready for development but needs production optimization
