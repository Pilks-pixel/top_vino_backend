# Phase 3 — Authentication Integration & Authorization

Integrate Better Auth as the authentication provider while implementing
authorization middleware throughout the application.

The frontend application will authenticate users via:

- Email/password
- Google OAuth
- Apple OAuth

The backend will trust Better Auth sessions and use the authenticated user
identity for authorization decisions.

---

## Phase 1: Integrate Better Auth with Prisma

### Objective

Install Better Auth and integrate it with the existing Prisma database.

### Packages

- `better-auth`
- `@better-auth/prisma-adapter` (install separately; import via `better-auth/adapters/prisma`)

### Environment Variables

Add to `.env`:

```
BETTER_AUTH_SECRET=          # min 32 chars — generate with: openssl rand -base64 32
BETTER_AUTH_URL=             # e.g. http://localhost:8000
                             # Google OAuth callback must be registered as: ${BETTER_AUTH_URL}/api/auth/callback/google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### Tasks

- Create `src/lib/auth.ts`
- Configure Prisma adapter — import `PrismaClient` from `../../generated/prisma` (project uses a custom Prisma output path, not `@prisma/client`)
- Configure Better Auth secret and base URL from env vars
- Rename the existing `subscription_type` Prisma field to `subscriptionType` with `@map("subscription_type")` — keeps the DB column unchanged, aligns the Prisma client with Better Auth's camelCase conventions, and allows `customSession` to read `dbUser.subscriptionType` correctly. Update all references: `userSchema.ts`, test factories, and integration/unit test fixtures.
- Make `User.name` optional (`name String?`) — Better Auth email/password sign-up only requires email and password; name can be completed via a profile update flow post sign-up. Update `userSchema.ts` accordingly.
- Promote `DeckCollaborator.role` from `String` to a new `CollaboratorRole` enum (`EDITOR`, `VIEWER`) in the same migration — prevents invalid role values at the DB level and makes `requireRole.ts` type-safe. Update `deckCollaboratorModel.ts` and any test fixtures that reference the string literals `"editor"` / `"viewer"`.
- Run `npx auth@latest generate` to append Better Auth model additions to `prisma/schema.prisma`
- Run `prisma migrate dev` manually — the Better Auth CLI generates the schema but **does not run migrations** (Prisma migration is not supported by the CLI)
- Mount Better Auth handler in `src/app.ts`: **must be registered before `express.json()`** or the client API will hang on pending
- Express v5 uses named wildcard syntax: `app.all('/api/auth/{*any}', toNodeHandler(auth))`
- Configure an `onError` hook in `src/lib/auth.ts` to map Better Auth errors to the existing `ErrorResponse` shape (`{ success: false, status: "error", statusCode, message }`). Better Auth errors bypass `errorHandler` since they are handled inside `toNodeHandler` — without this hook, auth errors (invalid credentials, email already in use) return a different JSON structure from the rest of the API.

```ts
onAPIError: {
  onError: (error, ctx) => {
    console.error("[AUTH ERROR]", error.message);
    ctx.context.returned = new Response(
      JSON.stringify({
        success: false,
        status: "error",
        statusCode: error.status ?? 500,
        message: error.message,
      }),
      { status: error.status ?? 500, headers: { "Content-Type": "application/json" } },
    );
  },
},
```

### Providers

Enable:

- Email/password
- Google OAuth

> Apple OAuth deferred — requires Team ID, Key ID, and a `.p8` private key in addition to client ID/secret. See Phase 6.

---

## Phase 2: Configure Session Management

### Objective

Use Better Auth cookie-based session management. Better Auth manages the session lifecycle — no manual JWT generation required.

### Decisions

- Session expiration: 7 days (default)
- `updateAge`: 1 day — session expiry is rolling, refreshed on each use
- Cookie cache enabled for performance — avoids a DB read on every `getSession` call
- Session revocation enabled
- Account linking enabled

### Cookie Cache

Enable in `src/lib/auth.ts` to avoid a database hit on every request:

```ts
session: {
  expiresIn: 60 * 60 * 24 * 7,
  updateAge: 60 * 60 * 24,
  cookieCache: {
    enabled: true,
    maxAge: 5 * 60  // 5-minute client-side cache
  }
}
```

> Note: revoked sessions on other devices remain valid until the cache expires (`maxAge`). Acceptable for this use case; shorten `maxAge` if immediate revocation becomes a requirement.

### Custom Session — Subscription Tier

Use the `customSession` plugin to expose `subscriptionType` in the session so authorization middleware can gate FREE vs PRO features without an extra DB lookup:

```ts
plugins: [
  customSession(async ({ user, session }) => {
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) throw new Error(`Session references unknown user: ${user.id}`);
    return {
      ...session,
      user: { ...user, subscriptionType: dbUser.subscriptionType },
    };
  }),
];
```

> If `dbUser` is `null`, throw — a valid Better Auth session referencing a non-existent app user indicates out-of-band deletion or DB corruption. Fail loudly rather than letting a ghost user through.

### Session Validation Helper

In Express middleware, use `fromNodeHeaders` from `better-auth/node` to convert `req.headers` into the format Better Auth expects:

```ts
import { fromNodeHeaders } from "better-auth/node";

