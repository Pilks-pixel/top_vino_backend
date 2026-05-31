# Test Run Summary

This is a snapshot of the current test state after running:

```bash
npm run test:coverage
```

## Current Result

The test run is failing.

```text
Test Suites: 4 failed, 5 passed, 9 total
Tests:       23 failed, 76 passed, 99 total
Exit Code:   1
```

That means the project does have a substantial amount of working test coverage, but the suite is not currently green. The immediate priority should be fixing the failing tests before treating the coverage report as a final quality signal.

## Coverage Snapshot

The reported overall coverage is:

```text
All files: 35.6% statements, 21.31% branches, 30.32% functions, 80.88% lines
```

The low statement/function coverage is being pulled down heavily by generated Prisma files, especially `generated/prisma/runtime/library.js`. Generated files are usually not useful to include in application coverage reports because they are not source code we maintain directly.

The application source files are in a healthier state than the headline number suggests:

- Service coverage is strong overall: `src/services` reports 92.07% statements and 92.22% lines.
- Route controller coverage is mixed: controllers are being exercised, but several response/error branches are still uncovered.
- Model coverage is weaker: several direct Prisma model functions have little or no coverage.
- Utility coverage is mixed: `appError.ts`, schemas, and `catchAsync.ts` are strong, while `prismaErrorHandler.ts` still has many uncovered branches.

## What This Means

At this stage, the test suite is useful but not yet reliable enough to use as a merge gate.

The most important signal is not the coverage percentage yet. The most important signal is that 23 tests are failing. Coverage should be improved after the suite is passing, otherwise the team may spend time chasing coverage numbers while known behavior is still broken.

## Likely Next Steps

1. Re-run the failing tests and capture the actual failure messages.

   ```bash
   npm test
   ```

   If the output is too noisy, run one area at a time:

   ```bash
   npm run test:unit
   npm run test:integration
   ```

2. Fix the failing suites before doing coverage cleanup.

   Work from the first failing suite downward. The failure messages will show whether the issues are caused by implementation behavior, stale test expectations, database setup, import/config problems, or test data assumptions.

3. Once tests pass, exclude generated files from coverage.

   The current coverage report includes `generated/prisma` and Prisma runtime files. Those files should usually be excluded with Jest coverage configuration so the report focuses on code maintained in `src`.

4. Consider splitting unit and integration test configuration.

   At the moment, Jest global setup runs for the whole test process. That means unit-only test runs still depend on PostgreSQL being available. A cleaner setup would let unit tests run without a database and reserve database setup for integration tests.

5. Add targeted tests where source coverage is currently thin.

   Good candidates after the suite is green are:

   - `src/model/*` for direct Prisma model behavior;
   - uncovered controller branches in `src/routes/*/*.controller.ts`;
   - remaining branches in `src/utils/prismaErrorHandler.ts`;
   - lower-coverage paths in `src/services/review.service.ts`.

## Recommended Order

The recommended order is:

1. Make the current suite pass.
2. Exclude generated Prisma files from coverage.
3. Re-run coverage to get a meaningful baseline.
4. Add tests for the lowest-risk uncovered app code first.
5. Only then consider setting coverage thresholds.

This keeps the work practical: first make tests trustworthy, then make the coverage report meaningful, then raise the quality bar.
