# Source and final-image gates

[#47](https://github.com/Pilks-pixel/top_vino_backend/issues/47) provides literal raw GitHub Actions check contexts `CI / quality` and `CI / container`. Both are unconditional on pushes to main and PRs targeting main; PRs targeting the stack's parent branches also run both gates so each draft layer has evidence. Do not add path filters, job/step conditions, continue-on-error, or skip commit messages.

Quality uses clean locked install, native Prisma generation, lint, types, production build, complete Jest and operator contract tests against temporary PostgreSQL15. Container builds and exercises the final AMD64 image, with migration entrypoint, against disposable PostgreSQL. It requires no npm installation on the host, registry login, image publication, provider credential or production secret. The scripts clean up only their own uniquely named Docker resources.

Node24.20.0/npm11.19.0, Ubuntu24.04, digest-pinned PostgreSQL15 and full-SHA GitHub-authored actions establish the baseline. Workflow permissions are contents:read; checkout does not persist credentials. Job-local database/auth values are synthetic. PR runs cancel only their own superseded run; main runs have unique SHA groups and are never cancelled. Timeouts are 15 minutes for quality and 30 for container.

`npm run test:operations` includes the public CI-contract validator and fault-injected workflow mutations. It rejects skipped required jobs, path-filtered gates, cancelled main runs, repository/provider secrets and unpinned actions. Repository protection binds the literal raw contexts, not the UI workflow prefix. See [repository policy](repository-policy.md).

The Jest setup honors a job-local `TEST_DATABASE_URL` or `DATABASE_URL`, while fixing the pathname to `top_vino_test` so tests cannot truncate another database. Global setup uses installed offline Prisma, never npx's package download fallback. Use a disposable PostgreSQL instance for the full suite.

GitHub executions and actual required-check enforcement must be verified after publication; local contract tests do not substitute for successful remote checks on the accepted main commit.
