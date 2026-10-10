# Disposable sandbox database lifecycle

The sandbox contains synthetic data only. It has no recovery or uptime promise.
Do not accept irreplaceable accounts, authored content or Progress until daily
backups outside the provider, a 24-hour recovery-point objective, a documented
restore and a successful rehearsal are verified. Issue #33 records the decision.

## Candidate startup

The final image ships the locked Prisma 6.9 CLI dependency closure and the native
schema engine separately from production application dependencies. The migration
wrapper reuses the API query engine for Prisma’s eager engine discovery; it never
ships a duplicate query engine or downloads one on startup. It includes
schema and committed migrations, but no source, tests, seeds, reset command or
operator PostgreSQL driver. The CLI bundle and dependency manifests come from
`npm ci` with the repository lockfile; no network install runs at startup.

`release/entrypoint.sh` validates runtime configuration, applies `prisma migrate
deploy` using `DIRECT_URL`, removes `DIRECT_URL` and temporary provisioning
credentials, then execs `node dist/server.js` directly as PID 1. It never seeds.
Build and request handling never migrate. The direct URL must identify the same
database as the runtime URL and a different role. Use the direct owner endpoint;
pooled/PgBouncer migration configuration is refused. Both credentials are runtime
secrets, never build arguments, source, GitHub secrets or frontend configuration.

The API has one process-wide Prisma Client using only `DATABASE_URL`. Set Neon's
pooled endpoint and the separate runtime role. Missing pool settings default to
`connection_limit=5`, `connect_timeout=15`, `pool_timeout=10`; explicit validated
settings take precedence. Tune them from saturation and latency measurements.
No provider hostname convention is baked into the application.

Successful reentry is an ordinary migration no-op. Failure logs a safe JSON
`migration_failed` event and Prisma error code when available; arbitrary CLI
error text is discarded because it can carry credentials. Node never starts
following a migration failure. An interrupted migration can produce `P3009`.
Inspect operator status and the resulting schema before retrying. Never
blindly run `migrate resolve`, reset automatically or modify successful shared
migrations. Application rollback does not roll back PostgreSQL.

## Owner and runtime roles

Neon roles/endpoints are dashboard-managed. Record the project, disposable
branch, database, direct endpoint, pooled endpoint and role names without their
credentials. Independently verify those facts before operator commands.
The owner must own the application schema and migrations. The runtime role
must have only database CONNECT, schema USAGE and application-table CRUD.
It must not own the database/tables, create schema objects or roles, inherit
privileged roles, bypass row-level security or access `_prisma_migrations`.

Before the first Render candidate starts, use the guarded workstation migration
command below to initialize the schema with the owner connection. Do not install
blanket future-table grants beforehand: those would expose newly created
`_prisma_migrations` to the runtime role. The migration command starts no API and
creates no fixtures. Then create the runtime role and apply only the explicit
application-table grants below, set future defaults after migration history
already exists, and verify history denial before launching the first candidate.

Use an owner connection from a trusted workstation. Create the runtime role via
SQL if the dashboard's default role has elevated membership, and set its password
through a private provider control or psql's `\password`, never a tracked SQL
literal. Substitute the reviewed role/database identifiers. This example uses
`top_vino_owner` and `top_vino_runtime`:

```sql
CREATE ROLE top_vino_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS NOINHERIT;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE top_vino TO top_vino_runtime;
GRANT USAGE ON SCHEMA public TO top_vino_runtime;
-- After initial migration, grant existing product/auth tables only:
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "user", "account", "session", "verification", "Deck", "Card",
  "DeckCollaborator", "UserCardProgress", "UserResponse", "UserCardReview"
  TO top_vino_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE top_vino_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO top_vino_runtime;
REVOKE ALL ON "_prisma_migrations" FROM top_vino_runtime;
```

Apply defaults only after the initial migration table exists; later additive
application tables inherit CRUD. Recheck grants for each migration introducing
other administrative objects. Database/session access and DDL denial must be
verified through the runtime role before accepting the release. As that role:

```sql
SELECT current_user, rolsuper, rolcreatedb, rolcreaterole, rolreplication,
  rolbypassrls FROM pg_roles WHERE rolname = current_user;
SELECT has_schema_privilege(current_user, 'public', 'CREATE');
SELECT count(*) FROM pg_auth_members WHERE member =
  (SELECT oid FROM pg_roles WHERE rolname = current_user);
SELECT has_table_privilege(current_user, '"_prisma_migrations"', 'SELECT');
SELECT count(*) FROM pg_tables WHERE schemaname = 'public'
  AND tableowner = current_user;
```

