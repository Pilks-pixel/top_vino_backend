# Release smoke and recovery

Preparation for [#50](https://github.com/Pilks-pixel/top_vino_backend/issues/50), following [decision #37](https://github.com/Pilks-pixel/top_vino_backend/issues/37) and [spec #41](https://github.com/Pilks-pixel/top_vino_backend/issues/41). **Live acceptance is pending.** Local tests verify the operator command and HTTP identity. They do not establish Render traffic switching, active repository gates, Neon configuration, or a successful public release.

## One accepted main commit at a time

1. Follow [repository policy](./repository-policy.md). Merge a reviewed PR only after both unconditional required checks succeed and its branch is current. Begin a release record with the resulting full 40-character `main` SHA. Stop ordinary merges until this commit finishes smoke and log review. Only an explicit emergency recovery PR may cross that freeze.
2. Verify both checks reran on that exact main SHA. Read the raw check-run records; require the two configured contexts, literal `CI / quality` and `CI / container`, to be `completed` with conclusion `success`, supplied by GitHub Actions. A missing, queued, cancelled, failed, neutral or skipped check does not satisfy this contract. Use the raw names actually verified by the repository-policy procedure; a UI breadcrumb is insufficient.
3. Confirm the Blueprint's `autoDeployTrigger: checksPass` is effective as **After CI Checks Pass** in Render. Ordinary releases use the connected GitHub integration, with no deploy hook, API token, secret-bearing CI deployment, or manual bypass. Render treats neutral/skipped checks as passing, so the operator must independently confirm both unconditional checks actually succeeded. See [Render's CI integration](https://render.com/docs/deploys#integrating-with-ci).
4. Render builds the accepted Docker revision without runtime secrets, database access, migration or seed. The candidate's offline release entrypoint then validates and runs committed migrations with the direct owner connection. Failure exits before Node starts. A current schema is a migration no-op on restart.
5. After successful migration the entrypoint removes `DIRECT_URL` and temporary operator credentials, then execs `node dist/server.js` as PID 1 using the pooled nonowner connection. It never seeds or resets. See [database release](./sandbox-database.md) and [image contract](./production-image.md).
6. The configured `/ready` probe must succeed before the candidate receives traffic. Confirm Render reports **live** at the expected SHA; `/health` alone does not prove database readiness. Render documents retaining the old instance during candidate startup, but prior-instance preservation in this sandbox remains a live acceptance test. See [deploy sequence](https://render.com/docs/deploys#zero-downtime-deploys) and [health checks](https://render.com/docs/health-checks).
7. Immediately run the workstation smoke below and privately inspect deploy/application logs. Only both passing complete the release. Do not merge another ordinary PR just because Render says live. Set the workspace overlapping-deploy policy to **Wait** as a secondary precaution; provider serialization does not wait for operator smoke.

Read-only GitHub evidence command, after assigning the nonsecret `release_sha` to the accepted full SHA:

```sh
gh api "repos/Pilks-pixel/top_vino_backend/commits/$release_sha/check-runs" \
  --paginate --jq '.check_runs[] | {name, head_sha, status, conclusion, app: .app.slug, details_url}'
```

Inspect the latest attempts for both required contexts and retain only their SHA, run links, final conclusions and evidence time. Do not replay old successful PR checks as evidence for the new main commit. Provider checks-pass behavior and negative gating remain pending until observed live.

## Trusted-workstation smoke

Use the pinned Node toolchain and an existing external absolute credential file with mode **0600**, containing only the provisioned synthetic tester's `email` and current `password`. The command never writes this file. Provision privately through [tester access](./synthetic-testers.md), change the initial password, and update the private file with a trusted local editor. Keep credentials outside the checkout, history, process arguments, screenshots and release records. Use an existing synthetic Deck UUID that this tester may read; product operations never create, edit, review or delete data.

Set only nonsecret shell variables `api_origin`, `release_sha`, and `deck_id` to the reviewed HTTPS API origin, accepted full SHA, and authorized Deck UUID. Pass the private file's path, never the password:

```sh
node scripts/release-smoke.mjs \
  --origin "$api_origin" \
  --expected-commit "$release_sha" \
  --deck-id "$deck_id" \
  --credentials-file /absolute/private/path/tester.json
```

The command checks in order:

| Request | Expected evidence |
| --- | --- |
| `GET /` | 200 and `X-Release-Commit` equal to the expected full SHA |
| `GET /health` | 200, `status: ok`, same full SHA |
| `GET /ready` | 200, `status: ready` |
| `GET /docs` | 200 API reference |
| `GET /openapi.json` | 200 product OpenAPI 3.1.0 with the Deck read path |
| `GET /api/auth/open-api/generate-schema` | 200 generated capability reference; advertised disabled routes remain disabled |
| `POST /api/auth/sign-in/email` | 200, tester identity, session cookie |
| `GET /deck/<authorized UUID>` | 200 success envelope containing that Deck UUID |
| `POST /api/auth/sign-out` | 200 cleanup of the smoke's session, including after a failed Deck read |

`X-Release-Commit` comes from validated `RENDER_GIT_COMMIT`; portable hosts supply `RELEASE_COMMIT`. If both are set they must identify the same full SHA. Missing identity causes smoke to fail rather than infer a release from a successful health check. This is an HTTP consistency check; compare it with Render's live deploy record too.

Each request has a 60-second deadline; `--timeout-ms` accepts 100–120000 for explicit bounded adjustments. Redirects fail rather than forwarding credentials elsewhere. HTTPS origins must be exact origins without credentials, paths, queries or fragments. The local harness alone may use `--allow-test-loopback` with `NODE_ENV=test` for an HTTP loopback endpoint; do not use it for a public release.

The CLI emits only a pass record with commit and pending log review, or a sanitized failure stage with `cleanupFailed`. It never prints credentials, cookies, response bodies, arbitrary exceptions, or database URLs. Exit 0 means **HTTP smoke passed**, not that operator log review is complete. Cleanup failure is nonzero; revoke the smoke session through the private tester session-management flow before resuming. If a network failure prevents receipt of a newly minted session cookie, inspect/revoke that tester's sessions explicitly.

Privately review Render deploy/runtime logs from the candidate's start through smoke. Require expected migration success/no-op, startup and correlated HTTP outcomes, and no unexpected migration/startup errors or credential leakage. Review under the [logging contract](./logging.md): passwords, URLs with credentials, signing secrets, tokens, cookie/authorization headers and request bodies must be absent/redacted. Do not paste raw logs, credential search strings, environment dumps, or session values into an issue. Record pass/fail and correlation IDs only. Verify the live runtime has no direct/provisioning credential using the reviewed release/container evidence and private provider inspection, without printing its environment.

## Diagnose the failed stage

Use the installed **render-deploy** guidance to inspect the selected service's deploy status and exact commit, then **render-debug** to inspect the corresponding build/runtime logs and dependency health. Their general direct-create, environment-update and manual-deploy suggestions do not override this spec's Blueprint ownership, dashboard-secret boundary, required checks or $0 limit. Neon remains external; never troubleshoot it using a Render Postgres creation/query workflow. Prefer owner-only Dashboard inspection; an already connected read-only CLI/MCP session may inspect deployment/log state. Do not publish raw provider logs.

| Failure | Recovery and evidence required |
| --- | --- |
| Required CI | No candidate should start. Fix forward; require both checks on the resulting main SHA. A failed-CI/no-deploy observation remains pending live. |
| Image build | Diagnose the specific locked dependency/build error. Database access has not begun. Prior healthy service preservation must be observed live. |
| Migration | Candidate must exit before Node. Freeze ordinary merges; inspect migration status with the guarded owner command and understand partial application. Never blindly retry, reset or `migrate resolve`. |
| Startup / readiness | Compare nonsecret config, port binding, role privileges and Neon connectivity without printing values. Liveness success with readiness 503 points to the database boundary. Require readiness and full smoke after the fix. |
| Smoke after traffic | Freeze ordinary merges. Choose an explicit fix-forward recovery PR, compatible artifact rollback, or guarded disposable rebuild. A successful redeploy alone does not release the freeze. |
| Session cleanup / log privacy | Revoke the smoke session privately; treat leaked credentials as compromise, follow tester/key/database rotation procedures and review redaction. Repeat readiness, full smoke and log review. |

## Compatible recovery

Every automatic migration must work with both the previous live application and the candidate until the candidate passes smoke. Keep committed migration history immutable. For renames/removals or tighter constraints use expand-and-contract over separate fully verified releases: add compatible structure, release code that bridges/migrates it, then remove old structure only after a later compatibility review. A migration failure is not permission to rewrite a migration already applied to Neon.

Before an artifact rollback, record the known-good target SHA, every migration applied since it, and evidence that the target app can read/write the **current** schema. Rehearse against a disposable stock-PostgreSQL copy when compatibility is uncertain. Check available artifact retention and current credentials/configuration; a target artifact may refer to an old key ring or URL. Never restore an exposed credential merely to make an old artifact boot.

Only after compatibility is proven, choose the known-good deploy in the owner Dashboard and confirm rollback. Dashboard rollback disables automatic deploys; verify that pause, run readiness/full smoke/log review against the restored SHA, resolve the code problem through protected review, and deliberately restore **After CI Checks Pass** when the current main revision is safe. [Render documents this pause and artifact/config behavior](https://render.com/docs/rollbacks). Do not treat retained Free artifacts as a backup archive.

**Application rollback does not roll back PostgreSQL.** Prefer fix forward if compatibility cannot be proven. A destructive rebuild is allowed only while this is the explicitly disposable synthetic sandbox, after the separate target confirmation, notices and guarded reset in [database release](./sandbox-database.md); it is never a startup/retry action. Regrant runtime privileges and repeat provisioning, readiness/full smoke and log review afterward.

## Pending live acceptance record

Keep ticket #50 and parent release acceptance pending until the operator records: exact accepted/live SHA and time (Asia/Bangkok), both successful raw check links, migration-before-Node and credential shedding evidence, readiness-before-traffic, full HTTP smoke and private log-review pass, failed-CI no-deploy, failed build/migration/readiness retaining the previous healthy instance where one exists, and schema-compatible recovery smoke with automatic deployment paused/resumed deliberately. Retain sanitized outcomes, not passwords, URLs with credentials, provider IDs or raw logs.

Provider documentation checked 2026-10-07: linked Render deploy, health and rollback documentation. Recheck live account capabilities and settings before counting any provider behavior as verified.
