# Production API image

Issue [#42](https://github.com/Pilks-pixel/top_vino_backend/issues/42) establishes the portable boot contract from deployment spec [#41](https://github.com/Pilks-pixel/top_vino_backend/issues/41). Issue [#46](https://github.com/Pilks-pixel/top_vino_backend/issues/46) adds the offline migration entrypoint resolved in #37; [database lifecycle](./sandbox-database.md) explains separate roles, seed/reset and diagnosis. Provider deployment remains separately verified.

Use Node 24.20.0 and npm 11.19.0 locally (`nvm install && nvm use`). `.npmrc` rejects dependency installs with a different baseline. The Dockerfile pins the resolved multi-platform Bookworm slim digest, checks both versions, pins the OpenSSL runtime packages, installs from the committed lockfile, and generates Prisma for the target platform. `npm run build` compiles application TypeScript to `dist/server.js`, excluding tests and operator scripts; `npm start` runs that entrypoint.

Build the release architecture from a clean checkout:

```bash
npm run test:container
```

Only Docker and Node are needed to run this acceptance command; it needs no local npm install or database. It builds Linux AMD64 (emulated on Apple Silicon), creates an isolated PostgreSQL 15 container and test network, migrates the temporary database through the final candidate entrypoint, and provisions a hashed synthetic tester fixture outside runtime HTTP. It verifies image contents, non-root execution, the configured port on all interfaces, read-only filesystem operation, offline migration-tool loading, failed migration blocking traffic, credential shedding, no-op restart, sanitized configuration failure, liveness/readiness during database loss, an authenticated Prisma-backed User Profile read, and both termination signals. Fault injection at HTTP/database boundaries also checks repeated signals, close/disconnect failures, and the ten-second deadline. Owned containers, images and the network are removed even on failure; build cache is retained. It never uses workstation environment files or production credentials.

On Apple Silicon, Docker Desktop Rosetta may inject exactly `--no-opt -r /proc/.reset` before the compiled server argument. Local acceptance permits only that recognized emulation prefix and still checks the PID 1 executable/environment. Native Linux CI requires exactly `node dist/server.js`.

For a manual build:

```bash
docker build --platform linux/amd64 -t top-vino-api .
```

Provide configuration only at runtime with `docker run --env-file` or your platform's environment settings. Production requires:

| Variable                                   | Contract                                                                                                                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                             | PostgreSQL URL with a hostname, database name and valid Prisma connection options; conflicting duplicate options are rejected. Use the pooled endpoint and a separate least-privilege role; omitted connection/pool settings default to 5/15/10. |
| `DIRECT_URL`                               | Direct owner connection for the same database, with a distinct role. Used only by migration startup and shed before Node starts.                                                                                                                 |
| `BETTER_AUTH_SECRETS`                      | Versioned secrets, current highest version first; each distinct value has at least 32 characters. Singular secrets are development-only. See [rotation](./synthetic-testers.md#versioned-signing-secrets).                                       |
| `BETTER_AUTH_URL`                          | HTTPS API origin, without credentials, query, fragment, or path.                                                                                                                                                                                 |
| `FRONTEND_URL`                             | Explicit HTTPS browser origin, without credentials, query, fragment, or path.                                                                                                                                                                    |
| `PORT`                                     | Decimal integer from 1 to 65535; the image sets 8000 by default.                                                                                                                                                                                 |
| `LOG_LEVEL`                                | Optional validated pino level; defaults to info.                                                                                                                                                                                                 |
| `TRUST_PROXY`                              | Omitted or `false` by default; only `render-1` opts into the verified single-hop deployment rule. See [browser boundary](./browser-boundary.md).                                                                                                 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional as a pair for local development. Production provider flows remain disabled regardless of these values.                                                                                                                                  |

Configuration is validated before application, authentication, database, and configured logger modules load. Startup failure logs contain field names and error types, never supplied values. Production does not load `.env` files. Proxy trust defaults to disabled; deployment must verify the reviewed hop contract before opting in.

The release entrypoint migrates first, sheds the direct credential and execs `node dist/server.js` directly as PID 1 under the `node` user. It contains production dependencies, compiled application JavaScript, the target-native Prisma Client, the locked migration-only CLI closure/native schema engine, schema and committed migrations. Application TypeScript, operator scripts, tests, environment files, Git metadata and unrelated development tools stay outside the image. It requires no persistent filesystem and supports `--read-only --tmpfs /tmp`.

`GET /health` is unauthenticated liveness and does no database I/O. Docker probes it every 30 seconds, with a five-second timeout, ten-second start period and three retries. `GET /ready` returns 200 after `SELECT 1` succeeds or 503 when PostgreSQL is unavailable. Both bypass request limits. A candidate cannot start the API when its direct migration connection fails. Once running, database loss leaves liveness healthy and makes readiness return 503.

SIGTERM or SIGINT stops accepting connections, finishes in-flight HTTP work, disconnects Prisma, and exits 0. Additional signals cannot start another shutdown. Close/disconnect failure or the ten-second deadline exits 1.

Public root identity, `/docs`, both schemas, and `/robots.txt` follow the [sandbox documentation contract](./api-reference.md) from #43. Documentation and schemas use their own 60-per-minute quota and prominently warn about disposable data. The [browser boundary](./browser-boundary.md) from #45 protects exact origins, cookies, client identity, traffic and body sizes. Platform deployment and CI protection remain separate child issues under #41. The [synthetic tester contract](./synthetic-testers.md) from #44 enables only the initial authentication stage.

The development Compose API uses the build stage and development environment, retaining its source mounts and development dependencies.
