FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e AS base
WORKDIR /app
# Prisma's native engine requires OpenSSL on Debian slim.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl=3.0.22-1~deb12u1 libssl3=3.0.22-1~deb12u1 \
    && rm -rf /var/lib/apt/lists/*
RUN test "$(node --version)" = "v24.20.0" && test "$(npm --version)" = "11.19.0"

FROM base AS build
ENV HUSKY=0 PRISMA_SKIP_POSTINSTALL_GENERATE=true CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=true
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN ./node_modules/.bin/prisma generate
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build
COPY scripts/assemble-migration-runtime.mjs ./scripts/assemble-migration-runtime.mjs
RUN node scripts/assemble-migration-runtime.mjs
# Root prepare is development tooling; retain normal dependency lifecycle scripts.
FROM build AS production-dependencies
RUN npm pkg delete scripts.prepare && npm prune --omit=dev --omit=optional --no-audit --no-fund

FROM base AS runtime
ENV NODE_ENV=production PORT=8000 \
    CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=true
COPY package.json package-lock.json ./
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/generated/prisma ./generated/prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/migration ./migration
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/migrations ./prisma/migrations
COPY --chmod=755 scripts/release/entrypoint.sh ./release/entrypoint.sh
COPY scripts/release/migrate.mjs ./release/migrate.mjs
USER node
EXPOSE 8000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["node", "--input-type=module", "-e", "try { const r = await fetch('http://127.0.0.1:' + process.env.PORT + '/health', {signal: AbortSignal.timeout(4000)}); process.exit(r.ok ? 0 : 1); } catch { process.exit(1); }"]
ENTRYPOINT ["/app/release/entrypoint.sh"]
CMD ["node", "dist/server.js"]
