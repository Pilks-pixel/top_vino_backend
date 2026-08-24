# Plan: Refactor Deck Access

**Created:** 2026-08-17
**Status:** Ready for Atlas Execution

## Summary

Implement the settled Deck Access module so every single-deck or single-card load names a session-derived Requestor and an Action, and every collection query composes the same visibility scope. The refactor will centralize owner, collaborator, and Public Deck decisions behind `loadDeck`, `loadCard`, and `visibleDeckScope`; migrate deck, card, and review callers in vertical TDD slices; remove the unused `requireRole` middleware and bare ID loaders; and preserve the agreed 404-for-absent versus 403-for-existing-but-forbidden contract.

This plan follows `../CONTEXT.md` and `../docs/adr/0001-loading-a-deck-is-authorizing-it.md`. The interface and semantics are already decided and must not be redesigned during implementation.

## Context & Analysis

### Relevant Files

- `src/services/deckAccess.service.ts` (create): the Deck Access module and its complete public interface.
- `src/model/deckModel.ts`: replace `getDeckByID` and make deck collection reads require a visibility scope.
- `src/model/cardModel.ts`: replace `getCardByID` and make card collection reads require a visibility scope.
- `src/model/reviewModel.ts`: scope due-card queries to decks the Requestor can currently read.
- `src/services/deck.service.ts`: replace inline ownership decisions and controller-provided visibility branching with Deck Access.
- `src/services/card.service.ts`: authorize all five card operations through the card's parent deck.
- `src/services/review.service.ts`: authorize review submission, Progress reads, and due-card collection reads.
- `src/routes/deck/deck.controller.ts`: pass the Requestor and stop deciding public visibility.
- `src/routes/card/card.controller.ts`: pass the Requestor and both nested resource IDs.
- `src/routes/review/review.controller.ts`: pass the Requestor separately from review input.
- `src/utils/reviewSchema.ts`: keep client review input separate from the session-derived Requestor ID.
- `src/middlewares/requireRole.ts` (delete): remove the unused, bypassable authorization middleware.
- `__tests__/unit/deckAccess.service.test.ts` (create): replacement test surface for the useful cases in `requireRole.test.ts`.
- `__tests__/unit/requireRole.test.ts` (delete): remove the obsolete middleware contract after its behavior has moved.
- `__tests__/unit/deck.service.test.ts`: update service signatures and Deck Access expectations.
- `__tests__/unit/card.service.test.ts`: update all operations to use Requestor and Action.
- `__tests__/unit/review.service.test.ts`: preserve SM-2 coverage while adding Deck Access expectations.
- `__tests__/setup/factories.ts`: add a Deck Collaborator factory for role-based integration fixtures.
- `__tests__/integration/deck.routes.test.ts`: correct the cross-user private-deck read expectation and cover the access matrix.
- `__tests__/integration/card.routes.test.ts`: add owner/editor/viewer/public/private and nested-parent cases.
- `__tests__/integration/review.routes.test.ts`: cover studying readable decks and rejecting inaccessible cards or stale Progress.

No Prisma schema or migration change is required. Do not regenerate `generated/prisma` unless implementation unexpectedly changes `prisma/schema.prisma`.

### Key Functions and Types

- `loadDeck(requestor, deckId, action)` in `deckAccess.service.ts`: privately fetch the deck, return 404 when absent, evaluate owner/public/collaborator access, and return 403 when the existing deck does not permit the Action.
- `loadCard(requestor, cardId, action)` in `deckAccess.service.ts`: privately fetch the card, return 404 when absent, authorize through `loadDeck(requestor, card.deckId, action)`, and return the card.
- `visibleDeckScope(requestor)` in `deckAccess.service.ts`: return a `Prisma.DeckWhereInput` matching decks owned by the Requestor, Public Decks, or decks on which the Requestor is a Collaborator.
- `Requestor`: an exported structural type containing at least `id: string`; it must not import Express types. `req.user` satisfies it structurally.
- `Action`: the exact union `"read" | "edit" | "delete"`.
- `listDecksForUser(requestor, targetUserId)`: combine `{ userId: targetUserId }` with `visibleDeckScope(requestor)`, retaining the route's target-owner filter while adding collaborator visibility.
- `listCardsForDeck(requestor, deckId)`: load the parent deck for `read`, then execute a visibility-scoped card query.
- `getCard` / `updateCard` / `deleteCard`: load the card with `read` or `edit`, then verify its actual `deckId` matches the nested route's `:deckId` before returning or mutating it.
- `submitReview(requestor, input)`: use `loadCard(..., "read")`; derive review and Progress `userId` only from `requestor.id`.
- `listDueCards(requestor)`: compose `visibleDeckScope(requestor)` into the nested `card.deck` relation.
- `getProgress(requestor, cardId)`: authorize the card for `read` before returning Requestor-owned Progress.

