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
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=
```

### Tasks

- Create `src/lib/auth.ts`
- Configure Prisma adapter — import `PrismaClient` from `../../generated/prisma` (project uses a custom Prisma output path, not `@prisma/client`)
- Configure Better Auth secret and base URL from env vars
- Run `npx auth@latest generate` to append Better Auth model additions to `prisma/schema.prisma`
- Run `prisma migrate dev` manually — the Better Auth CLI generates the schema but **does not run migrations** (Prisma migration is not supported by the CLI)
- Mount Better Auth handler in `src/app.ts`: **must be registered before `express.json()`** or the client API will hang on pending
- Express v5 uses named wildcard syntax: `app.all('/api/auth/{*any}', toNodeHandler(auth))`

### Providers

Enable:

- Email/password
- Google OAuth
- Apple OAuth

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
    return {
      ...session,
      user: { ...user, subscriptionType: dbUser?.subscriptionType },
    };
  }),
];
```

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

## Phase 3: Frontend Authentication Flows

### Supported Login Methods

- Email/password
- Google
- Apple

### Frontend Responsibilities

- Trigger sign in
- Trigger sign up
- Handle redirects
- Store session cookies automatically

### Backend Responsibilities

- Validate session
- Resolve authenticated user
- Authorize requests

---

## Phase 4: Authorization Middleware

### Objective

Replace the `userId` ownership convention with authenticated user identity resolved from the Better Auth session.

### Create

- `authMiddleware.ts` — validates session via `auth.api.getSession({ headers: fromNodeHeaders(req.headers) })`, attaches `req.user`, returns 401 if no valid session
- `requireSubscription.ts` — gates routes on `req.user.subscriptionType` (FREE vs PRO)
- `requireOwnership.ts` — compares resource `userId` field against `req.user.id`
- `requireRole.ts` — checks deck collaborator roles

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

## Phase 5: Protect Application Routes

### Objective

Apply authentication middleware to:

- Deck routes
- Card routes
- Review routes
- User update routes

Replace:

```ts
req.query.userId;
```

with

```ts
req.user.id;
```

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

## Phase 6: Future Enhancements

### Deferred for production readiness:

- MFA
- Passkeys
- Admin roles
- Premium role middleware
- Device management
- Audit logs
- Session dashboard
