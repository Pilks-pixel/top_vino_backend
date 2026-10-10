# API reference and sandbox

**The public sandbox uses synthetic disposable data, may sleep or reset, and
has no uptime or recovery promise.** Do not enter personal or irreplaceable
information. Interactive requests are real; writes can persist until a reset
or data loss. Testers use individually provisioned accounts.

How to browse, authenticate against, and safely manage the local data used by
the interactive API reference during development.

## Where the contracts live

- `GET /` — minimal API identity, sandbox notice, and link to the reference.
- `GET /docs` — public browsable [Scalar](https://scalar.com) reference,
  including in production, with a visible sandbox notice above the console.
- `GET /openapi.json` — the Top Vino application contract (OpenAPI 3.1),
  generated from the same Zod schemas used for request validation. Live in
  every environment.
- `GET /api/auth/open-api/generate-schema` — Better Auth's generated OpenAPI
  3.1.1 **capability reference**. Advertised routes may be disabled; a schema
  entry does not guarantee availability. Public sign-up, email recovery and
  verification, and Google OAuth require separate deployment prerequisites.
  Live in every environment.

The Scalar page offers two sources: **Top Vino API** (selected by default) and
**Authentication capabilities** (Better Auth's generated document). The product
schema describes live product routes; the authentication schema describes the
broader capability surface and does not enable those capabilities.

Sandbox responses send `X-Robots-Tag: noindex, nofollow`; `GET /robots.txt`
asks crawlers to avoid all paths. This is indexing guidance, not access control.
The reference and both schemas share a limit of **60 requests per minute per
client IP**, separate from authentication and product limits. Robots guidance
uses the same documentation quota. A 429 includes `Retry-After` and standard
rate-limit headers.

`GET /health` is unauthenticated liveness without database access. `GET /ready`
returns `{ "status": "ready" }` with 200 when PostgreSQL is reachable, or
`{ "status": "unavailable" }` with 503 when it is unavailable. Both bypass all
application request limits and do not disclose connection or configuration
details.

## Interactive requests are real and persistent

Scalar's console sends real HTTP requests from your browser and includes
browser cookies. Anything you create, change, or delete is written to the
connected database. Production sandbox data is disposable; local development
writes persist in your local database. For development, the effective
`DATABASE_URL` comes from `.env` unless you have exported it in
your shell, in which case the shell value overrides `.env`. The Top Vino
document's description states this as well.

## Local development seed fixture

The following fixture and operator commands are for local development only.
The public sandbox uses private credentials provisioned for each tester.
See [synthetic tester access](./synthetic-testers.md) for the operator command,
onboarding and session management, revocation, and secret rotation.

`docs:seed` creates a deterministic, sign-in-ready fixture:

- User: `scalar@example.test` / password `TopVinoDocs1!`, subscription `FREE`
- One private deck: **Wine Fundamentals**
- Three cards, one of each type: `basic`, `multiple_choice`, `open_ended`

Seeding is idempotent reconciliation: reruns recreate missing fixture records,
never duplicate them, and preserve any edits you made to existing fixture
records. If `scalar@example.test` already exists but the documented password no
longer signs in (credential drift), the seed fails rather than silently
changing credentials.

## Reset scope (read before running)

**`npm run db:reset:dev` is destructive.** `npm run docs:reset` is an alias
that runs the exact same command. The reset:

- Empties **all** application and Better Auth tables (`user`, `account`,
  `session`, `verification`, `Deck`, `DeckCollaborator`, `Card`,
  `UserCardProgress`, `UserResponse`, `UserCardReview`), including any users
  you created manually through Scalar — those are ordinary Better Auth users
  and are removed like everything else.
- Preserves the database, schema, and migration history.
- Does **not** reseed anything; the database is left empty.

## Safety safeguards

Both `docs:seed` and the reset commands refuse to run unless **all** of the
following hold:

1. `NODE_ENV` is exactly `development`.
2. `DOCS_DATA_TOOLS_ENABLED` is exactly `true` (explicit opt-in; it defaults
   to `false` in `.env.example` and is never required for server startup).
3. `DATABASE_URL` points at a local host: `localhost`, `127.0.0.1`, or the
   Docker service host `postgres`.

The CLI loads `.env` itself via dotenv, but dotenv never overrides values
already set in your shell — shell values win. Because `.env` defaults
`DOCS_DATA_TOOLS_ENABLED=false`, prefix the command explicitly:

```bash
# Reset the local development database (destructive — see scope above)
DOCS_DATA_TOOLS_ENABLED=true npm run db:reset:dev
# or the alias:
DOCS_DATA_TOOLS_ENABLED=true npm run docs:reset

# Seed the fixture (also works when .env has DOCS_DATA_TOOLS_ENABLED=false)
DOCS_DATA_TOOLS_ENABLED=true npm run docs:seed
```

If you have already exported `DOCS_DATA_TOOLS_ENABLED=true` in your shell, the
plain `npm run docs:seed` / `npm run db:reset:dev` forms work too.

## Signing in through Scalar

Email/password is the supported interactive Scalar path. Google OAuth appears
in the Authentication capabilities reference, but it depends on provider configuration and
browser redirects, so it is not part of the required manual acceptance flow.

## Manual workflow

1. Set the opt-in for your shell (`export DOCS_DATA_TOOLS_ENABLED=true`) or
   plan to prefix each command as shown above.
2. `npm run db:reset:dev` — start from an empty database.
3. `npm run docs:seed` — create the fixture.
4. `npm run dev` — start the development server.
5. Open `http://localhost:8000/docs`.
6. Switch to the **Authentication capabilities** source and sign in with
   `scalar@example.test` / `TopVinoDocs1!`.
7. Switch back to the **Top Vino API** source and call `GET /user/me` — the
   session cookie set by sign-in authenticates the request.
8. Inspect the seeded **Wine Fundamentals** deck or create your own deck/cards;
   remember these writes persist in your local database.
9. Sign out via the Authentication source when done.
10. Optionally sign up a second user to see ordinary (non-fixture) data.
11. When finished experimenting, run `npm run db:reset:dev` again to leave the
    database empty.

## Wrong-password recovery

If the fixture user exists but `TopVinoDocs1!` no longer signs in (you changed
the password while experimenting), recover with a reset followed by a seed:

```bash
DOCS_DATA_TOOLS_ENABLED=true npm run db:reset:dev
DOCS_DATA_TOOLS_ENABLED=true npm run docs:seed
```

Credentials are never reset automatically.