### Access Matrix

| Requestor relationship | `read` | `edit` | `delete` |
| --- | --- | --- | --- |
| Owner | allow | allow | allow |
| `EDITOR` Collaborator | allow | allow | 403 |
| `VIEWER` Collaborator | allow | 403 | 403 |
| Authenticated Requestor, Public Deck | allow | 403 | 403 |
| Authenticated Requestor, private unshared deck | 403 | 403 | 403 |
| Missing deck or card | 404 | 404 | 404 |

Card creation, update, and deletion are `edit` Actions on the parent deck. Deck deletion alone uses `delete`. Review submission and Progress operations use `read` because Progress belongs to the Requestor.

### Dependencies

- Prisma 6.9: use `Prisma.DeckWhereInput`, the `Deck.collaborators.some` relation filter, the `Card.deck` relation filter, and the `deckId_userId` compound unique lookup.
- Generated Prisma client: use the repository's `generated/prisma/*.js` import convention, including `CollaboratorRole.EDITOR`.
- Existing `ForbiddenError` and `NotFoundError`: preserve the centralized operational error contract; do not add HTTP concerns to Deck Access.
- Jest 30 with ESM and ts-jest: unit mocks must be registered with `jest.unstable_mockModule` before dynamic imports.
- Supertest and the shared PostgreSQL test database: all focused integration commands must use `--runInBand`.

### Patterns & Conventions

- Deck Access is a deep module: callers learn three operations while owner, collaborator, Public Deck, existence, and query-shape details remain local to its implementation.
- The Requestor always comes from `req.user`; user-supplied `userId` must never influence authorization or Progress ownership.
- A single-resource loader may perform a private existence read so it can distinguish 404 from 403. No public bare `getDeckByID(id)` or `getCardByID(id)` may survive.
- Collection reads must compose `visibleDeckScope` into their Prisma query. Do not fetch an unscoped collection and filter it in memory.
- Authorization belongs in the service call path, not only in routers, so non-HTTP callers cannot bypass it.
- TDD proceeds vertically: one behavior test, minimal implementation, focused validation, then the next behavior.

## Implementation Phases

### Phase 1: Establish the Deck Access Interface

**Objective:** Replace the obsolete role middleware contract with the settled Requestor-and-Action Deck Access interface.

**Files to Modify/Create/Delete:**

- Create `src/services/deckAccess.service.ts`.
- Create `__tests__/unit/deckAccess.service.test.ts` by translating the useful owner/editor/viewer cases from `requireRole.test.ts` to the new interface.
- Delete `src/middlewares/requireRole.ts` and `__tests__/unit/requireRole.test.ts` only after equivalent Deck Access tests are green.

**Tests to Write:**

- `loadDeck returns an owned deck for every Action`.
- `loadDeck permits EDITOR read and edit but rejects delete`.
- `loadDeck permits VIEWER read but rejects edit and delete`.
- `loadDeck permits read of a Public Deck but rejects edit`.
- `loadDeck returns 403 for an existing inaccessible deck and 404 for an absent deck`.
- `loadCard authorizes through the card's actual deck and preserves card 404 versus deck 403`.
- `visibleDeckScope includes owner, Public Deck, and Collaborator predicates for the Requestor`.

**Steps:**

