## Plan Complete: Refactor Deck Access

All five card, deck, and review service operations now route through the centralised `deckAccess.service.ts` module. Every single-resource load names a session-derived `Requestor` and an `Action`; every collection query composes `visibleDeckScope`. Bare `getDeckByID`, `getCardByID`, and `requireRole` have been removed, and all 206 tests pass with a clean typecheck and lint.

**Phases Completed:** 5 of 5
1. ✅ Phase 1: Establish the Deck Access Interface
2. ✅ Phase 2: Migrate Deck Reads and Mutations
3. ✅ Phase 3: Migrate All Card Operations
4. ✅ Phase 4: Migrate Reviews and Progress
5. ✅ Phase 5: Remove Bypass Paths and Verify the Contract

**All Files Created/Modified:**
- `src/services/deckAccess.service.ts` — created: `loadDeck`, `loadCard`, `visibleDeckScope`, `Requestor`, `Action`
- `src/model/deckModel.ts` — removed `getDeckByID`; `getAllDecksForUser` replaced by `getDecksByScope`
- `src/model/cardModel.ts` — removed `getCardByID`
- `src/model/reviewModel.ts` — `getDueCards` now accepts `deckScope: Prisma.DeckWhereInput`
- `src/services/deck.service.ts` — all operations accept `Requestor` and delegate to `loadDeck`/`visibleDeckScope`
- `src/services/card.service.ts` — all five operations accept `Requestor`; `getCard`/`updateCard`/`deleteCard` enforce `card.deckId === deckId`
- `src/services/review.service.ts` — `submitReview` calls `loadCard`; `listDueCards` and `getProgress` accept `Requestor`
- `src/routes/deck/deck.controller.ts` — all handlers pass `req.user` as `Requestor`
- `src/routes/card/card.controller.ts` — all handlers pass `req.user` and both route params
- `src/routes/review/review.controller.ts` — all handlers pass `req.user` as `Requestor`
- `src/utils/reviewSchema.ts` — `SubmitReviewInput` no longer carries `userId`
- `src/middlewares/requireRole.ts` — **deleted**
- `__tests__/unit/deckAccess.service.test.ts` — created: full access-matrix coverage
- `__tests__/unit/deck.service.test.ts` — updated: mocks `deckAccess.service`
- `__tests__/unit/card.service.test.ts` — rewritten: mocks `deckAccess.service`; covers all five operations including deckId-mismatch
- `__tests__/unit/review.service.test.ts` — rewritten: mocks `deckAccess.service`; SM-2 cases preserved
- `__tests__/unit/requireRole.test.ts` — **deleted**
- `__tests__/integration/deck.routes.test.ts` — adds 403-for-stranger, collaborator, public-deck cases
- `__tests__/integration/card.routes.test.ts` — adds 403-for-stranger, EDITOR/VIEWER, public-deck, parent-mismatch cases
- `__tests__/integration/review.routes.test.ts` — fixes multi-review sequence; adds 403 for inaccessible decks, public-deck study, due-cards scope exclusion
- `__tests__/setup/factories.ts` — adds `createTestDeckCollaborator(deckId, userId, role)`

**Key Functions/Classes Added:**
- `loadDeck(requestor, deckId, action)` — private deck existence + access matrix enforcement
- `loadCard(requestor, cardId, action)` — card existence + delegates to `loadDeck`
- `visibleDeckScope(requestor)` — returns `Prisma.DeckWhereInput` for collection queries
- `Requestor` / `Action` — structural types exported from `deckAccess.service.ts`

**Test Coverage:**
- Total tests: 206
- All tests passing: ✅
- Typecheck: ✅
- Lint: ✅

**Recommendations for Next Steps:**
- Consider adding an `AGENTS.md` plan-directory entry so future Atlas runs discover `plans/` automatically.
- The `requireSubscription` middleware is untouched; if PRO routes are added, they compose cleanly with the `Requestor` pattern.
