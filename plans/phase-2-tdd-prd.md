# Plan: Phase 2 PRD - Core CRUD Delivery with TDD Foundation

**Created:** 2026-04-14
**Status:** Ready for Atlas Execution

## Summary

Phase 2 should not begin with feature implementation. The next correct step is to establish a repeatable test harness, backfill regression coverage for the newly completed Phase 1 error-handling behavior, and then implement Deck, Card, and Card Review flows using a test-driven approach. This reduces regression risk, locks in the error contract already verified manually, and gives the project a scalable pattern for all later phases.

## Context & Analysis

**Relevant Files:**

- src/app.ts: Express entrypoint currently mounts only the user router and global error handler; integration tests should exercise this app directly.
- src/routes/user/user.router.ts: Existing route surface provides the best reference pattern for new route modules and early integration coverage.
- src/routes/user/user.controller.ts: Already refactored to use centralized async error handling and should be regression tested before extending the pattern.
- src/services/user.service.ts: Existing business logic layer is the best first unit-test target and reference for future deck/card services.
- src/middlewares/errorHandler.ts: Centralized error contract now exists and should be locked down with HTTP-level tests before further feature work.
- src/middlewares/validationMiddleware.ts: Validation behavior should be asserted via integration tests because it shapes external API responses.
- prisma/schema.prisma: Defines User, Deck, DeckCollaborator, Card, UserCardProgress, UserResponse, and UserCardReview entities that Phase 2 will expose incrementally.
- src/model/deckModel.ts: Present but empty; expected home for deck data-access primitives.
- src/model/cardModel.ts: Present but empty; expected home for card data-access primitives.
- src/routes/DeckController.ts: Present but empty; should be replaced or reorganized into a module aligned with the user route structure.
- src/routes/CardController.ts: Present but empty; should be implemented only after test harness and deck slice are in place.
- src/routes/CardReviewController.ts: Present but empty; likely the final Phase 2 slice because review logic touches the most domain state.
- package.json: Currently lacks test tooling, scripts, and test environment workflows.

**Key Functions/Classes:**

- AppError hierarchy: Defines the application error contract that must now be covered by tests.
- errorHandler middleware: Converts application and Prisma failures into the external JSON error shape.
- validationMiddleware: Enforces Zod request validation and feeds the centralized error flow.
- catchAsync utility: Standard async controller wrapper that should become the norm across all new HTTP modules.
- User service CRUD functions: Serve as the baseline service-layer contract and unit-testing pattern.

**Dependencies:**

- Express 5: HTTP application framework and the primary integration test surface.
- Prisma: ORM and source of database-backed integration behavior and database-specific error translation.
- Zod: Request validation boundary for HTTP tests and schema-driven request contracts.
- Jest: Proposed test runner for unit and integration coverage.
- Supertest: Proposed HTTP assertion tool for app-level integration tests.

**Patterns & Conventions:**

- Layered structure already exists: router/controller, service, model, middleware, utils.
- User module is the only complete vertical slice and should be treated as the baseline for naming and separation of concerns.
- Error handling has been centralized; future features should route failures through shared middleware rather than inline HTTP responses.
- Current roadmap defers testing to Phase 4, but the safer path is to move test harness setup and test authoring into the beginning of each implementation phase.

## Product Requirements Document

### Problem Statement

The backend has one working vertical slice for users and a newly completed centralized error-handling system, but it still lacks an automated safety net. Phase 2 is intended to add the core deck, card, and review workflows that define the product, yet implementing these flows without tests would make regressions likely and would slow down future work on authentication, production hardening, and deployment. The project needs a Phase 2 plan that treats testing as part of delivery rather than a later cleanup step.

### Solution

Establish Jest and Supertest at the start of the next delivery phase, add regression coverage for the Phase 1 error-handling contract and existing user behaviors, and then build Deck, Card, and Card Review features as vertical slices using TDD. Each slice should begin with failing unit and integration tests, proceed with the smallest implementation required to satisfy those tests, and leave behind reusable helpers for database setup, test fixtures, and HTTP assertions.

### User Stories