1. Write the first failing owner `loadDeck` test, mocking only the Prisma methods used by Deck Access.
2. Add the structural `Requestor` type, `Action` union, and the smallest `loadDeck` implementation that satisfies owner access and absent-deck 404.
3. Run the Deck Access unit test file with `--runInBand`.
4. Add one access-matrix behavior at a time in this order: editor, viewer, Public Deck, inaccessible private deck; implement the minimum branch and rerun after each test.
5. Add `loadCard` composition tests and implementation, then add the pure `visibleDeckScope` test and implementation.
6. Delete `requireRole.ts` and its old test after the replacement suite covers its useful behavior plus public and delete semantics.
7. Run the Deck Access unit suite and `npm run check-types` before migrating callers.

**Acceptance Criteria:**

- [ ] The public interface is exactly `loadDeck`, `loadCard`, and `visibleDeckScope`, plus their supporting Requestor/Action types.
- [ ] Bare Prisma deck/card unique reads are private implementation details of Deck Access.
- [ ] All access-matrix outcomes and 403/404 distinctions pass through the new interface.
- [ ] `requireRole` and its middleware tests are removed without losing behavioral coverage.

---

### Phase 2: Migrate Deck Reads and Mutations

**Objective:** Route deck listing, loading, editing, and deletion through Deck Access while leaving creation as authenticated but resource-independent.

**Files to Modify:**

- `src/model/deckModel.ts`
- `src/services/deck.service.ts`
- `src/routes/deck/deck.controller.ts`
- `__tests__/unit/deck.service.test.ts`
- `__tests__/integration/deck.routes.test.ts`
- `__tests__/setup/factories.ts`

**Tests to Write:**

- Deck service maps get/update/delete to `read`/`edit`/`delete` with the supplied Requestor.
- An `EDITOR` can update deck metadata but cannot delete the deck.
- A `VIEWER` and a public-only Requestor can read but cannot update or delete.
- A private, unshared deck returns 403 to another authenticated Requestor.
- Deck listing returns only target-owner decks that also satisfy `visibleDeckScope`, including a Collaborator-visible private deck.

**Steps:**

1. Add `createTestDeckCollaborator(deckId, userId, role)` to the shared factory using the generated `CollaboratorRole` type.
2. Correct the existing integration test that currently expects a private deck owned by another user to return 200; make owner read the first red-green tracer bullet, then add the explicit stranger 403 case.
3. Change `getDeck`, `updateDeck`, and `deleteDeck` to accept a structural Requestor and invoke Deck Access with the corresponding Action; remove service-local ownership checks.
4. Update `httpGetDeck`, `httpUpdateDeck`, and `httpDeleteDeck` to pass `req.user`, and update the unit tests to assert the Deck Access calls.
5. Add one integration case at a time for editor, viewer, and Public Deck behavior, validating after each behavior.
6. Replace `getAllDecksForUser(userId, isPublic?)` with a mandatory-scope query and change `listDecksForUser` to combine the target owner with `visibleDeckScope(requestor)`.
7. Simplify `httpListDecks`: validate the optional `userId`, choose only `targetUserId`, and remove `isPublicFilter` policy branching.
8. Keep `createDeck` free of Deck Access because no deck exists yet; pass the Requestor separately and derive persisted `userId` from it rather than accepting ownership in service input.
9. Run the focused deck unit and integration suites, then typecheck.

**Acceptance Criteria:**

- [ ] `GET /deck/:id` no longer exposes another Requestor's private unshared deck.
- [ ] Editors can edit, viewers can read, and only owners can delete.
- [ ] `GET /deck?userId=...` applies target-owner filtering and Deck Access visibility in the database query.
- [ ] The controller no longer decides whether results must be public.
- [ ] Deck creation still works for authenticated FREE users and cannot accept a client-selected owner.

---

### Phase 3: Migrate All Card Operations

**Objective:** Make every card path inherit access from its parent deck and enforce the nested deck/card relationship.

**Files to Modify:**

- `src/model/cardModel.ts`
- `src/services/card.service.ts`
- `src/routes/card/card.controller.ts`
- `__tests__/unit/card.service.test.ts`
- `__tests__/integration/card.routes.test.ts`

**Tests to Write:**

