# Plan: Fix SM-2 Interval Scheduling Bug

The current `sm2` function uses `reviewCount` as a proxy for the previous interval, causing incorrect scheduling after the third review. This fix adds `currentInterval` to `UserCardProgress` and corrects `sm2` to use the actual previous interval, with `reviewCount` resetting to 0 on failure per the SM-2 spec.

## Design Decisions (from grilling session)

- `sm2` accepts explicit `previousInterval: number` instead of using `reviewCount` as proxy
- `currentInterval Int @default(1)` added to `UserCardProgress` (scheduling state row, not history)
- `newInterval` always written to `currentInterval` — failure resets it to 1
- `reviewCount` resets to 0 on failure (standard SM-2 spec)
- `sm2` returns `newReviewCount` to keep all state transitions inside the pure function
- `sm2` stays private; tested behaviourally through `submitReview`

---

**Phases (3)**

### Phase 1: Schema & Zod type layer

- **Objective:** Add `currentInterval` to the DB schema and Zod types so the new field exists before any logic depends on it.
- **Files/Functions to Modify/Create:**
  - `prisma/schema.prisma` — `UserCardProgress` model
  - `src/utils/reviewSchema.ts` — `ProgressUpsertSchema`
  - `prisma/migrations/` — auto-generated via `prisma migrate dev`
- **Tests to Write:** None — type-layer change; tested implicitly by Phase 3 tests failing if the field is missing.
- **Steps:**
  1. Add `currentInterval Int @default(1)` to `UserCardProgress` in schema.prisma
  2. Run `prisma migrate dev --name add_current_interval_to_progress`
  3. Add `currentInterval: z.number().int().min(1)` to `ProgressUpsertSchema` in reviewSchema.ts
  4. Confirm TypeScript compiles cleanly (`tsc --noEmit`)

---

### Phase 2: Write failing tests

- **Objective:** Codify the correct SM-2 scheduling contract as test cases _before_ touching the service, so the tests drive the implementation.
- **Files/Functions to Modify:**
  - `__tests__/unit/review.service.test.ts` — `submitReview` describe block
  - `__tests__/integration/review.routes.test.ts` — multi-review sequence
- **Tests to Write:**
  - `bootstrap — first success (reviewCount=0) → newInterval=1, newReviewCount=1, currentInterval=1`
  - `bootstrap — second success (reviewCount=1, currentInterval=1) → newInterval=6, newReviewCount=2, currentInterval=6`
  - `steady-state — third success (reviewCount=2, currentInterval=6) → newInterval=round(6*EF), newReviewCount=3`
  - `failure — resets interval to 1 and reviewCount to 0 regardless of prior state`
  - `recovery — first success after failure (reviewCount=0, currentInterval=1) → newInterval=1, newReviewCount=1`
  - `EF floor — quality=0 repeated → easeFactor never drops below 1.3`
  - `integration — POST /reviews 5 times in sequence, verify interval progression: 1 → 6 → ~15 → ~38 → ~97`
- **Steps:**
  1. Update `mockProgress` to include `currentInterval: 1`
  2. Add each named unit test case to the `submitReview` describe block
  3. Add multi-review integration test to `review.routes.test.ts`
  4. Run tests → confirm RED on new cases

---

### Phase 3: Fix `sm2` and `submitReview`

- **Objective:** Make the failing tests pass with minimal changes to the service.
- **Files/Functions to Modify:**
  - `src/services/review.service.ts` — `sm2`, `submitReview`
- **Tests to Write:** None — verifying existing and Phase 2 tests go GREEN.
- **Steps:**
  1. Add `previousInterval: number` to `sm2` signature
  2. Change return type to include `newReviewCount: number`
  3. Replace `(reviewCount === 2 ? 6 : reviewCount - 1) * newEaseFactor` with `Math.round(previousInterval * newEaseFactor)` in the `else` branch
  4. In the `!recalled` branch: `newReviewCount = 0`; in recalled branches: `newReviewCount = reviewCount + 1`
  5. In `submitReview`: read `existing?.currentInterval ?? 1`, pass to `sm2`, write `currentInterval: newInterval` in `upsertCardProgress`
  6. Run tests → GREEN; run full test suite to confirm no regressions
