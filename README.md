# Top Vino Backend

The HTTP API for Top Vino, built with Node.js, Express, TypeScript, Prisma, and PostgreSQL.

## Current deployment

The disposable API sandbox is live at [top-vino-sandbox.onrender.com](https://top-vino-sandbox.onrender.com). It contains synthetic data only, may sleep or reset, and has no uptime or recovery promise. Do not enter personal or irreplaceable information.

The operator reported these live checks on 2026-11-09:

- Release smoke passed on commit `aa5f576bca721f5b035dc2e6d102196a170f2fb9`.
- Render deploy and application logs were reviewed successfully.
- A second synthetic tester received HTTP 403 when requesting the first tester's private Deck.
- The required `CI / quality` and `CI / container` checks passed for the release.

This confirms the initial API smoke. Broader failure, recovery, and provider-monitoring checks remain tracked in the [deployment runbook](./docs/deployment-runbook.md) and [release recovery guide](./docs/release-recovery.md).

The backend is ready for frontend planning. Frontend sign-in still needs a reviewed origin and cookie plan before it is enabled.

## Local development

Requirements: Node.js `24.20.0`, npm `11.19.0`, and Docker with Compose.

```bash
nvm install
nvm use
npm install --global npm@11.19.0
npm ci
cp .env.example .env
```

Generate a private local Better Auth key with `openssl rand -base64 32` and put it in `.env` as `BETTER_AUTH_SECRET`. The example file uses the local PostgreSQL credentials from Compose; keep `.env` out of Git.

Start PostgreSQL, apply migrations, and run the API:

```bash
docker compose up -d postgres
npx prisma migrate deploy
npm run dev
```

The API runs at `http://localhost:8000`. Browse the interactive reference at `/docs`; see the [API and local fixture guide](./docs/api-reference.md) before seeding or resetting local data.

Run automated checks with PostgreSQL running:

```bash
npm test
npm run test:operations
npm run check-types
npm run lint
npm run build
```

The [testing guide](./docs/TESTING.md) explains the test database and test commands.

## API and authentication

- `GET /openapi.json` serves the Top Vino API contract.
- `GET /docs` serves the Scalar reference.
- `GET /health` reports process liveness; `GET /ready` checks database readiness.
- Production access uses individually provisioned synthetic accounts. Public sign-up, password recovery, and Google sign-in are not enabled in the sandbox.
- Deck and card reads enforce owner, collaborator, or public access. Knowing a private Deck ID does not grant access.

The sandbox currently configures authentication for its API origin. Plan frontend hosting and session-cookie behavior with the [browser boundary guide](./docs/browser-boundary.md) before changing origins or proxy trust.

## Project documentation

- [Deployment runbook](./docs/deployment-runbook.md) — Render and Neon setup, live status, and remaining acceptance evidence
- [Release smoke and recovery](./docs/release-recovery.md) — release checks, smoke command, logs, and recovery procedure
- [Synthetic testers](./docs/synthetic-testers.md) — private provisioning, password change, revocation, and key rotation
- [Sandbox database](./docs/sandbox-database.md) — migrations, role grants, fixture seed, and guarded reset
- [Browser boundary](./docs/browser-boundary.md) — origins, cookies, proxy trust, limits, and request boundaries
- [Repository policy](./docs/repository-policy.md) — protected-main and CI requirements
- [Logging contract](./docs/logging.md) — structured logs, redaction, and request correlation
- [Domain glossary](./docs/GLOSSARY.md) and [architecture decisions](./docs/adr/) — domain language and settled decisions
- [Portability](./docs/portability.md) — database export/restore rehearsal and future durability gates
