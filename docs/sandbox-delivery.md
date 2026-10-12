# Spec #41 delivery and acceptance

The [parent spec](https://github.com/Pilks-pixel/top_vino_backend/issues/41) remains open. All PR layers remain drafts; code preparation and local verification do not close live/provider acceptance. Review in dependency order. Existing #42–44 commits were verified as ancestors of the starting branch before remaining work began; #42 is already an ancestor of main.

| Layer / ticket | Reviewable preparation | Remaining live acceptance |
| --- | --- | --- |
| Foundation #42–44 | Production runtime, public docs/probes, private testers and staged auth | First public HTTPS release and real tester onboarding |
| #45 Browser boundary | Exact origins/cookies, decoded body limits, quotas and redacted logs | Actual Render proxy topology/spoof tests; keep trust false until proven |
| #46 Database release | Locked offline migration gate, credential shedding, pool defaults, workstation migrate/seed/reset/status | Actual Neon pooled/direct destinations and least-privilege grants |
| #47 CI | Two unconditional literal Actions contexts, synthetic PostgreSQL15, source/operator and final-image checks | Successful checks on each accepted main commit |
| #48 Repository policy | Ruleset/Dependabot configuration, success-only evidence verifier, setup CLI/wizard | Active settings, owner merge blocking, Dependabot activation on main |
| #49 First platform | Validated one-service Free Blueprint, dashboard runbook and setup wizard | Billing/access/OAuth, Neon inventory, secrets entered only in Render, actual release smoke |
| #50 Release/recovery | Commit header, safe read-only product smoke, serialized release and schema-aware recovery | Checks-pass rollout, prior-instance preservation on failures, private log review, operator smoke |
| #51 Operations | Secret-free 09:17 Bangkok daily probe/retry, notices, incident/quota/graduation procedures | Received failure-only emails, console retention/allowances, last real probe |
| #52 Portability | Disposable stock-PG15 verified-TLS migration, sanitized dump/restore, schema/count/invariant and HTTPS smoke/rotation rehearsal | Verified synthetic Neon export and real transaction pooling/rotated endpoint smoke |

Two platform limitations are explicit. Render's validator rejects `maxShutdownDelaySeconds` on Free, so the reviewed Blueprint accepts the provider default allowance and the API independently enforces its ten-second shutdown bound. The requested customized Free allowance cannot be marked verified. GitHub/Render treat skipped or neutral checks as passing; the native policy has no success-only switch. Reviewed unconditional jobs plus an evidence verifier accepting only completed `success` provide the implemented boundary; do not claim the ruleset alone rejects skipped jobs.

## Operator handoff after review

1. Review/merge the draft stack in dependency order yourself; this implementation does not merge PRs or close issues. Keep deployment disconnected until #47 is on main and both required contexts genuinely succeed. A main-target representative PR containing that workflow then permits #48's guarded settings setup and owner enforcement verification.
2. Follow [repository policy](./repository-policy.md), then `bash scripts/setup-sandbox.sh` and [deployment setup](./deployment-runbook.md). Initialize schema and prove restricted runtime grants before the first API candidate. Runtime secrets stay in Render dashboard, temporary credentials on a trusted workstation, and billing remains incapable of automatic paid overage.
3. Verify the live SHA, full [release smoke/recovery](./release-recovery.md), and actual proxy boundary. Set the public probe URL and verify failure-only notifications/retention/quotas through [operations](./sandbox-operations.md). Capture only sanitized pass/fail, time and revision evidence.
4. Complete the actual Neon rehearsal handoff with `bash scripts/prepare-neon-portability.sh` and [portability](./portability.md). Local synthetic evidence does not prove a Neon snapshot, daily off-provider backups or a durable-beta restore schedule.

The future AI contract is recorded in [portability](./portability.md#retained-future-ai-contract) with canonical decision #40; no AI capability, paid service or AWS resource is enabled. Every unexecuted live criterion above stays pending until observed, and both unsupported literal platform guarantees stay disclosed rather than checked off.
