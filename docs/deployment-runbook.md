# Disposable Render–Neon sandbox

Implements preparation for [#49](https://github.com/Pilks-pixel/top_vino_backend/issues/49), under [#41](https://github.com/Pilks-pixel/top_vino_backend/issues/41). **Live acceptance is pending.** Nothing here proves a public release exists. Keep the PR draft until the operator records the evidence below.

This environment accepts synthetic disposable data only, may sleep or reset, and has no uptime or recovery promise. The hard budget is $0. Never attach a Render payment method or enable Neon automatic paid usage. If the accounts already have a paid path, use an isolated Free account/workspace without that path or stop setup.

## Ownership

`render.yaml` owns the one-service non-secret contract. Render dashboard owns OAuth, workspace access, runtime secret values and emergency actions. Neon dashboard owns its project, branch, roles, endpoints and compute. GitHub owns CI/repository protection and receives no provider/runtime secret, deploy hook or API key. The runbook records names and procedures; live consoles are authoritative for account state.

| Planned choice | Value / destination | Verified live |
| --- | --- | --- |
| Render service | `top-vino-sandbox`, Docker, `main`, Singapore, Free | Pending |
| Public origin | `https://top-vino-sandbox.onrender.com` | Pending: generated hostname must match |
| Neon project / branch / database | `top-vino-sandbox` / `production` / `top_vino_sandbox` | Pending |
| Neon region / PostgreSQL major | Singapore / 15 | Pending: verify availability before creation |
| Migration owner | `top_vino_owner`; direct TLS connection → Render `DIRECT_URL` | Pending |
| Runtime role | `top_vino_runtime`; pooled TLS connection → Render `DATABASE_URL` | Pending |
| Auth key ring | Versioned keys → Render `BETTER_AUTH_SECRETS` | Pending |
| Proxy trust | `false`; reviewed one-hop opt-in requires live spoof tests first | Pending topology evidence |
| Free shutdown allowance | Platform default 30 seconds; application exits within 10 | Blueprint validator rejects customization on Free |

Record actual **names**, PostgreSQL major and region in a reviewed change if they differ. Never record connection strings, endpoint values, passwords, generated provider IDs, raw logs or personal details. Keep provider IDs in your private operator notes.

## Repeatable guided setup

From an approved checkout, run `bash scripts/setup-sandbox.sh`. It opens the dashboards in dependency order and captures only public names/origin in the ignored `.sandbox-operator.env`. The stages are account/billing boundary, Neon project, SQL runtime role, GitHub gate, Blueprint, dashboard secrets, and live verification. It never captures a runtime secret or sends one to GitHub. Move confirmed dashboard-only names into the inventory above through review; the ignored file is a convenience, not a second configuration source.

Do not create the Blueprint while these draft layers are unmerged. The operator first reviews and merges the stack in dependency order, then checks the accepted main commit. No script in this change merges PRs.

## 1. Account and database setup

1. Open [Neon Console](https://console.neon.tech) and [Render Dashboard](https://dashboard.render.com). Authorize only this repository in Render's GitHub integration. Keep workspace/dashboard and log access owner-only. Confirm billing settings make automatic paid overage impossible in both accounts.
2. In Neon, create the planned Free project in Singapore, with PostgreSQL 15, its selected branch and database. If that major/region is unavailable, stop and review the supported-major decision and CI/image tests before choosing another. Do not create a second project, a paid compute, or a Neon API key.
3. Use the project owner role for migrations (record its actual name; the table is the intended name). Obtain the **direct** owner connection and the **pooled** runtime connection separately through Connect, both with TLS. Keep endpoint values private. Begin runtime options at `connection_limit=5`, `connect_timeout=15`, `pool_timeout=10`. Avoid credentials in shell history, process arguments, screenshots and shared logs.
4. Create the runtime role with SQL in the console SQL Editor, rather than the Add Role button: [Neon-created console/API roles inherit administrative `neon_superuser` membership](https://neon.com/docs/manage/roles). Run the following as the verified owner, replacing only the reviewed role/database names if necessary. Set the role's password privately through the console role password reset flow; do not paste it into a tracked SQL file.

```sql
CREATE ROLE top_vino_runtime LOGIN NOINHERIT NOSUPERUSER
  NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE top_vino_sandbox TO top_vino_runtime;
GRANT USAGE ON SCHEMA public TO top_vino_runtime;
```

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
