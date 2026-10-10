# Synthetic tester access

This sandbox uses synthetic disposable data, may sleep or reset, and has no
uptime or recovery promise. Each tester gets a separate synthetic ID and private
initial password. Do not enter personal or irreplaceable information.

## Production authentication stage

| Method | Enabled path below `/api/auth` |
| --- | --- |
| POST | `/sign-in/email`, `/sign-out` |
| GET | `/get-session`, `/list-sessions` |
| POST | `/change-password` |
| POST | `/revoke-session`, `/revoke-sessions`, `/revoke-other-sessions` |

Public sign-up, recovery/reset, verification/email change, provider sign-in,
callbacks/linking/unlinking, access/refresh tokens, and other unenabled auth
operations return 404. Google credentials do not enable production provider
flows. The generated Better Auth schema remains an upstream capability reference
and may advertise disabled operations. Another stage requires a reviewed change
and its prerequisite tests. Local development retains sign-up and its guarded
documentation fixture.

Production reads the database session and active credential account on protected
requests, so retained cookies or a session minted by an in-flight sign-in cannot
authorize requests after revocation. Late sessions are removed when encountered.
Better Auth's CSRF and origin
checks stay enabled. Product routes retain their existing Deck Access rules.

## Provision one tester from a workstation

Use the checkout with installed dependencies and a migrated sandbox database. The
operator command is excluded from the production image and has no HTTP endpoint.
It uses the workstation PostgreSQL driver to avoid Prisma's implicit `.env`
loading, uses no shared password, and creates no bootstrap session or
administrative HTTP token.

First independently verify that the selected endpoint/database is the disposable
sandbox. Privately obtain a temporary operator database credential with the
permissions to create users/accounts and revoke accounts/sessions. Never put its
value in a command, log, tracked file, or GitHub Actions setting. The API retains
its separate runtime database role.

The command requires explicit opt-in, an exact `host:port/database` target with
an explicit port, matching target confirmation, and a synthetic ID at
`example.test`. Connection-identity query overrides (`host`, `port`, `dbname`, `database`, `user`,
`password`, `options`, `service`), duplicate parameters, non-public schemas and pooled
operator URLs are refused. The connection uses the public schema explicitly; the
driver cannot override the confirmed target or inherit an ambient `PGPORT`.
Provisioning requires an absolute delivery-file path outside the checkout, with an existing
parent directory and no existing file.

Example in Bash: replace the non-secret target with the independently verified
sandbox target. The hidden prompt and subshell confine the temporary credential:

```bash
private_dir=$(mktemp -d "${TMPDIR:-/tmp}/top-vino-tester.XXXXXX")
chmod 700 "$private_dir"
(
  export SANDBOX_TESTER_TOOLS_ENABLED=true
  export SANDBOX_DATABASE_TARGET='verified-host:5432/disposable-database'
  read -r -s -p 'Temporary operator database URL: ' SANDBOX_PROVISIONING_DATABASE_URL
  printf '\n'
  export SANDBOX_PROVISIONING_DATABASE_URL
  npm run sandbox:tester -- provision \
    --email tester-001@example.test \
    --confirm-target "$SANDBOX_DATABASE_TARGET" \
    --credentials-file "$private_dir/tester.json"
)
```

The command generates a unique 256-bit random password, stores only its Better
Auth password hash, and writes `{ "email", "password" }` to the exclusive `0600`
delivery file. stdout/stderr contain safe JSON events, never credentials or
arbitrary exception text. The temporary URL is removed from the command's
environment before its database client loads; the client disconnects before exit.
Revoke that temporary database credential when finished.

Privately deliver the initial credentials using a password manager's private
sharing channel, then immediately remove the local delivery artifact:

```bash
rm -- "$private_dir/tester.json"
rmdir -- "$private_dir"
unset private_dir
```

An existing tester ID is refused without changing its password or writing a new
file, including after revocation. File collisions are refused. Database creation
failure removes this invocation's delivery file. For an uncertain outcome,
inspect through an authorized operator connection; do not silently reset access.

## Onboarding and revocation

1. Sign in through same-origin `/docs` using the individually delivered password.
2. Call `/change-password` with `currentPassword`, a private `newPassword`, and
   `revokeOtherSessions: true`; the initial password stops working.
3. Inspect `/get-session` and `/list-sessions`. `/revoke-session` accepts one of
   your session tokens; the other operations revoke all sessions or all except
   the current session.
4. Read an authorized Deck through Top Vino API. Studying a Public Deck creates
   your own Progress; another tester cannot inherit it or edit that Deck.
5. Sign out and remove the initial credential from the private sharing channel.

There is no persistent `mustChangePassword` field or additional authorization
state. Production HTTP tests cover these backend flows; frontend UI remains later
work.

To revoke access, use the same guarded temporary-credential subshell with:

```bash
npm run sandbox:tester -- revoke \
  --email tester-001@example.test \
  --confirm-target "$SANDBOX_DATABASE_TARGET"
```

Revocation transactionally deletes all sessions and authentication accounts for
that synthetic user, preventing further sign-in. It retains the user record and
synthetic product data, so Decks and other testers' study data are preserved.
Revoking an absent/already revoked tester is safe to repeat. A later invitation
uses a new synthetic ID.

## Versioned signing secrets

Production requires `BETTER_AUTH_SECRETS` in Better Auth's
[`version:secret` format](https://better-auth.com/docs/reference/options#secrets).
The current highest version comes first; previous versions are strictly
descending and unique. Each distinct value must have at least 32 characters and
no whitespace or delimiters. Missing, malformed, or ambiguous configuration
fails startup without printing values. Nonempty `BETTER_AUTH_SECRET` and
`AUTH_SECRET` are rejected in production; the singular input remains for local
development.

Generate high-entropy keys with `openssl rand -base64 32` privately and enter them
only in the runtime secret dashboard. For normal rotation, add a new highest
version first, retain the previous key for **eight days** (seven-day sessions plus
a one-day buffer), verify existing/new sessions, then retire the old key. Rehearse
annually. Record version numbers, completion dates, and verification, never values.

The locked Better Auth 1.6.23 encryptor supports versioned keys, but its opaque
session-cookie verifier uses only the current key. A narrow before hook verifies
old cookies with Better Auth's cookie API and presents a current-key signature to
the normal handler. Database session lookup and expiry still govern access. New
cookies use the current key; retired-key cookies are denied. Tests exercise
overlap and retirement through separate production server processes.

On suspected compromise, immediately remove the affected key, revoke **all**
sessions through an authorized database operation, and rotate database,
provisioning, or provider credentials that may share the exposure. Verify fresh
sign-in and rejection of old cookies. Never retain the compromised key for the
normal overlap period.
