# Logging is a redacted, correlated JSON stream on stdout

The logger grew a policy — level defaults, redaction, request correlation, failure events — that lived only in implementation details and could be regressed without any test noticing. This decision pins that policy down: what the logger guarantees, and what it deliberately does not do.

## Considered options

**Environment-driven defaults with a validated `LOG_LEVEL` override.** Development defaults to `debug`, test to `silent`, staging and production to `info`. When `LOG_LEVEL` is set it must name a pino level; an invalid value fails startup. Chosen: deploys get sensible behavior with no configuration, while an explicit override can never silently fall back to an unintended level.

**Project-wide redaction of credential-bearing fields.** Passwords, tokens, secrets, API keys, session material, and the `authorization`/`cookie`/`set-cookie` header families are censored to `[Redacted]` wherever the enumerated redaction paths reach — top level, up to three levels of nesting, inside arrays, and serialized request headers. Chosen over per-call-site discipline for the same reason as ADR 0001: a rule enforced in one place cannot be forgotten at the next call site.

**Safe request metadata only in automatic logs.** Automatic request logs carry method, path without the query string, redacted headers, remote address, and status code. Request bodies and raw query strings are excluded entirely, so no serializer has to be trusted with them. Authentication requests pass through the same protected stream.

**End-to-end request correlation via `X-Request-Id`.** A valid inbound ID (non-empty, ≤128 characters, printable token characters) is kept; an absent or invalid one is replaced with a generated UUID. The resolved ID is returned on the response and stamped on the request log and every error log for that request. Chosen over accepting any inbound header, which would let clients inject arbitrary content into log records.

**Stdout as the only transport.** Production emits structured JSON to stdout; development pipes the same records through `pino-pretty`. The process writes no log files. Chosen because log collection belongs to the platform running the container, not to the application.

## Consequences

Every log statement flows through one pino instance; `console` logging is a bug, not a style choice, and the integration tests assert it. Injecting a destination stream into `createLogger` makes the whole contract testable without touching stdout.

Redaction is a denylist: a credential stored under a field name the list does not cover will be logged. New credential-bearing fields must be added to `DEFAULT_REDACT_PATHS` when they are introduced.

Because bodies and query strings never reach the logs, debugging from request logs alone means reproducing requests — the correlation ID is the bridge back to the client.

An invalid `LOG_LEVEL` stops the process from booting. That is intentional: a misspelled level in a deploy surfaces immediately instead of silently changing what is recorded.

## Non-goals

- Vendor transports or an external logging service.
- Application-managed log files.
- AsyncLocalStorage-based context propagation.
- Distributed tracing.
- Docker production hardening.
