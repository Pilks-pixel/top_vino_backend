# Disposable Render–Neon sandbox

Implements preparation for [#49](https://github.com/Pilks-pixel/top_vino_backend/issues/49), under [#41](https://github.com/Pilks-pixel/top_vino_backend/issues/41). **Live acceptance is pending.** Nothing here proves a public release exists. Keep the PR draft until the operator records the evidence below.

This environment accepts synthetic disposable data only, may sleep or reset, and has no uptime or recovery promise. The hard budget is $0. Never attach a Render payment method or enable Neon automatic paid usage. If the accounts already have a paid path, use an isolated Free account/workspace without that path or stop setup.

## Ownership

`render.yaml` owns the one-service non-secret contract. Render dashboard owns OAuth, workspace access, runtime secret values and emergency actions. Neon dashboard owns its project, branch, roles, endpoints and compute. GitHub owns CI/repository protection and receives no provider/runtime secret, deploy hook or API key. The runbook records names and procedures; live consoles are authoritative for account state.

| Planned choice | Value / destination | Verified live |
| --- | --- | --- |
| Render service | `top-vino-sandbox`, Docker, `main`, Singapore, Free | Pending |
| Public origin | `https://top-vino-sandbox.onrender.com` | Pending: generated hostname must match |
| Neon project / branch / database | `Top-Vino` / `production` / `neondb` | Verified by CLI on 2026-10-12; only database currently present |
| Neon region / PostgreSQL major | Singapore / 18 | Verified by CLI on 2026-10-12; local PostgreSQL 18 compatibility passed on 2026-10-26; reviewed-main CI and live API acceptance pending |
| Migration owner | `neondb_owner`; direct TLS connection → Render `DIRECT_URL` | Role and direct TLS URL verified by CLI on 2026-10-12; operator reported successful guarded migration on 2026-10-26 |
| Runtime role | `top_vino_runtime`; pooled TLS connection → Render `DATABASE_URL` | Operator reported successful connection, application CRUD, schema CREATE denial and migration-history denial on 2026-10-26; live API smoke pending |
| Auth key ring | Versioned keys → Render `BETTER_AUTH_SECRETS` | Pending |
| Proxy trust | `false`; reviewed one-hop opt-in requires live spoof tests first | Pending topology evidence |
| Free shutdown allowance | Platform default 30 seconds; application exits within 10 | Blueprint validator rejects customization on Free |

Record actual **names**, PostgreSQL major and region in a reviewed change if they differ. Never record connection strings, endpoint values, passwords, generated provider IDs, raw logs or personal details. Keep provider IDs in your private operator notes.

## Neon CLI setup and current evidence

On 2026-10-12, the parent working directory (`top_vino/`, above this backend checkout) was linked to the existing `Top-Vino` project and its `production` branch. The organization reports the Free plan; dashboard confirmation that automatic paid usage is impossible remains pending. Neon CLI 8.3.5 and the Neon skills were installed for Codex and GitHub Copilot. The project-local Codex MCP configuration uses OAuth and is pinned to this project; it creates no API key. Restart Codex to load the configuration and complete MCP OAuth on first use.

The working directory contains this policy:

```ts
import { defineConfig } from "@neon/config/v1";

export default defineConfig({});
```

Both `neon config plan` and `neon deploy` succeeded with no changes required. This reconciles Neon service configuration; it does not apply Prisma migrations, create the runtime role, deploy the Render API, or establish live acceptance. Local `.neon`, `.env`/`.env.*`, and the project-specific MCP configuration are ignored by the parent directory's `.gitignore`; these setup artifacts are outside this backend Git checkout.

The CLI pulled pooled `DATABASE_URL` and direct `DATABASE_URL_UNPOOLED` values into the ignored parent `.env.local`. Both use `neondb_owner` at setup; they are operator connections, not the separate runtime credentials required by this runbook. For Render, obtain a pooled URL for `top_vino_runtime` and set `DIRECT_URL` from the owner's direct URL. Do not copy the owner's pooled URL into the API's runtime `DATABASE_URL`. The CLI listed only `neondb_owner` at setup.

On 2026-10-26, the operator reported successful guarded migration with the owner connection, followed by the explicit runtime grants. Reported runtime checks passed: login and Deck SELECT; application User insert/update/select/delete inside a rolled-back transaction; denied CREATE TABLE and migration-history SELECT; catalog checks showed no schema/database CREATE, elevated flags, memberships, public-table ownership or migration-history privileges. These are operator-reported database checks, not live API or Render acceptance. The migration created no fixtures and the CRUD check retained no test record.

The live project uses PostgreSQL **18**. CI, Compose, and the production-image, sandbox-data and portability verification scripts now pin the official PostgreSQL 18 image by digest. Guided setup and portability preparation also require 18. Compose uses a new `postgres_18_data` volume mounted at `/var/lib/postgresql`; existing PostgreSQL 15 data requires logical dump/restore, not reuse of the old database directory. Run the migration, role-denial, container and portability checks against PostgreSQL 18 before accepting a Render candidate. A successful empty-policy Neon deployment is not PostgreSQL 18 application compatibility evidence.

Local verification on 2026-10-26 passed using Node 24.20.0, npm 11.19.0 and the pinned PostgreSQL 18 image (observed server version 18.6): locked install, Prisma generation, lint, types, build, all 376 Jest tests across 31 suites, all 29 operations tests, guarded sandbox lifecycle acceptance, final Linux AMD64 image acceptance, and synthetic TLS dump/restore plus API smoke and credential rotation. The final image ran through Docker Desktop emulation on Apple Silicon. Shell syntax, Compose validation and Git whitespace checks also passed. These checks used isolated synthetic local databases; actual Neon export, complete live API smoke and Render acceptance remain pending.

For the next session, review the `chore/postgres-18` changes, obtain successful `CI / quality` and `CI / container` results on the accepted revision, and complete the protected-main gate below. Then continue with the Render Blueprint and its dashboard-only `DATABASE_URL`, `DIRECT_URL` and `BETTER_AUTH_SECRETS` fields. No secret values belong in this runbook.

## Repeatable guided setup

From an approved checkout, run `bash scripts/setup-sandbox.sh`. It opens the dashboards in dependency order and captures only public names/origin in the ignored `.sandbox-operator.env`. The stages are account/billing boundary, Neon project, SQL runtime role, GitHub gate, Blueprint, dashboard secrets, and live verification. It never captures a runtime secret or sends one to GitHub. Move confirmed dashboard-only names into the inventory above through review; the ignored file is a convenience, not a second configuration source.

Do not create the Blueprint while these draft layers are unmerged. The operator first reviews and merges the stack in dependency order, then checks the accepted main commit. No script in this change merges PRs.

## 1. Account and database setup

1. Open [Neon Console](https://console.neon.tech) and [Render Dashboard](https://dashboard.render.com). Authorize only this repository in Render's GitHub integration. Keep workspace/dashboard and log access owner-only. Confirm billing settings make automatic paid overage impossible in both accounts.
2. In Neon, select the existing Free `Top-Vino` project in Singapore, with PostgreSQL 18, branch `production` and database `neondb`. Verify the inventory against the live console and complete the PostgreSQL 18 compatibility checks above. Do not create a second project, a paid compute, or a Neon API key.
3. Use the project owner role for migrations (record its actual name; the table is the intended name). Obtain the **direct** owner connection and the **pooled** runtime connection separately through Connect, both with TLS. Keep endpoint values private. Begin runtime options at `connection_limit=5`, `connect_timeout=15`, `pool_timeout=10`. Avoid credentials in shell history, process arguments, screenshots and shared logs.
4. Create the runtime role with SQL in the console SQL Editor, rather than the Add Role button: [Neon-created console/API roles inherit administrative `neon_superuser` membership](https://neon.com/docs/manage/roles). Run the following as the verified owner, replacing only the reviewed role/database names if necessary. This creates a role without a password; initialize its password separately as described below.

```sql
CREATE ROLE top_vino_runtime LOGIN NOINHERIT NOSUPERUSER
  NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE neondb TO top_vino_runtime;
GRANT USAGE ON SCHEMA public TO top_vino_runtime;
```

Generate and save a unique random password in your password manager. In the private Neon SQL Editor, select `production`, `neondb` and `neondb_owner`, then run the following with the placeholder replaced locally. Do not rerun `CREATE ROLE` for an existing role.

```sql
ALTER ROLE top_vino_runtime WITH PASSWORD '<unique-random-password>';
```

The Console reset action can reject a passwordless SQL-created role with `cannot update password for role without password`; it is not the initial-password step. [Neon requires plaintext passwords in SQL and does not support hashed passwords](https://neon.com/docs/manage/roles#manage-roles-with-sql), so do not use psql's `\password` command, which sends a hashed password. Submit the real password only through the private TLS connection/editor; never put it in a tracked file, shell argument/history, shared log or chat. The documentation does not establish provider query-history/log redaction. This `ALTER ROLE` changes only the password and preserves the role's privilege restrictions. Verify a fresh runtime connection before proceeding to migrations and grants.

**Before creating the first Render candidate**, initialize the empty schema through the guarded workstation `npm run sandbox:migrate -- --confirm-target "$SANDBOX_DATABASE_TARGET"` action in [database safeguards](./sandbox-database.md). Privately prompt for DIRECT_URL in a subshell and set the workstation opt-in; this never starts the API. Confirm success without copying raw CLI output. The migration history table must exist before future default privileges are installed.

Then grant CRUD on the explicit application/auth tables listed in [database safeguards](./sandbox-database.md), plus usage/select on application sequences if present. Exclude `_prisma_migrations` and revoke any existing grant on it. Only now set future application-table default CRUD privileges for the actual migration owner. Verify runtime has no migration-table privilege, cannot create/drop schema or tables, own objects, truncate tables, or assume an elevated role before any API starts; retain that first-start denial evidence. Normal auth/Deck smoke after deployment confirms the allowed privileges. The migration owner must be the same role whose defaults you set. No initial API is allowed to serve during a permissive grant window.

## 2. GitHub gate before deployment

Follow [repository policy](./repository-policy.md) from #48 after the #47 workflow is on main. The active main ruleset requires an up-to-date PR, resolved conversations, literal `CI / quality` and `CI / container` GitHub Actions contexts, no bypass, no force push/deletion, and zero required approvals for the sole owner. Check success on the exact accepted main SHA. These jobs are unconditional; skipped/neutral checks are insufficient evidence even though Render accepts them. Confirm Dependabot alerts/security updates and weekly reviewed updates, and the Actions SHA-pin/allowed-actions policy.

## 3. Create the Blueprint and enter secrets

1. Validate the exact reviewed file: `render blueprints validate render.yaml --workspace <private-workspace-id> -o json`. This validates configuration without creating a service.
2. With the reviewed file on protected main, open [New Blueprint](https://dashboard.render.com/select-repo?type=blueprint), authorize/select `Pilks-pixel/top_vino_backend`, and use `main` and `render.yaml`. Review the plan: exactly one Docker web service, Free, Singapore, no database, disk, previews, paid resource, or extra service.
3. Enter `DATABASE_URL`, `DIRECT_URL`, and `BETTER_AUTH_SECRETS` only in the Render dashboard fields prompted by `sync: false`. Use the pooled nonowner runtime URL and direct owner URL in their respective fields. Start the key ring at `1:<private-random-key-of-at-least-32-characters>`; see [tester/rotation procedures](./synthetic-testers.md). Leave the singular `BETTER_AUTH_SECRET` and all temporary provisioning/tool variables unset.
4. Before clicking Apply, confirm the two checks succeeded on this main commit and record that SHA privately. Initial Blueprint creation is an explicit operator deploy; the checks-pass trigger governs subsequent changes, so it does not replace this first-creation gate.
5. Keep the image's default entrypoint; never override the Docker command, run migrations during build, or configure preDeployCommand (Free does not support it). The entrypoint migrates and sheds DIRECT_URL before the server runs; ordinary deploy never seeds or resets.
6. Confirm Render's assigned public subdomain exactly matches both versioned auth/frontend origins. If it differs, stop smoke and review a Blueprint origin change before enabling tester access. Render supplies PORT.

Free rejects `maxShutdownDelaySeconds`, as confirmed by Render CLI validation. The file omits it, accepts the default platform allowance, and relies on the independently tested application shutdown bound. This is a provider limitation against the requested customized allowance, not an unverified successful setting.

## 4. Operator fixture and first smoke

Provision a distinct synthetic tester privately from a workstation using [synthetic tester access](./synthetic-testers.md), and the guarded seed procedure in [database release](./sandbox-database.md). Temporary operator credentials never go on the API service. No shared demo credential is published. Change the initial password before normal use.

Do the [release smoke](./release-recovery.md) on the live SHA: root identity, /health, /ready, /docs, product/generated schemas, private sign-in, authorized Deck read, and safe correlated logs without migration/startup errors. Confirm another requestor cannot read the private Deck. Record only pass/fail, expected/live SHA and nonsecret evidence time; never session cookies or fixture credentials. A Render “live” status alone is insufficient.

Before enabling `render-1`, perform the [browser-boundary topology tests](./browser-boundary.md) against real clients: fabricated forwarding headers cannot change session identity or renew quotas, and two actual clients retain separate counters. Keep trust `false` until that shape is verified; accept conservative shared edge quotas meanwhile. Update the reviewed Blueprint only after that evidence exists.

## Drift, rotation and reset

Edit Blueprint-managed nonsecret settings through protected main. Dashboard edits may be overwritten on sync. Newly introduced `sync: false` values are not filled by later syncs: enter them deliberately in the dashboard before that release. During an emergency stabilize first, then mirror the action into reviewed config/runbook before normal releases resume.

Rotate signing secrets with version overlap and compromise procedure in [synthetic tester access](./synthetic-testers.md). Rotate runtime/direct role passwords independently in Neon and replace only the affected Render dashboard field; redeploy, confirm direct shedding, readiness and full smoke. URL rotation requires no image rebuild. A leak requires revocation and session response before routine releases resume.

A guarded rebuild is workstation-only and destructive. Give testers 72 hours' notice for planned resets, including a public docs notice; emergency loss is communicated by the next business day. Freeze writes, verify the exact disposable target independently, use [database release](./sandbox-database.md) explicit reset confirmation, grant the runtime role again, reprovision affected testers, and repeat readiness/full smoke. A startup failure never authorizes reset or blind `migrate resolve`.

## Recovery and deprovisioning

Follow [release/recovery](./release-recovery.md): stop ordinary merges on failed smoke, diagnose the exact failed stage, prefer fix forward, and check schema compatibility before artifact rollback. Application rollback does not restore PostgreSQL. Dashboard rollback pauses automatic deploys; re-enable checks-pass only after recovered smoke.

To retire, notify testers, stop intake/probe, remove the service from the reviewed Blueprint, then delete it in Render (sync does not delete removed resources). Revoke runtime, owner and temporary credentials and all tester sessions, delete the disposable Neon project deliberately, disconnect the repository integration when unused, and remove the public probe URL. Do not leave a payment method, deploy hook, secret, or stray service behind.

## Live evidence still required

- Billing cannot automatically charge; owner-only access and GitHub OAuth scope.
- Actual Neon names/region/major, role privileges and pooled/direct TLS separation.
- Active GitHub rules, two successful non-skipped raw contexts on accepted main SHA.
- Blueprint-created single Free service and generated origin, checks-pass setting, actual migration/readiness/traffic sequence, full operator smoke and proxy shape.
- Current provider email capabilities, retention, allowances and last scheduled probe recorded through [operations](./sandbox-operations.md).

Provider references checked during preparation on 2026-10-07: [Blueprint reference](https://render.com/docs/blueprint-spec), [deploy/CI](https://render.com/docs/deploys), [Free constraints](https://render.com/docs/free), [Neon roles](https://neon.com/docs/manage/roles). Recheck live consoles before treating any plan capability as acceptance evidence.
