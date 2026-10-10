// No arbitrary Prisma output is logged: errors can contain credential URLs.
import { spawnSync } from "node:child_process";
import pino from "pino";
import { readdirSync } from "node:fs";
import { createLogger } from "../dist/lib/loggerCore.js";
import { validateEnv } from "../dist/utils/env.js";
const logger = createLogger({
  environment: "production",
  logLevel: "info",
  destination: pino.destination({ dest: 1, sync: true }),
});
try {
  validateEnv();
} catch {
  logger.error(
    { event: "startup_failure", reason: "environment_validation" },
    "Runtime configuration invalid",
  );
  process.exit(1);
}
try {
  const direct = new URL(process.env.DIRECT_URL);
  const runtime = new URL(process.env.DATABASE_URL);
  if (
    !["postgres:", "postgresql:"].includes(direct.protocol) ||
    !direct.hostname ||
    !direct.username ||
    !direct.password ||
    direct.pathname.length <= 1 ||
    direct.hash ||
    [...direct.searchParams.keys()].some(
      key => direct.searchParams.getAll(key).length !== 1,
    ) ||
    direct.searchParams.get("pgbouncer") === "true" ||
    ["host", "port", "dbname", "user", "password", "options", "service"].some(
      key => direct.searchParams.has(key),
    ) ||
    (direct.searchParams.has("schema") &&
      direct.searchParams.get("schema") !== "public") ||
    decodeURIComponent(direct.username) ===
      decodeURIComponent(runtime.username) ||
    direct.pathname !== runtime.pathname ||
    !runtime.username ||
    !runtime.password ||
    (runtime.searchParams.has("schema") &&
      runtime.searchParams.get("schema") !== "public")
  )
    throw new Error("Migration configuration");
  const queryEngine = readdirSync("/app/generated/prisma").find(
    name => name.startsWith("libquery_engine") && name.endsWith(".node"),
  );
  const schemaEngine = readdirSync(
    "/app/migration/node_modules/@prisma/engines",
  ).find(name => name.startsWith("schema-engine-"));
  if (!queryEngine || !schemaEngine)
    throw new Error("Migration engines missing");
  const environment = {
    ...process.env,
    DATABASE_URL: process.env.DIRECT_URL,
    PRISMA_HIDE_UPDATE_MESSAGE: "true",
    CHECKPOINT_DISABLE: "1",
    PRISMA_QUERY_ENGINE_LIBRARY: `/app/generated/prisma/${queryEngine}`,
    PRISMA_SCHEMA_ENGINE_BINARY: `/app/migration/node_modules/@prisma/engines/${schemaEngine}`,
  };
  delete environment.DIRECT_URL;
  delete environment.SANDBOX_PROVISIONING_DATABASE_URL;
  const result = spawnSync(
    process.execPath,
    [
      "/app/migration/node_modules/prisma/build/index.js",
      "migrate",
      "deploy",
      "--schema",
      "/app/prisma/schema.prisma",
    ],
    { env: environment, encoding: "utf8", maxBuffer: 1024 * 1024 },
  );
  if (result.status !== 0) {
    const prismaCode = (result.stderr + result.stdout).match(/\bP\d{4}\b/)?.[0];
    logger.error(
      { event: "migration_failed", prismaCode, exitCode: result.status },
      "Candidate blocked. Inspect operator migration status and schema before retry; never reset or resolve automatically",
    );
    process.exit(1);
  }
  logger.info(
    { event: "migration_completed" },
    "Committed migrations applied or already current",
  );
} catch {
  logger.error(
    { event: "migration_failed", reason: "configuration" },
    "Direct owner connection and distinct runtime role required",
  );
  process.exit(1);
}
