## Phase 2 Complete: Test Harness & Deck/Card/Review Vertical Slices

All four vertical slices are implemented and tested with TDD. The test suite runs 98 tests across 9 suites (5 unit, 4 integration), all passing against a dedicated `top_vino_test` Postgres database.

**Files created/changed:**

- `__tests__/setup/globalSetup.ts` — creates test DB + runs migrations
- `__tests__/setup/globalTeardown.ts` — teardown hook
- `__tests__/setup/jestEnvSetup.js` — sets `DATABASE_URL` before any module loads
- `__tests__/setup/jestEnvSetup.ts` — superseded by .js version
- `__tests__/setup/testDb.ts` — testPrisma client + `cleanDb()` + `disconnectDb()`
- `__tests__/setup/testApp.ts` — re-exports app for Supertest
- `__tests__/setup/factories.ts` — `createTestUser`, `createTestDeck`, `createTestCard`
- `__tests__/unit/appError.test.ts` — AppError hierarchy unit tests
- `__tests__/unit/user.service.test.ts` — user service unit tests
- `__tests__/unit/deck.service.test.ts` — deck service unit tests
- `__tests__/unit/card.service.test.ts` — card service unit tests
- `__tests__/unit/review.service.test.ts` — review service + SM-2 unit tests
- `__tests__/integration/user.routes.test.ts` — user CRUD integration tests
- `__tests__/integration/deck.routes.test.ts` — deck CRUD + ownership integration tests
- `__tests__/integration/card.routes.test.ts` — card CRUD nested under deck
- `__tests__/integration/review.routes.test.ts` — review submit + due cards + progress
- `tsconfig.test.json` — Jest-specific tsconfig overrides
- `.env.test` — test environment variables
- `src/utils/deckSchema.ts` — Zod schema for deck create/update
- `src/utils/cardSchema.ts` — Zod schema for card create/update
- `src/utils/reviewSchema.ts` — Zod schema for review submission
- `src/model/deckModel.ts` — Prisma deck model (CRUD)
- `src/model/cardModel.ts` — Prisma card model (CRUD)
- `src/model/reviewModel.ts` — Prisma review/progress model
- `src/services/deck.service.ts` — deck business logic + ownership checks
- `src/services/card.service.ts` — card business logic + deck existence checks
- `src/services/review.service.ts` — SM-2 spaced repetition algorithm
- `src/routes/deck/deck.controller.ts` + `deck.router.ts`
- `src/routes/card/card.controller.ts` + `card.router.ts`
- `src/routes/review/review.controller.ts` + `review.router.ts`
- `src/app.ts` — updated to mount all 4 routers
- `package.json` — jest config: `--runInBand`, `setupFiles`, `globalSetup/Teardown`

**Functions created/changed:**

- `getAllDecksForUser`, `getDeckByID`, `createDeck`, `updateDeckByID`, `deleteDeckByID`
- `listDecksForUser`, `getDeck`, `createDeck` (service), `updateDeck`, `deleteDeck`
- `getCardsForDeck`, `getCardByID`, `createCard`, `updateCardByID`, `deleteCardByID`
- `listCardsForDeck`, `getCard`, `createCard` (service), `updateCard`, `deleteCard`
- `createReview`, `getDueCards`, `getCardProgress`, `upsertCardProgress`
- `submitReview`, `listDueCards`, `getProgress`, `sm2` (SM-2 algorithm)
- `cleanDb`, `disconnectDb`, `createTestUser`, `createTestDeck`, `createTestCard`

**Tests created/changed:**

- 98 tests total across 9 suites
- Unit tests: 43 (appError: 5, user.service: 11, deck.service: 10, card.service: 9, review.service: 8)
- Integration tests: 55 (user.routes: 13, deck.routes: 13, card.routes: 14, review.routes: 8 + 2 others + 3 due/progress)

**Review Status:** APPROVED

**Git Commit Message:**

```
feat: implement Deck, Card, and Review vertical slices with TDD

- Add Jest/Supertest test infrastructure with dedicated test DB
- Add Phase 1 regression tests (user routes, service, appError)
- Add Deck CRUD with ownership enforcement via userId query param
- Add Card CRUD nested under /deck/:deckId/cards
- Add Review submission with SM-2 spaced repetition algorithm
- Fix test env isolation: setupFiles + --runInBand + jestEnvSetup.js
```