1. As a backend developer, I want a working Jest test runner, so that I can verify behavior quickly while developing new features.
2. As a backend developer, I want Supertest-based HTTP coverage against the Express app, so that I can validate the public API contract instead of relying on manual curl checks.
3. As a backend developer, I want reusable test helpers for app bootstrapping and database cleanup, so that tests are isolated and easy to extend.
4. As a backend developer, I want regression tests for the centralized error handler, so that future changes do not break error status codes or response shapes.
5. As a backend developer, I want regression tests for validation failures, so that malformed requests always return predictable error payloads.
6. As a backend developer, I want regression tests for Prisma-backed conflict and not-found behavior, so that database exceptions remain translated into API-safe responses.
7. As a learner, I want to create a deck with a name, owner, topic, and visibility, so that I can organize my study material.
8. As a learner, I want to view my decks, so that I can find and manage what I created.
9. As a learner, I want to fetch a specific deck, so that I can inspect its metadata and related content.
10. As a learner, I want to update a deck, so that I can change its name, topic, or visibility.
11. As a learner, I want to delete a deck, so that I can remove outdated study material.
12. As a learner, I want deck ownership rules enforced, so that users cannot manipulate decks they do not own.
13. As a collaborator, I want collaborator behavior to be testable and incrementally introducible, so that future sharing features have a safe foundation.
14. As a learner, I want to create a card inside a deck, so that I can build study content for that deck.
15. As a learner, I want multiple card types supported through validation, so that the API can represent basic, multiple-choice, cloze, and open-ended cards safely.
16. As a learner, I want card creation rules validated per card type, so that invalid payloads are rejected before corrupting data.
17. As a learner, I want to list cards for a deck, so that I can review the content attached to a specific deck.
18. As a learner, I want to fetch a single card, so that I can inspect or edit it.
19. As a learner, I want to update a card, so that I can improve wording, answers, and metadata.
20. As a learner, I want to delete a card, so that I can remove low-quality or obsolete prompts.
21. As a learner, I want cards to remain correctly associated with their parent deck, so that data integrity is preserved.
22. As a learner, I want invalid deck references rejected, so that card creation cannot attach to missing decks.
23. As a learner, I want to submit a card review with a quality score, so that the system can track review history.
24. As a learner, I want review submission to update future scheduling fields, so that the app can support spaced repetition.
25. As a learner, I want review history stored separately from current progress, so that scheduling decisions remain auditable.
26. As a learner, I want progress fields updated predictably after review submission, so that the next study session uses current data.
27. As a backend developer, I want review logic implemented behind a clear service interface, so that the scheduling algorithm can evolve independently from transport code.
28. As a backend developer, I want unit tests around the review service, so that review progression rules can be changed safely later.
29. As a backend developer, I want integration tests for each new endpoint as it is introduced, so that the HTTP surface stays stable.
30. As a backend developer, I want test fixtures and factories for users, decks, cards, and reviews, so that new features can be exercised without repetitive setup.
31. As a future maintainer, I want each Phase 2 slice to be independently shippable, so that the project can recover if development pauses again.
32. As a future maintainer, I want issue tracking tied to a PRD with explicit sequencing, so that execution order and scope do not drift.

### Implementation Decisions

- Testing moves from a deferred Phase 4 concern into the start of Phase 2 execution.
- The first deliverable is the test harness, not a new feature endpoint.
- The next deliverable after harness setup is regression coverage for the completed Phase 1 error-handling and current user behavior.
- Deck functionality should be the first new feature slice because cards and reviews depend on deck existence and ownership semantics.
- Card functionality should be the second feature slice because review submission depends on cards being present.
- Card Review functionality should be the third feature slice because it introduces the highest amount of domain logic and state transitions.
- Each slice should include unit tests for business logic and integration tests for public HTTP behavior before implementation is considered complete.
- HTTP tests should exercise the real Express app object and centralized middleware stack rather than isolated controller internals.
- Business-logic tests should target service boundaries and avoid coupling to internal implementation details.
- Database-backed tests should use a dedicated test database workflow with cleanup/reset helpers to keep tests deterministic.
- Test helpers should encapsulate common setup concerns such as app creation, fixture creation, database cleanup, and authenticated request scaffolding when auth is later added.
- Phase 2 should preserve the current layered architecture and extend the same model/service/controller pattern already used in the user slice.
- Ownership and permission behavior for decks should be designed now, even if broader authentication is formally addressed in Phase 3, to avoid reworking service contracts later.
- Collaborator functionality should be scoped to the minimal groundwork necessary for the deck model unless the team explicitly chooses to expand collaboration in this phase.
- Review logic should initially focus on recording reviews and updating progress deterministically; deeper FSRS sophistication can iterate after a stable baseline exists.

