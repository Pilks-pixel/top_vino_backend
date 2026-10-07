import { operatorDatabaseTarget } from "./operatorDatabaseTarget.ts";
import { randomBytes, randomUUID } from "node:crypto";
import { open, realpath, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join, basename, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createLogger } from "../lib/loggerCore.ts";

const logger = createLogger({ environment: "production", logLevel: "info" });

// This workstation-only command deliberately loads neither dotenv nor the
// runtime Auth/Prisma modules. Its temporary database credential never becomes
// a bootstrap HTTP credential, session, or a long-running API environment value.
async function main(): Promise<void> {
  const databaseUrl = process.env.SANDBOX_PROVISIONING_DATABASE_URL;
  delete process.env.SANDBOX_PROVISIONING_DATABASE_URL;
  const { values, positionals } = parseArgs({
    options: {
      email: { type: "string" },
      "credentials-file": { type: "string" },
      "confirm-target": { type: "string" },
    },
    allowPositionals: true,
  });
  const action = positionals[0];
  if (
    positionals.length !== 1 ||
    !["provision", "revoke"].includes(action) ||
    process.env.SANDBOX_TESTER_TOOLS_ENABLED !== "true" ||
    !databaseUrl
  )
    throw new Error("Operator safeguards not satisfied");

  const { target } = operatorDatabaseTarget(databaseUrl);
  if (
    process.env.SANDBOX_DATABASE_TARGET !== target ||
    values["confirm-target"] !== target
  )
    throw new Error("Sandbox target confirmation required");

  const email = values.email;
  if (!email || !/^[a-z0-9][a-z0-9._-]{0,63}@example\.test$/.test(email)) {
    throw new Error("Use a synthetic tester ID at example.test");
  }
  let file = values["credentials-file"];
  const project = await realpath(
    fileURLToPath(new URL("../../", import.meta.url)),
  );
  if (action === "provision") {
    if (!file || !isAbsolute(file)) {
      throw new Error("Private delivery file must be outside the checkout");
    }
    file = join(await realpath(dirname(file)), basename(file));
    if (resolve(file).startsWith(project + sep)) {
      throw new Error("Private delivery file must be outside the checkout");
    }
  } else if (file) throw new Error("Revocation does not use a delivery file");

  // Use the workstation's PostgreSQL driver directly: Prisma's generated
  // constructor implicitly loads local .env files even with a datasource URL.
  const { default: pg } = await import("pg");
  const databaseClient = new pg.Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 15_000,
    options: "-c search_path=public",
  });
  databaseClient.on("error", () => {
    logger.error(
      { event: "synthetic_tester_database_failure" },
      "Operator database connection failed",
    );
    process.exitCode = 1;
  });
  let deliveryFileCreated = false;
  try {
    await databaseClient.connect();
    const found = await databaseClient.query<{ id: string }>(
      'SELECT "id" FROM "user" WHERE "email" = $1',
      [email],
    );
    const existing = found.rows[0];
    if (action === "revoke") {
      if (existing) {
        await databaseClient.query("BEGIN");
        await databaseClient.query(
          'DELETE FROM "account" WHERE "userId" = $1',
          [existing.id],
        );
        await databaseClient.query(
          'DELETE FROM "session" WHERE "userId" = $1',
          [existing.id],
        );
        await databaseClient.query("COMMIT");
      }
      logger.info(
        { event: "synthetic_tester_revoked" },
        "Tester access revoked",
      );
      return;
    }
    if (existing)
      throw new Error("Existing tester credentials are never reset");

    const password = randomBytes(32).toString("base64url");
    const { hashPassword } = await import("better-auth/crypto");
    const passwordHash = await hashPassword(password);
    // Exclusive creation refuses existing files and symlinks. Password delivery
    // has its own private channel; stdout/stderr contain only safe events.
    const delivery = await open(file!, "wx", 0o600);
    deliveryFileCreated = true;
    try {
      await delivery.writeFile(JSON.stringify({ email, password }) + "\n");
    } finally {
      await delivery.close();
    }
    const id = randomUUID();
    await databaseClient.query("BEGIN");
    await databaseClient.query(
      'INSERT INTO "user" ("id", "email", "name", "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
      [id, email, "Synthetic tester"],
    );
    await databaseClient.query(
      'INSERT INTO "account" ("id", "accountId", "providerId", "userId", "password", "updatedAt") VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)',
      [randomUUID(), id, "credential", id, passwordHash],
    );
    await databaseClient.query("COMMIT");
    deliveryFileCreated = false;
    logger.info(
      { event: "synthetic_tester_provisioned" },
      "Private delivery file ready",
    );
  } catch (error) {
    if (deliveryFileCreated) await unlink(file!);
    throw error;
  } finally {
    // Closing an uncommitted PostgreSQL transaction rolls it back on failure.
    await databaseClient.end();
  }
}

try {
  await main();
} catch {
  // Even parser, filesystem, and database errors can include credentials or
  // identifying input. Do not serialize arbitrary exception text or stacks.
  logger.error(
    { event: "synthetic_tester_action_failed" },
    "Check operator safeguards, target, tester ID, and private delivery path; existing credentials are never reset",
  );
  process.exitCode = 1;
}