Expect all privilege flags false, schema CREATE false, role memberships zero,
migration SELECT false and table ownership zero. Test a product read and write,
and confirm that CREATE TABLE is denied. The final-image harness exercises a
separate nonowner runtime role, API sign-in/read and DDL/migration-table denial
from the first serving instance. A separate empty-schema candidate verifies
startup migration with no runtime grants on migration history.
These local tests do not establish the live Neon grants; record live evidence.

## Workstation migrate, seed and status

Install locked dependencies using the pinned Node/npm baseline. `sandbox:migrate`
requires the opt-in and exact disposable-target confirmation, but no tester/email
or destructive confirmation. It uses only the installed locked Prisma CLI to
apply committed migrations, emits safe status/error-code events, and never
forwards arbitrary Prisma output, repairs failed migration state, seeds or starts
the API. A current schema is a no-op. This is the initial owner-only schema step
before runtime grants and first candidate startup.

Provision an individual `example.test` tester first using [the private provisioning command](synthetic-testers.md).
The seed takes that tester's email; it creates a deterministic private Wine
Fundamentals Deck and three canonical Cards. It creates no shared account,
password, session or HTTP administrative endpoint. Existing Deck/Card content,
user-created data and changed passwords are preserved. Ownership collisions
fail safely, without reclaiming another user's data.

Use a hidden credential prompt and a short-lived subshell. Independently verify
the disposable target from dashboard inventory first; the confirmation compares
exact `host:port/database`, including explicit port. Alternate connection-target
query options are refused. Tools refuse Render and CI environments. The operator
wrapper never loads `.env` or runtime Auth/Prisma modules; migration subprocesses
receive the explicitly confirmed owner URL as `DATABASE_URL`.

```bash
(
  export SANDBOX_DATA_TOOLS_ENABLED=true
  export SANDBOX_DATABASE_TARGET='verified-direct-host:5432/top_vino'
  read -r -s -p 'Direct owner URL: ' DIRECT_URL
  printf '\n'
  export DIRECT_URL
  # Initial schema: run this BEFORE runtime grants and first candidate launch.
  npm run sandbox:migrate -- --confirm-target "$SANDBOX_DATABASE_TARGET"
  # Apply/verify the explicit role grants above, provision a tester privately,
  # then optionally create fixtures:
  npm run sandbox:seed -- --email tester-001@example.test \
    --confirm-target "$SANDBOX_DATABASE_TARGET"
  npm run sandbox:status -- --confirm-target "$SANDBOX_DATABASE_TARGET"
)
```

Status emits migration names, timestamps and applied-step counts, without raw
migration logs or credential URLs. An unfinished, unrolled-back migration
requires schema inspection through the owner connection. Seed failure and
fixture drift do not affect ordinary API startup.

## Deliberate rebuild

Notify testers **72 hours before a planned reset**. Following emergency loss,
notify them by the next business day. Freeze writes and record the independently
verified disposable branch/database, reason and operator. A rebuild is forbidden
after the durable-beta gate; incompatible changes then require expand-and-contract.

Reset requires every seed safeguard plus the exact `ERASE host:port/database`
confirmation and an explicit verified `--runtime-role`. It checks that the role
is nonprivileged, has no role memberships and differs from the owner **before**
dropping anything. It drops/recreates public schema, replays only committed
migrations, reapplies runtime CRUD/default grants, then seeds. It preserves only
the selected provisioned synthetic tester and its private credential hash in
memory; every other tester, session, Deck, Card and Progress is erased. Reprovision
other testers with new synthetic IDs and privately delivered passwords.

```bash
# Inside the same hidden-prompt subshell above:
npm run sandbox:reset -- --email tester-001@example.test \
  --runtime-role top_vino_runtime \
  --confirm-target "$SANDBOX_DATABASE_TARGET" \
  --confirm-destruction "ERASE $SANDBOX_DATABASE_TARGET"
```

A replay failure stops immediately and leaves the rebuild incomplete; it never
blindly resolves or retries. Diagnose status/schema, then intentionally choose a
new confirmed rebuild and reprovision the selected tester if its restore did not
complete. Recheck live grants, readiness, sign-in, authorized read and redacted
logs after any rebuild. Record notification and completion without credentials.

Run `npm run test:sandbox-data` for isolated temporary PostgreSQL CLI acceptance
and `npm run test:container` for the final Linux AMD64 candidate contract.
The operator harness explicitly emulates a workstation only for children using
its private disposable PostgreSQL; it also proves real CI/Render environments
are refused. Live
Neon/Render behavior remains pending until dashboard setup and smoke are verified.