- Listing cards loads the parent deck with `read` and executes a visibility-scoped query.
- Getting a card uses `read`; creating, updating, and deleting a card use `edit`.
- Owner and `EDITOR` can mutate cards; `VIEWER` and a public-only Requestor can only read.
- An authenticated stranger receives 403 for cards in an existing private unshared deck.
- A missing deck/card receives 404.
- A card whose actual `deckId` differs from the route's `:deckId` is treated as a missing nested resource (404) after access to the actual card has been evaluated.

**Steps:**

1. Add a failing card-list integration test for a private unshared deck, then require `listCardsForDeck(requestor, deckId)` to call `loadDeck(..., "read")`.
2. Change `getCardsForDeck` to require and compose a deck visibility scope in its Prisma `where` clause; keep the prior `loadDeck` call to preserve 403 versus 404.
3. Migrate card get as the first single-card tracer bullet: controller passes Requestor and both IDs, service calls `loadCard(..., "read")`, and the focused tests pass.
4. Add nested parent mismatch coverage and compare `card.deckId` with the route `deckId`, returning `NotFoundError("Card", cardId)` on mismatch.
5. Migrate create with `loadDeck(..., "edit")`, then update and delete with `loadCard(..., "edit")`, one red-green behavior at a time.
6. Remove `getCardByID` from `cardModel.ts` once all callers use Deck Access.
7. Add editor/viewer/public/private integration cases without duplicating every matrix cell for every endpoint: cover each distinct Action and relationship at least once, while retaining all existing validation, authentication, and missing-resource tests.
8. Run the focused card unit and integration suites, then typecheck.

**Acceptance Criteria:**

- [ ] All five card operations require a session-derived Requestor.
- [ ] Reads permit owner/editor/viewer/public access; mutations permit only owner/editor access.
- [ ] Nested card routes cannot address a card through a different deck URL.
- [ ] Card collection rows are scoped in the Prisma query rather than filtered after retrieval.
- [ ] No feature module can import a bare card loader.

---

### Phase 4: Migrate Reviews and Progress

**Objective:** Authorize study operations as card reads while keeping Progress owned by the Requestor and excluding cards that are no longer visible.

**Files to Modify:**

- `src/utils/reviewSchema.ts`
- `src/model/reviewModel.ts`
- `src/services/review.service.ts`
- `src/routes/review/review.controller.ts`
- `__tests__/unit/review.service.test.ts`
- `__tests__/integration/review.routes.test.ts`

**Tests to Write:**

- Review submission calls `loadCard(requestor, cardId, "read")` before either review/progress write.
- A Requestor can study their own, an editor/viewer Collaborator's, or a Public Deck's card and receives their own Progress.
- Review submission for an existing inaccessible private card returns 403 and performs no writes.
- Progress lookup authorizes the card before returning Requestor-owned Progress.
- Due cards include only Progress rows whose cards remain readable under `visibleDeckScope`.

**Steps:**

1. Separate `SubmitReviewInput` from `userId`; change `submitReview` to accept `(requestor, input)` and derive all persistence `userId` values from `requestor.id`.
2. Add the failing inaccessible-card review test, invoke `loadCard(..., "read")` before `getCardProgress` or either write, and rerun the focused review unit suite.
3. Preserve existing SM-2 tests by supplying an allowed Deck Access result; do not alter scheduling behavior in this refactor.
4. Change `httpSubmitReview` to pass `req.user` separately and ensure a body `userId`, if supplied, has no effect.
5. Add integration coverage for Public Deck study success and private unshared deck 403.
6. Change `getProgress` to accept a Requestor, call `loadCard(..., "read")`, then query Progress by `[requestor.id, cardId]`; add allowed, forbidden, card-missing, and progress-missing cases.
7. Change `listDueCards`/`getDueCards` to accept the Requestor and compose `visibleDeckScope(requestor)` under the Prisma `card.deck` relation.
8. Add an integration test in which due Progress exists, then deck visibility or collaboration is removed; assert the card is excluded from `GET /review/due`.
9. Run the focused review unit and integration suites, then typecheck.

**Acceptance Criteria:**

- [ ] No review or Progress operation can be performed against an unreadable card.
- [ ] Studying another user's readable deck creates Progress for the Requestor, not the deck owner or a body-supplied user.
- [ ] Due-card results reflect current Deck Access, including revoked collaboration or visibility.
- [ ] Existing SM-2 scheduling behavior remains unchanged and fully covered.

