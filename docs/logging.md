# Logging

Each application process logs through one pino instance using the shared factory and redaction policy in [src/lib/loggerCore.ts](../src/lib/loggerCore.ts). Normal requests and lifecycle events use the instance exported by [src/lib/logger.ts](../src/lib/logger.ts); nothing logs through `console`. Startup validates configuration before loading that configured instance. A validation failure creates a synchronous error-level instance with the same factory, logs sanitized field names and error types, and exits without creating the normal instance. The architectural rationale lives in ADR 0002 (`adr/0002-logging-contract.md`); this page describes the behavior.

## Transport

- Production and staging emit structured JSON to stdout. There are no application-managed log files and no vendor transports.
- Development formats the same records through `pino-pretty`.
- Tests inject a destination stream via `createLogger({ destination })` instead of writing to stdout.

## Levels

`LOG_LEVEL` is an explicit override. When set it must be one of `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent`; an invalid value throws a configuration error and startup fails.

Without `LOG_LEVEL`, the level follows `NODE_ENV`:

| Environment                            | Default level |
| -------------------------------------- | ------------- |
| `development`                          | `debug`       |
| `test`                                 | `silent`      |
| `staging`, `production`, anything else | `info`        |

## Redaction

Credential-bearing fields are redacted from every log record project-wide, replaced with `[Redacted]`. Redaction covers the sensitive field names at the top level, up to three levels of nesting, and inside arrays, plus the credential-bearing HTTP headers on serialized requests. The covered names include passwords, tokens, secrets, API keys, session material, and the `authorization`, `cookie`, `set-cookie`, `proxy-authorization`, and `x-api-key` header families. The full list is `DEFAULT_REDACT_PATHS` in [src/lib/loggerCore.ts](../src/lib/loggerCore.ts), re-exported from `logger.ts`. Coverage is bounded by these enumerated paths: a credential stored under an unlisted field name, or nested deeper than the listed paths, is not redacted — new credential-bearing fields must be added to the list when they are introduced.

## Automatic request logs

Every HTTP response produces one automatic log record through `pino-http`, including requests to the authentication routes. The record carries safe request metadata only:

- method, route shape with queries and path parameters removed, selected transport headers, remote address
- no request bodies, no raw query strings
- the response status code

Only Host, Content-Type and Content-Length remain in automatic request headers. Origin, Referer, credential headers and unknown headers are omitted. Known product paths use placeholders such as `/deck/:deckId/cards/:cardId`; unknown paths use `/[unmatched]` or `/api/auth/[unavailable]`. This tightens the safe-path/redacted-header contract to exclude token-bearing paths and newly named credential headers. Raw error messages and stacks are excluded from structured failure logs; request IDs, event, status and error type support correlation. Development HTTP errors may still include debugging stacks; production responses do not.

Structured redaction also covers `DATABASE_URL`, `DIRECT_DATABASE_URL`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRETS`, `SANDBOX_PROVISIONING_DATABASE_URL`, request-body fields and authentication callback URLs. Better Auth's unexpected-error hook converts database failures to generic API errors before its underlying router can print raw errors to console. See the [browser boundary](./browser-boundary.md) for the HTTP privacy checks.

The log level follows the outcome: `5xx` responses and request errors log at `error`, `4xx` at `warn`, everything else at `info`.

## Request correlation

Every request carries a correlation ID:

- A client-supplied `X-Request-Id` header is kept when it is non-empty, at most 128 characters, and made of printable token characters (`A–Z a–z 0–9 . _ ~ : / -`).
- An absent or invalid header is replaced with a generated UUID.
- The resolved ID is returned on the `X-Request-Id` response header and appears on the request log and on every error log for that request.

## Operational failure events

Expected failures log as structured events carrying `event`, `route`, `statusCode`, and `requestId`; failures caused by a thrown error also carry `errorType`.

| Event                                                                                                      | Level                                                        | Emitted when                                            |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| `authentication_failure`                                                                                   | `warn` (`error` on 5xx)                                      | An `/api/auth` request completes with a failure status  |
| `validation_failure`                                                                                       | `warn`                                                       | Request payload fails schema validation                 |
| `persistence_failure`                                                                                      | `warn` for expected constraint violations, `error` otherwise | A Prisma error reaches the error handler                |
| `request_failure`                                                                                          | `warn`                                                       | An operational `AppError` reaches the error handler     |
| `application_failure`                                                                                      | `error`                                                      | An unexpected error reaches the error handler           |
| `readiness_check_failure`                                                                                  | `warn`                                                       | The `/ready` database check fails                       |
| `startup_failure`                                                                                          | `error`                                                      | Environment validation or the HTTP server fails at boot |
| `shutdown_started`, `http_server_closed`, `database_disconnected`                                          | `info`                                                       | Graceful shutdown progresses                            |
| `shutdown_already_started`, `shutdown_timeout`, `http_server_close_failure`, `database_disconnect_failure` | `warn` / `error`                                             | Graceful shutdown misbehaves                            |

## Verification

The contract is enforced by tests, not by convention:

- [**tests**/unit/logger.test.ts](../__tests__/unit/logger.test.ts) — level defaults and validation, destination injection, redaction coverage.
- [**tests**/integration/logging.test.ts](../__tests__/integration/logging.test.ts) — request ID lifecycle, safe request metadata, protected auth-route logging, status-based levels.
- [**tests**/integration/operational-logging.test.ts](../__tests__/integration/operational-logging.test.ts) — operational failure events.

## Follow-up work

Deliberately left to separate tickets:

- Vendor transports (external log aggregation).
- Docker production hardening.
- README cleanup.