const session = await auth.api.getSession({
  headers: fromNodeHeaders(req.headers),
});
```

### Database Tables

Better Auth will introduce (via `npx auth@latest generate`):

- `user` (extended — Better Auth merges with existing user fields where possible)
- `session`
- `account`
- `verification`

---

## Phase 3: Authorization Middleware

### Objective

Replace the `userId` ownership convention with authenticated user identity resolved from the Better Auth session.

### Create

- `src/types/express.d.ts` — extends `Express.Request` with the `user` shape so every downstream middleware and controller is type-safe without `any` casts
- `authMiddleware.ts` — validates session via `auth.api.getSession({ headers: fromNodeHeaders(req.headers) })`, attaches `req.user`, returns 401 if no valid session
- `requireSubscription.ts` — gates routes on `req.user.subscriptionType` (FREE vs PRO)
- `requireOwnership.ts` — compares resource `userId` field against `req.user.id`; used for delete and collaborator management (owner-only)
- `requireRole.ts` — checks deck collaborator roles; permits editors to mutate deck metadata and cards, viewers are read-only

### Collaborator Permission Model

| Operation | Owner | Editor | Viewer |
|---|---|---|---|
| Read deck / cards | ✅ | ✅ | ✅ |
| Update deck metadata | ✅ | ✅ | ❌ |
| Create / update / delete cards | ✅ | ✅ | ❌ |
| Delete deck | ✅ | ❌ | ❌ |
| Add / remove collaborators | ✅ | ❌ | ❌ |

> Owner is determined by `deck.userId === req.user.id`. Editor/Viewer is determined by the `DeckCollaborator.role` field.

### Session Validation Pattern

```ts
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";

export const authMiddleware = catchAsync(async (req, res, next) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session) throw new UnauthorizedError("Not authenticated");
  req.user = session.user;
  next();
});
```

### Request Context

```ts
req.user = {
  id: string;
  email: string;
  subscriptionType: 'FREE' | 'PRO';  // surfaced via customSession plugin
}
```

## Phase 4: Protect Application Routes

### Objective

Apply authentication middleware to:

- Deck routes
- Card routes
- Review routes
- User update routes

**Remove** the `POST /user` route. User creation is now owned exclusively by Better Auth (`POST /api/auth/sign-up/email`). Seeding should use a dedicated seed script, not a live HTTP endpoint.

Replace `req.query.userId` with `req.user.id` across all routes, with one exception:

### `GET /deck` — Scoped Deck Listing

| Scenario | Behaviour |
|---|---|
| No `userId` query param | Return authenticated user's decks (public + private) |
| `userId` matches `req.user.id` | Return that user's decks (public + private) |
| `userId` differs from `req.user.id` | Return only that user's **public** decks (`isPublic: true`) |

Update `listDecksForUser` in `deck.service.ts` to accept an optional `isPublic` filter, and update `getAllDecksForUser` in `deckModel.ts` accordingly.

### CORS Configuration

Better Auth uses **cookie-based** sessions. The frontend (separate origin) must be able to send cookies with requests. Update the CORS configuration in `src/app.ts`:

```ts
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true, // required — without this, browsers will not send session cookies cross-origin
  }),
);
```

> Do not use `origin: '*'` with `credentials: true` — browsers reject this combination. Always specify the frontend origin explicitly.

### Integration Test Strategy

Mock `auth.api.getSession` at the module level in integration tests — fast, deterministic, and decoupled from Better Auth internals.

In `__tests__/setup/testApp.ts` (or per-suite), mock the module before routes are loaded:

```ts
jest.mock("../../src/lib/auth", () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
    handler: jest.fn(),
  },
}));
```

Each test (or `beforeEach`) configures the resolved user:

```ts
import { auth } from "../../src/lib/auth";

(auth.api.getSession as jest.Mock).mockResolvedValue({
  user: { id: testUser.id, email: testUser.email, subscriptionType: "FREE" },
  session: {},
});
```

Set `getSession` to resolve `null` in tests that exercise the 401 path. Remove `userId` query params from all existing integration test requests.

## Phase 5: Future Enhancements

### Deferred for production readiness:

- Apple OAuth (requires Team ID, Key ID, `.p8` private key; App Store Connect setup; `sub` identifier handling)
- MFA
- Passkeys
- Admin roles
- Premium role middleware
- Device management
- Audit logs
- Session dashboard

### Notes

Note for production: before running this migration on a DB with existing User data, replace the DROP TABLE "User" / CREATE TABLE "user" block with ALTER TABLE "User" RENAME TO "user".