---

### Phase 5: Remove Bypass Paths and Verify the Contract

**Objective:** Complete the refactor by proving that no public unguarded deck/card read remains and that the full application contract is green.

**Files to Modify/Delete:**

- Remove `getDeckByID` from `src/model/deckModel.ts` after its final caller migrates.
- Remove stale imports, mocks, and test setup referring to `getDeckByID`, `getCardByID`, or `requireRole` across `src/` and `__tests__/`.
- Leave `src/middlewares/requireOwnership.ts` unchanged on the two user routes.
- Leave `src/middlewares/requireSubscription.ts` and its unit tests unchanged; no current route is designated PRO-only.

**Tests and Checks:**

- Source scan for forbidden loader and middleware symbols.
- Source scan showing direct `prisma.deck.findUnique` and `prisma.card.findUnique` only inside Deck Access.
- Combined focused Deck Access/deck/card/review unit and integration suites.
- Full typecheck, lint, formatting check, and serial test suite.

**Steps:**

1. Remove the final bare loader exports and stale mocks only after all migrated suites are green.
2. Run `rg "getDeckByID|getCardByID|requireRole" src __tests__`; require no matches.
3. Run `rg "prisma\.(deck|card)\.findUnique" src`; inspect every match and require the access-sensitive unique reads to live only inside `deckAccess.service.ts`.
4. Run the combined focused suite with `--runInBand`.
5. Run `npm run check-types`, `npm run lint`, and Prettier in check mode on touched files.
6. Start PostgreSQL if necessary and run `npm test`; investigate only failures related to this refactor and report unrelated pre-existing failures separately.
7. Review the diff for accidental schema/generated-client changes, unrelated formatting churn, and any request body path that still supplies the Requestor identity.

**Acceptance Criteria:**

- [ ] No bare `getDeckByID`, `getCardByID`, or `requireRole` symbol remains.
- [ ] All deck/card read paths either use a Requestor-and-Action loader or a mandatory visibility scope.
- [ ] 401, 403, and 404 behavior remains distinguishable through the HTTP error handler.
- [ ] Focused and full serial tests, typecheck, lint, and formatting checks pass.
- [ ] No schema migration or generated Prisma churn is included.

## Validation Commands

Run from the `server/` repository root. PostgreSQL and the test environment are required even for focused Jest runs because global setup always executes.

```bash
node --experimental-vm-modules node_modules/.bin/jest --runInBand __tests__/unit/deckAccess.service.test.ts
node --experimental-vm-modules node_modules/.bin/jest --runInBand __tests__/unit/deck.service.test.ts __tests__/integration/deck.routes.test.ts
node --experimental-vm-modules node_modules/.bin/jest --runInBand __tests__/unit/card.service.test.ts __tests__/integration/card.routes.test.ts
node --experimental-vm-modules node_modules/.bin/jest --runInBand __tests__/unit/review.service.test.ts __tests__/integration/review.routes.test.ts
node --experimental-vm-modules node_modules/.bin/jest --runInBand \
  __tests__/unit/deckAccess.service.test.ts \
  __tests__/unit/deck.service.test.ts \
  __tests__/unit/card.service.test.ts \
  __tests__/unit/review.service.test.ts \
  __tests__/integration/deck.routes.test.ts \
  __tests__/integration/card.routes.test.ts \
  __tests__/integration/review.routes.test.ts
npm run check-types
npm run lint
npx prettier --check src __tests__
npm test
```

Do not use `npm run test:unit` or `npm run test:integration` without appending `-- --runInBand`; both scripts otherwise run against the shared test database concurrently.

## Open Questions

1. Which gh-stack branch should carry Deck Access?
   - **Option A:** Use the current `feat/user-refactor` branch if it was created for this work and remains identical to its parent.
   - **Option B:** Create or rename to a dedicated `feat/deck-access` branch if `feat/user-refactor` has separate intended scope or an existing review identity.
   - **Recommendation:** Before the first implementation commit, inspect the current stack and use a dedicated Deck Access branch name unless renaming would disrupt an existing pull request. Do not mix unrelated user refactoring into this change.

