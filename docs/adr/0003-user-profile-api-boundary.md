# The API exposes User Profiles, not user rows

HTTP responses describe users through a deliberate **User Profile** representation — identity and subscription tier only — rather than serializing Prisma `user` rows. Zod schemas are the source of truth for the API contract; the database schema remains the source of truth for persistence. The gap between the two is intentional: adding a column must never silently change the public API.

## Considered options

**Documenting what Prisma returns.** Rejected: it welds the public contract to the persistence shape, so every future column becomes an API change by accident.

**Shaping responses to a declared profile.** Chosen: serialization is confined to one place, and every newly exposed field requires an explicit decision.

## Consequences

- Subscription tier is **immutable through the API**. Nothing grants tier today (no billing integration, no admin roles); when payments arrive, tier changes move behind that integration — this ADR is expected to be superseded then.
- Email is a credential owned by Better Auth. It changes through Better Auth's verified change-email flow, never through the profile endpoint. The profile endpoint updates name only.
- Timestamps and auth bookkeeping fields (`createdAt`, `updatedAt`, `emailVerified`, `image`) stay out of the profile until something needs them.
