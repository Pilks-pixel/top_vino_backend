# Top Vino Backend - Project Review & Roadmap

**Date:** January 31, 2026  
**Status:** In Development - Phase 1 Priority

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

### Error Handling ⚠️ (PARTIAL)

- Custom `AppError` class with status codes (`src/utils/appError.ts`)
- `ValidationError` subclass for validation failures
- Global error handler middleware (`src/middlewares/errorHandler.ts`)
- **However**: Error handler is basic and doesn't handle Prisma errors (as noted in TODO comment)

### Database Schema ✓

- Complete Prisma schema with 8 models
- Migrations created and applied
- Relations properly defined
- Enums for subscription types

---

## ❌ What's Missing / Incomplete

### Critical Issues

#### 1. Error Handling System 🔴 (INCOMPLETE)

- Error handler doesn't catch Prisma-specific errors
- No differentiation for P2002 (unique constraint), P2025 (record not found), etc.
- ValidationError class exists but not integrated with validation middleware
- No error logging/monitoring
- No development vs production error responses

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
- No testing infrastructure (Jest/Supertest)
- No CI/CD pipeline
- No production deployment configuration
- No health check endpoints
- No graceful shutdown handling
- No database connection pooling configuration

---

## 🚀 Development Roadmap

### PHASE 1: Complete Error Handling System (1-2 days)

**Priority: CRITICAL - Pick up where left off**

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

#### Acceptance Criteria:

- All Prisma errors properly caught and transformed
- Validation errors return 400 with details
- Production errors don't leak stack traces
- All controllers use catchAsync wrapper

---

### PHASE 2: Complete Core CRUD Operations (3-5 days)

**Replicate User module pattern for remaining entities**

#### Tasks:

1. **Deck Module**

   - Model: CRUD operations with user ownership checks
   - Service: Business logic for deck creation/deletion
   - Controller: HTTP handlers
   - Router: RESTful endpoints
   - Zod schema validation
   - Test collaborator functionality

2. **Card Module**

   - Model: CRUD operations with deck association
   - Service: Handle different card types
   - Controller: HTTP handlers
   - Router: RESTful endpoints
   - Zod schemas for each card type

3. **Card Review Module**
   - Model: Record review sessions
   - Service: Implement FSRS algorithm
   - Controller: Submit review endpoints
   - Calculate next review date
   - Update user progress

#### Deliverables:

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

### PHASE 4: Testing Infrastructure (3-4 days)

#### Tasks:

1. **Setup Test Environment**

   - Install Jest, Supertest, ts-jest
   - Configure separate test database
   - Create test scripts in package.json
   - Setup test database seeding

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

- Phase 1: Error Handling ← **START HERE**
- Phase 2: Core CRUD (Decks, Cards, Reviews)

### Week 3: Security

- Phase 3: Authentication & Authorization

### Week 4: Quality

- Phase 4: Testing Infrastructure

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

1. ✅ **Complete the error handling system** (Phase 1 - Priority)
2. Implement Deck and Card modules following the User module pattern
3. Add authentication - can't launch without it
4. Write tests - critical for refactoring confidence
5. Production hardening - security and monitoring

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
│   │   ├── errorHandler.ts    # Global error handler (INCOMPLETE)
│   │   └── validationMiddleware.ts  # Zod validation
│   ├── model/                 # Data access layer
│   │   └── usersModel.ts      # User CRUD operations (COMPLETE)
│   ├── routes/                # Controllers & routes
│   │   └── user/
│   │       ├── user.controller.ts  # User HTTP handlers (COMPLETE)
│   │       └── user.router.ts      # User routes (COMPLETE)
│   ├── services/              # Business logic layer
│   │   └── user.service.ts    # User service (COMPLETE)
│   └── utils/
│       ├── appError.ts        # Custom error classes (PARTIAL)
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

- Project was left mid-implementation of the error handling system
- User module is complete and serves as a template for other modules
- Authentication system needs to be added before production
- No tests exist yet - testing infrastructure needs to be built
- Docker setup is ready for development but needs production optimization