2. Where should the shared domain and ADR documents live long term?
   - **Option A:** Move `CONTEXT.md` and `docs/adr/` into the `server/` Git repository and update `docs/agents/domain.md`.
   - **Option B:** Make `top_vino/` the repository root so shared documents and the server are versioned together.
   - **Recommendation:** Track this as a separate repository-structure decision. The current `server/AGENTS.md` explicitly points to the parent documents, so their location does not block this implementation, but leaving architecture decisions unversioned is an acknowledged durability risk.

3. Where should `requireSubscription("PRO")` be mounted?
   - **Option A:** Mount it on a specifically designated PRO-only route after `authMiddleware`.
   - **Option B:** Apply it broadly to deck/card/review routes.
   - **Recommendation:** Make no mount change in this refactor. Current routes and integration tests use FREE Requestors, and no source or product document designates an existing endpoint as PRO-only. Broad gating would conflate Subscription Tier with Deck Access and introduce an unsupported behavior change.

## Risks & Mitigation

- **Risk:** A scoped single-resource query collapses missing and forbidden resources into the same result.
  - **Mitigation:** Keep the unique read private inside Deck Access and evaluate access after confirming existence.
- **Risk:** A future caller bypasses authorization through a retained model helper.
  - **Mitigation:** Delete bare loaders, require scopes on collection helpers, and enforce the final source scans.
- **Risk:** Deck list behavior changes unexpectedly for another user's decks.
  - **Mitigation:** Preserve the target-owner filter and add visibility as an `AND`; document and test the intentional addition of private decks shared with the Requestor.
- **Risk:** Nested card URLs can address cards from a different parent deck.
  - **Mitigation:** Pass both route IDs to card services and return 404 when the loaded card's actual parent differs.
- **Risk:** Existing Progress exposes a card after a deck becomes private or collaboration is revoked.
  - **Mitigation:** Scope due-card queries and authorize single Progress reads against current Deck Access.
- **Risk:** Refactoring `submitReview` accidentally changes SM-2 behavior.
  - **Mitigation:** Keep scheduling code untouched and retain all current progression tests while changing only identity and access plumbing.
- **Risk:** Shared-database test cleanup causes intermittent 404 or unique-constraint failures.
  - **Mitigation:** Run every focused and full integration command with `--runInBand`; do not use coverage as the first red-green signal.
- **Risk:** Authorization and mutation occur in separate database operations.
  - **Mitigation:** Accept the existing time-of-check/time-of-use window for this refactor; action-aware mutation queries or transactions require a separate design decision.
- **Risk:** Moving Deck Access into the model layer creates shallow or circular dependencies.
  - **Mitigation:** Put the deep module in `src/services/deckAccess.service.ts`, let it own the private Prisma unique reads, and pass mandatory query fragments down to collection model functions.

## Success Criteria

- [ ] Every deck/card single-resource load names a Requestor and Action.
- [ ] Every deck/card collection query composes Deck Access visibility in Prisma.
- [ ] Owner, editor, viewer, Public Deck, private stranger, and missing-resource behaviors match the settled matrix.
- [ ] Cards, reviews, and Progress inherit access from their deck.
- [ ] Progress remains keyed to the session-derived Requestor.
- [ ] `requireRole`, `getDeckByID`, and `getCardByID` are removed.
- [ ] `requireOwnership` remains limited to user routes; Subscription Tier remains separate from Deck Access.
- [ ] All focused and full serial tests, typecheck, lint, and formatting checks pass.
- [ ] Code follows the repository's ESM, Prisma import, error, and test conventions.

## Notes for Atlas

- Treat the interface, action vocabulary, Public Deck semantics, 403/404 distinction, middleware fate, and Subscription Tier separation as settled by ADR 0001. Do not re-grill them.
- Execute each phase as vertical red-green slices. After the first substantive edit in a slice, immediately run the narrowest relevant test before reading or editing elsewhere.
- The repository root is `server/`, not its parent `top_vino/`. The domain glossary and ADR currently live one level above and are not versioned with the repository.
- Work with any user changes already present; do not reset or reformat unrelated files.
- There is no schema change in the planned solution, so Prisma generation should remain untouched.