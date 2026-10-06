# Browser sessions and public traffic

Issue [#45](https://github.com/Pilks-pixel/top_vino_backend/issues/45) protects the staged [synthetic tester flow](./synthetic-testers.md) from deployment spec [#41](https://github.com/Pilks-pixel/top_vino_backend/issues/41).

Production browser permissions come from the HTTPS API origin in `BETTER_AUTH_URL` and the exact HTTPS origin in `FRONTEND_URL`. Before a frontend exists, set both to the reviewed API origin so the same-origin documentation can sign in. A future frontend requires review of its origin, cookie behavior and callbacks. Wildcards, origin suffix matching and a production localhost fallback are unavailable. Startup rejects the implicit `BETTER_AUTH_TRUSTED_ORIGINS` variable, which could otherwise widen upstream callback permissions.

Approved requests and preflights receive their exact `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials: true`. Unapproved or absent origins receive neither permission header. All responses carry `Vary: Origin`, including denied requests. CORS governs browser permissions; session authentication and Deck Access still govern product data.

Production session cookies are Secure, HttpOnly, host-only and SameSite=Lax. Cross-subdomain cookies remain disabled. Better Auth's origin, callback, CSRF and Fetch Metadata checks stay enabled. A trusted CORS origin does not disable those checks. SameSite=Lax also means an unrelated-site frontend cannot assume cross-site cookie delivery; review that dependency before enabling a frontend.

## Proxy identity

`TRUST_PROXY` is omitted or `false` by default: Express uses the socket peer and ignores forwarding headers. The only opt-in is `render-1`, the tested single-hop contract. Arbitrary counts, CIDRs, `true`, and Express aliases are rejected at startup. Both outer quotas and Better Auth's burst/session tracking use Express's resolved address. The application overwrites `X-Top-Vino-Client-IP` before handing it to Better Auth; incoming values and `X-Real-IP` cannot override identity.

Enable `render-1` only after verifying the deployed service has exactly one trusted edge hop and no shorter route to the application. The trusted edge must append the actual client address to `X-Forwarded-For` or overwrite it. Resolution selects the address immediately before the socket peer, so prepended client-controlled values have no effect. This is a deployment condition, not a claim that every Render topology has one hop. Keep trust disabled until it is verified; do not add a CDN or another proxy without reviewing and retesting the rule.

The deployment check uses controlled synthetic sessions: compare the reported session IP for normal requests and requests with fabricated `X-Forwarded-For`, `X-Real-IP` and `X-Top-Vino-Client-IP`. Confirm fabricated values do not change the actual client identity and two actual clients receive independent quotas. Record the verified hop shape and date in the deployment runbook without credentials. Local integration tests simulate the reviewed edge by appending its observed client address and verify that changing a prepended spoof cannot renew either quota.

## Limits and bodies

| Traffic | Initial allowance per client IP |
| --- | --- |
| Authentication | 20 requests per 15 minutes, plus Better Auth's sensitive-route rules (sign-in and password change: 3 per 10 seconds) |
| Product API and other public application traffic | 100 requests per 15 minutes |
| Documentation and schemas | 60 requests per minute, independently of product/auth traffic |
| `/health` and `/ready` | Exempt |

All 429 responses include standard `Retry-After`. Outer quotas also emit draft-6 `RateLimit-*` headers; the upstream burst response retains `X-Retry-After` and adds the standard equivalent. Counters are process-local for the single-service sandbox and reset on restart. They are not a distributed quota contract.

Authentication and product bodies are bounded at 10240 decoded bytes before their handlers. JSON, form, other content types, chunked transfers and compressed streams cannot bypass this boundary. Oversized bodies receive a sanitized 413 response. Health probes bypass body parsing and quotas.

## Failure privacy and verification

Automatic logs retain request IDs, route shapes, status, timing, socket metadata and selected transport headers. Token-bearing paths, unknown headers, Origin, Referer, queries, bodies and raw error text/stacks stay out of the request log. Authentication database failures are converted to generic API errors before the upstream router can print them to console. Unknown-route responses do not echo request URLs. Runtime/direct/provisioning database credentials, signing/provider secrets, auth callback URLs and request-body fields have explicit structured redaction coverage; see [logging](./logging.md).

`__tests__/integration/browser-boundary.test.ts` exercises real cookie sessions and HTTP responses against migrated PostgreSQL, including spoofed identities, both auth limits, product limits, health exemptions, byte boundaries and injected failures. Existing authentication, logging, documentation, Deck Access and image acceptance checks remain part of the suite. Provider topology verification is performed during deployment; this issue provisions no provider resources.
