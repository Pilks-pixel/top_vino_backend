# Testing Guide

This project uses Jest for automated tests, ts-jest to run TypeScript test files, Supertest for HTTP route tests, and Prisma against a dedicated PostgreSQL test database.

## How to Run the Tests

Run test commands from the `server` directory:

```bash
cd server
```

Install dependencies first if needed:

```bash
npm install
```

Start PostgreSQL before running tests. With the local Docker setup, start the database service:

```bash
docker compose up -d postgres
```

If your Docker version uses the older command, use:

```bash
docker-compose up -d postgres
```

Then run one of the npm scripts:

```bash
npm test
```

Runs the full test suite. This script runs Jest with `--runInBand`, which means test files run one at a time. That is useful because the integration tests share one test database and clean it between tests.

```bash
npm run test:unit
```

Runs tests under `__tests__/unit`. These tests usually mock lower layers, for example service tests mocking model functions.

```bash
npm run test:integration
```

Runs tests under `__tests__/integration`. These tests exercise the Express app with Supertest and use the real test database.

```bash
npm run test:watch
```

Runs Jest in watch mode while developing.

```bash
npm run test:coverage
```

Runs the suite and reports coverage.

## Important Files

- `package.json` contains the Jest config and npm test scripts.
- `tsconfig.test.json` is the TypeScript config used by ts-jest for tests.
- `.env.test` points the test process at the test database.
- `__tests__/setup/jestEnvSetup.js` sets `DATABASE_URL`, `NODE_ENV`, and `PORT` before app modules load.
- `__tests__/setup/globalSetup.ts` runs once before the test suite. It creates the test database if needed and applies Prisma migrations.
- `__tests__/setup/globalTeardown.ts` runs once after the test suite.
- `__tests__/setup/testDb.ts` exports the test Prisma client, `cleanDb`, and `disconnectDb`.
- `__tests__/setup/testApp.ts` exports the Express app for Supertest.
- `__tests__/setup/factories.ts` creates test users, decks, and cards.

## Why There Is a Separate Test Database

Tests should not use the development database. A separate test database gives the test suite a disposable place to create, update, and delete records without risking real development data.

The current test database is:

```text
top_vino_test
```

The main reasons for this design are:

- Safety: tests can freely truncate tables without touching the development database.
- Repeatability: every run starts from the same schema because migrations are applied in `globalSetup`.
- Realism: integration tests use PostgreSQL and Prisma instead of a fake in-memory substitute, so they catch schema, relation, and query issues.
- Isolation: `cleanDb()` removes records between tests so one test does not depend on another test's data.

## What Happens During a Test Run

At a high level, a test run works like this:

1. Jest starts from the config in `package.json`.
2. `jestEnvSetup.js` runs before app modules are loaded and forces `DATABASE_URL` to the test database.
3. `globalSetup.ts` connects to PostgreSQL, creates `top_vino_test` if it does not exist, and runs `prisma migrate deploy` against it.
4. Jest runs the matching test files.
5. Integration tests call `cleanDb()` in `beforeEach`, which truncates application tables and resets identities.
6. Integration tests use factories to create only the records needed for each test.
7. Tests that import `testPrisma` call `disconnectDb()` in `afterAll` to close Prisma connections.
8. `globalTeardown.ts` runs after all test suites complete.

## Unit Tests vs Integration Tests

Unit tests are meant to check one piece of logic at a time. For example, `deck.service.test.ts` mocks the model layer and checks service behavior such as successful returns, not-found errors, and forbidden errors.

Integration tests check that several pieces work together. For example, route tests use Supertest to call the Express app and verify request validation, controller behavior, service behavior, database writes, and error handling.

Both kinds of tests are useful:

- Unit tests are faster and make failures easier to pinpoint.
- Integration tests give confidence that the app works through the real HTTP and database path.

## Is This Standard Practice?

Yes. This is a standard and sensible setup for a Node, Express, TypeScript, Prisma, and PostgreSQL backend.

Common professional patterns shown here include:

- running tests through npm scripts;
- keeping test configuration separate from production code;
- using a dedicated test database;
- applying migrations before integration tests;
- cleaning database state between tests;
- using factories instead of repeating fixture setup in every test;
- testing routes through Supertest rather than starting a real network server.

One thing to be aware of: because `globalSetup` is configured for the whole Jest run, even unit-only runs currently expect PostgreSQL to be available. That is workable, but many projects eventually split Jest into separate unit and integration configs so unit tests can run without a database while integration tests keep the full database setup.

Another thing to watch: because integration tests share one database and clean tables between tests, running integration files in parallel can cause flaky failures if one file truncates data while another file is still using it. The full `npm test` command avoids this by using `--runInBand`.
