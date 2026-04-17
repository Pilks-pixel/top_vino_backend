# Top Vino Backend

A spaced repetition learning/flashcard application backend built with Node.js, Express, TypeScript, and Prisma.

## 📚 Documentation

- [Project Review & Roadmap](./doc/PROJECT_REVIEW.md) - Complete overview of the project status and development roadmap
- [Phase 1: Error Handling](./doc/PHASE_1_ERROR_HANDLING.md) - Completed implementation details and acceptance criteria
- [Phase 2 TDD PRD](./plans/phase-2-tdd-prd.md) - TDD-first execution plan for testing setup and core CRUD delivery

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server with Docker
docker-compose up

# Or run locally (requires PostgreSQL)
npm run dev
```

## 📋 Current Status

**In Development - Phase 2: TDD-First Kickoff**

### Completed ✅

- User CRUD operations
- Centralized error handling with Prisma and validation support
- Database schema and migrations
- Docker development environment

### In Progress 🚧

- Planning and setup for Jest and Supertest
- Backfilling automated regression tests for Phase 1 behavior
- Preparing Deck, Card, and Card Review slices for TDD delivery

### Next Up 📌

- Install the automated test harness and shared test helpers
- Write Phase 1 regression tests before new feature implementation
- Build Deck, Card, and Card Review flows as tested vertical slices

See [PROJECT_REVIEW.md](./doc/PROJECT_REVIEW.md) for detailed roadmap.