### Testing Decisions

- A good test validates observable behavior and stable contracts, not incidental implementation details.
- Unit tests should focus on service-layer decisions, validation branching that is exposed through service contracts, and review progression rules.
- Integration tests should focus on route behavior, status codes, response shapes, validation failures, not-found behavior, conflict behavior, and persistence effects.
- The first test work should cover Phase 1: centralized error handling, validation middleware behavior, and existing user endpoints.
- New test infrastructure should include Jest configuration, Supertest integration, database lifecycle helpers, and data factories/builders for entities.
- Test naming should describe behavior from the caller’s perspective, for example returning 409 on duplicate email or creating a deck successfully.
- Database-backed integration tests should clean state between runs and avoid dependence on execution order.
- Tests should be added slice-by-slice: harness setup, Phase 1 regression tests, deck tests, card tests, then review tests.
- Prior art in the current codebase is limited because no automated tests exist yet; the user module and current manual curl-based verification become the baseline behaviors to codify.

### Out of Scope

- Full authentication and JWT-based route protection.
- Production logging, metrics, health checks, and runtime hardening.
- PM2, load balancing, AWS deployment, or other infrastructure concerns.
- Advanced collaboration workflows beyond the minimum data-model groundwork needed by deck behavior.
- AI grading and content-generation features.
- Broad API documentation and CI/CD automation beyond what is strictly needed to support testing and Phase 2 delivery.

### Further Notes

- This PRD intentionally reorders the roadmap by pulling testing forward.
- The preferred execution order is: test harness setup, Phase 1 regression tests, Deck slice, Card slice, Card Review slice.
- If Phase 2 is split into multiple issues, the PRD issue should remain the parent source of truth and child issues should reference it explicitly.

## Implementation Phases

### Phase 1: Test Harness and Phase 1 Regression Coverage

**Objective:** Establish Jest and Supertest, then lock down current user and error-handling behavior before introducing new features.

**Files to Modify/Create:**

- package.json: add test scripts and test-specific commands.
- test configuration files: add Jest and TypeScript test configuration.
- test helpers/factories: add database lifecycle, fixture, and HTTP helper utilities.
- current user and error coverage tests: add unit and integration tests for existing functionality.

**Tests to Write:**

- error-handler integration tests: verifies 404, 409, 400, and dev/prod error response behavior.
- validation integration tests: verifies invalid payload handling through middleware.
- user service unit tests: verifies not-found and happy-path behaviors.
- user route integration tests: verifies existing CRUD contract for users.

**Steps:**

1. Add Jest, Supertest, and TypeScript test tooling with repeatable scripts.
2. Add database/test-environment helpers and fixture builders.
3. Write failing integration tests for Phase 1 API error contracts.
4. Write failing unit tests for current service behavior.
5. Adjust any harness gaps until tests pass without changing validated business behavior.
6. Run lint, typecheck, and tests together.

**Acceptance Criteria:**

- [ ] Jest and Supertest run locally through package scripts.
- [ ] Test helpers support isolated database-backed integration tests.
- [ ] Current user routes and Phase 1 error-handling behavior are covered by automated tests.
- [ ] The project has a repeatable testing baseline for subsequent slices.

---

### Phase 2: Deck Vertical Slice

**Objective:** Deliver deck CRUD with ownership-aware service rules and full unit/integration coverage.

**Files to Modify/Create:**

- deck data-access, service, controller, route, and validation modules.
- app route registration for deck endpoints.
- deck test factories and deck unit/integration tests.

**Tests to Write:**

- deck service unit tests: verifies create/read/update/delete and ownership rules.
- deck route integration tests: verifies validation, happy paths, not-found, and conflict/authorization-adjacent behavior.

**Steps:**

1. Write failing unit tests for deck service contracts.
2. Write failing integration tests for proposed deck endpoints.
3. Implement the smallest deck data-access and service logic needed to satisfy tests.
4. Implement HTTP handlers and route registration.
5. Refactor only as needed after green tests.
6. Run the full validation and test suite.

**Acceptance Criteria:**

- [ ] Deck CRUD endpoints exist and pass automated tests.
- [ ] Deck ownership semantics are enforced at the service boundary.
- [ ] Validation failures and not-found behavior are covered.
- [ ] Implementation follows the existing layered architecture.

---

### Phase 3: Card Vertical Slice

**Objective:** Deliver card CRUD with card-type-aware validation and full unit/integration coverage.

