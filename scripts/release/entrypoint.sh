#!/bin/sh
set -eu
node /app/release/migrate.mjs
unset DIRECT_URL SANDBOX_PROVISIONING_DATABASE_URL
exec "$@"
