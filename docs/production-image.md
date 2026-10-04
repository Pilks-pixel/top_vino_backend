# Production API image

Issue [#42](https://github.com/Pilks-pixel/top_vino_backend/issues/42) establishes the portable boot contract from deployment spec [#41](https://github.com/Pilks-pixel/top_vino_backend/issues/41). It does not deploy a provider or migrate a database at application startup. The separate database/release work will add the minimal offline migration surface and release entrypoint resolved in #37.

Use Node 24.20.0 and npm 11.19.0 locally (`nvm install && nvm use`). `.npmrc` rejects dependency installs with a different baseline. The Dockerfile pins the resolved multi-platform Bookworm slim digest, checks both versions, pins the OpenSSL runtime packages, installs from the committed lockfile, and generates Prisma for the target platform. `npm run build` compiles application TypeScript to `dist/server.js`, excluding tests and operator scripts; `npm start` runs that entrypoint.

Build the release architecture from a clean checkout:

```bash
npm run test:container
```

Only Docker and Node are needed to run this acceptance command; it needs no local npm install or database. It builds Linux AMD64 (emulated on Apple Silicon), creates an isolated PostgreSQL 15 container and test network, migrates the temporary database using the build stage, and provisions a synthetic tester through Better Auth's server API. It verifies image contents, non-root execution, the configured port on all interfaces, read-only filesystem operation, offline startup, sanitized configuration failure, liveness/readiness during database loss, an authenticated Prisma-backed User Profile read, and both termination signals. Fault injection at HTTP/database boundaries also checks repeated signals, close/disconnect failures, and the ten-second deadline. Owned containers, images and the network are removed even on failure; build cache is retained. It never uses workstation environment files or production credentials.

For a manual build:

```bash
docker build --platform linux/amd64 -t top-vino-api .
```

Provide configuration only at runtime with `docker run --env-file` or your platform's environment settings. Production requires:

| Variable | Contract |
| --- | --- |
| `DATABASE_URL` | PostgreSQL URL with a hostname, database name and valid Prisma connection options; conflicting duplicate options are rejected. Point at an already migrated database. |
| `BETTER_AUTH_SECRET` | At least 32 characters after trimming. |
| `BETTER_AUTH_URL` | HTTPS API origin, without credentials, query, fragment, or path. |
| `FRONTEND_URL` | Explicit HTTPS browser origin, without credentials, query, fragment, or path. |
| `PORT` | Decimal integer from 1 to 65535; the image sets 8000 by default. |
| `LOG_LEVEL` | Optional validated pino level; defaults to info. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional as a pair; omitting both leaves Google OAuth unconfigured. |

Configuration is validated before application, authentication, database, and configured logger modules load. Startup failure logs contain field names and error types, never supplied values. Production does not load `.env` files. Proxy trust remains disabled; deployment-specific trust configuration is later work.

The final image runs `node dist/server.js` directly as PID 1 under the `node` user. It contains production dependencies, compiled application JavaScript and the target-native Prisma Client. Application TypeScript, operator scripts, tests, environment files, Git metadata and unrelated development tools stay outside the image. It requires no persistent filesystem and supports `--read-only --tmpfs /tmp`.

`GET /health` is unauthenticated liveness and does no database I/O. Docker probes it every 30 seconds, with a five-second timeout, ten-second start period and three retries. `GET /ready` returns 200 after `SELECT 1` succeeds or 503 when PostgreSQL is unavailable. Both bypass request limits. The API can boot with an unavailable database; readiness prevents it from being considered ready for traffic.

SIGTERM or SIGINT stops accepting connections, finishes in-flight HTTP work, disconnects Prisma, and exits 0. Additional signals cannot start another shutdown. Close/disconnect failure or the ten-second deadline exits 1.

Public root identity, `/docs`, both schemas, and `/robots.txt` follow the [sandbox documentation contract](./api-reference.md) from #43. Documentation and schemas use their own 60-per-minute quota and prominently warn about disposable data. Platform deployment, production migrations, CI protection, authentication staging, and the Render trust rule remain separate child issues under #41.

The development Compose API uses the build stage and development environment, retaining its source mounts and development dependencies.