**Files to Modify/Create:**

- card data-access, service, controller, route, and validation modules.
- app route registration for card endpoints.
- card test factories and card unit/integration tests.

**Tests to Write:**

- card service unit tests: verifies deck association and card-type business rules.
- card route integration tests: verifies payload validation, CRUD flows, and missing-deck behavior.

**Steps:**

1. Write failing tests for card service behavior across supported card types.
2. Write failing HTTP tests for card CRUD and validation boundaries.
3. Implement minimal model/service/controller/route code to pass the tests.
4. Refactor validation structures and helpers where duplication appears.
5. Run the full suite.

**Acceptance Criteria:**

- [ ] Card CRUD endpoints exist and pass automated tests.
- [ ] Card validation reflects the supported card variants.
- [ ] Cards remain correctly scoped to decks.
- [ ] Errors are surfaced through the centralized error system.

---

### Phase 4: Card Review Vertical Slice

**Objective:** Deliver review submission and progress updates with unit coverage over review logic and integration coverage over the review API.

**Files to Modify/Create:**

- review/progress data-access and service modules.
- review controller and route modules.
- review test fixtures and service/API tests.

**Tests to Write:**

- review service unit tests: verifies review recording, progress updates, and scheduling calculations.
- review route integration tests: verifies request validation and persisted side effects.

**Steps:**

1. Write failing unit tests around the review service contract.
2. Write failing integration tests for review submission endpoints.
3. Implement minimal persistence and service orchestration to satisfy tests.
4. Refactor for clarity once behavior is stable.
5. Run the complete suite and validation commands.

**Acceptance Criteria:**

- [ ] Review submission persists review history and updates progress state.
- [ ] Review behavior is covered by both unit and integration tests.
- [ ] Review endpoints use centralized validation and error handling.
- [ ] Phase 2 ends with a repeatable TDD pattern for later phases.

## Open Questions

1. How much collaborator behavior should be included in the deck slice?

   - **Option A:** Only enforce owner-centric deck CRUD now and leave collaborator workflows for a later slice.
   - **Option B:** Include minimal collaborator read/write behavior now because the schema already supports it.
   - **Recommendation:** Option A, because it keeps Phase 2 focused on the primary entity flow and reduces scope creep.

2. How deep should the first review algorithm implementation go?

   - **Option A:** Persist reviews and update progress with a simple deterministic baseline.
   - **Option B:** Implement a fuller FSRS-style calculation immediately.
   - **Recommendation:** Option A, because the current project needs stable interfaces and test coverage before optimizing the scheduling model.

3. Should deck ownership rules be implemented before formal auth exists?
   - **Option A:** Use explicit owner identifiers in service and request payloads for now.
   - **Option B:** Defer ownership semantics until Phase 3 authentication is done.
   - **Recommendation:** Option A, because Phase 2 data contracts should not be reshaped later just to introduce ownership checks.

## Risks & Mitigation

- **Risk:** Building Phase 2 before a test harness recreates the same fragility that left the project unfinished.
  - **Mitigation:** Make test harness and Phase 1 regression coverage the first gated deliverable.
- **Risk:** Review logic scope expands into algorithm research and stalls delivery.
  - **Mitigation:** Use a deterministic baseline first and isolate the review service for future iteration.
- **Risk:** Lack of auth creates ambiguous ownership semantics in Phase 2.
  - **Mitigation:** Define temporary owner-based service contracts now and preserve them when auth is introduced.
- **Risk:** Database-backed tests become flaky or slow.
  - **Mitigation:** Build dedicated lifecycle helpers, factories, and cleanup/reset workflows before adding many tests.

## Success Criteria

- [ ] Jest and Supertest are part of the standard development workflow.
- [ ] Phase 1 behavior is locked down with automated regression coverage.
- [ ] Deck, Card, and Card Review slices are delivered with tests written first.
- [ ] Phase 2 leaves the project with both new product capability and a durable testing baseline.
- [ ] Code reviewed and approved.

## Notes for Atlas

Treat this as a TDD-first reordering of the roadmap, not a direct continuation of the original Phase 2 wording. The first implementation milestone is test infrastructure plus Phase 1 regression coverage. After that, deliver Deck, then Card, then Card Review as separate vertical slices. Keep each slice independently shippable and avoid pulling Phase 3 auth or Phase 5 production concerns forward unless they are required to satisfy tests or preserve coherent service contracts.
