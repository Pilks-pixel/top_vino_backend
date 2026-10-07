// Workstation-only; never loads dotenv, runtime Auth, or the API Prisma singleton.
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { createLogger } from "../src/lib/loggerCore.ts";

const logger = createLogger({ environment: "production", logLevel: "info" });
const directUrl = process.env.DIRECT_URL;
delete process.env.DIRECT_URL;

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      "confirm-target": { type: "string" },
      "confirm-destruction": { type: "string" },
      email: { type: "string" },
      "runtime-role": { type: "string" },
    },
    allowPositionals: true,
  });
  const action = positionals[0];
  if (
    positionals.length !== 1 ||
    !["seed", "reset", "status"].includes(action) ||
    process.env.SANDBOX_DATA_TOOLS_ENABLED !== "true" ||
    process.env.RENDER === "true" ||
    process.env.CI === "true" ||
    !directUrl
  )
    throw new Error("Operator safeguards");
  const database = new URL(directUrl);
  const target = `${database.host}${database.pathname}`;
  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !database.hostname ||
    !database.port ||
    database.pathname.length <= 1 ||
    database.hash ||
    [...database.searchParams.keys()].some(
      key => database.searchParams.getAll(key).length !== 1,
    ) ||
    !database.username ||
    !database.password ||
    [
      "host",
      "port",
      "dbname",
      "database",
      "user",
      "password",
      "options",
      "service",
    ].some(key => database.searchParams.has(key)) ||
    (database.searchParams.has("schema") &&
      database.searchParams.get("schema") !== "public") ||
    database.searchParams.get("pgbouncer") === "true" ||
    process.env.SANDBOX_DATABASE_TARGET !== target ||
    values["confirm-target"] !== target
  )
    throw new Error("Sandbox target confirmation");
  if (action === "reset" && values["confirm-destruction"] !== `ERASE ${target}`)
    throw new Error("Destructive confirmation");
  if (
    action !== "status" &&
    (!values.email ||
      !/^[a-z0-9][a-z0-9._-]{0,63}@example\.test$/.test(values.email))
  )
    throw new Error("Synthetic tester required");
  const { default: pg } = await import("pg");
  const client = new pg.Client({
    connectionString: directUrl,
    connectionTimeoutMillis: 15000,
    options: "-c search_path=public",
  });
  client.on("error", () => {
    logger.error(
      { event: "sandbox_data_connection_failure" },
      "Operator connection failed",
    );
    process.exitCode = 1;
  });
  await client.connect();
  try {
    if (action === "status") {
      const result = await client.query(
        'SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count FROM "_prisma_migrations" ORDER BY started_at',
      );
      logger.info(
        { event: "sandbox_migration_status", migrations: result.rows },
        "Inspect incomplete migrations before retry; no automatic resolution",
      );
      return;
    }
    // An existing independently provisioned tester is mandatory. Reset preserves
    // that tester's credential hash privately in memory; never emits a password.
    const user = (
      await client.query('SELECT * FROM "user" WHERE email=$1', [values.email])
    ).rows[0];
    if (!user) throw new Error("Provision tester first");
    if (action === "reset") {
      const role = values["runtime-role"];
      if (!role || !/^[a-z_][a-z0-9_]{0,62}$/.test(role))
        throw new Error("Runtime role required");
      const runtime = (
        await client.query(
          "SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolcanlogin, has_database_privilege(rolname,current_database(),'CREATE') AS database_create FROM pg_roles WHERE rolname=$1",
          [role],
        )
      ).rows[0];
      if (
        !runtime ||
        runtime.rolsuper ||
        runtime.rolcreatedb ||
        runtime.rolcreaterole ||
        runtime.rolreplication ||
        runtime.rolbypassrls ||
        runtime.database_create ||
        !runtime.rolcanlogin ||
        role === decodeURIComponent(database.username)
      )
        throw new Error("Least privilege runtime required");
      const memberships = (
        await client.query(
          "SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=$1)",
          [role],
        )
      ).rowCount;
      if (memberships) throw new Error("Runtime role membership refused");
      const accounts = (
        await client.query(
          'SELECT * FROM "account" WHERE "userId"=$1 AND "providerId"=$2',
          [user.id, "credential"],
        )
      ).rows;
      if (accounts.length !== 1)
        throw new Error("Provisioned credential account required");
      await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
      const { spawnSync } = await import("node:child_process");
      const result = spawnSync(
        process.execPath,
        [
          "node_modules/prisma/build/index.js",
          "migrate",
          "deploy",
          "--schema",
          "prisma/schema.prisma",
        ],
        { env: { ...process.env, DATABASE_URL: directUrl }, encoding: "utf8" },
      );
      if (result.status !== 0)
        throw new Error("Replay failed; inspect migration status");
      await client.query("BEGIN");
      const restore = async (table, row) => {
        const columns = Object.keys(row);
        await client.query(
          `INSERT INTO "${table}" (${columns.map(column => `"${column}"`).join(",")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(",")})`,
          Object.values(row),
        );
      };
      await restore("user", user);
      await restore("account", accounts[0]);
      await client.query("COMMIT");
      // No schema CREATE, ownership, DDL, role management, or migration-table access.
      await client.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
      await client.query(`GRANT USAGE ON SCHEMA public TO "${role}"`);
      const tables = [
        "user",
        "account",
        "session",
        "verification",
        "Deck",
        "Card",
        "DeckCollaborator",
        "UserCardProgress",
        "UserResponse",
        "UserCardReview",
      ];
      await client.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ${tables.map(table => `"${table}"`).join(",")} TO "${role}"`,
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${role}"`,
      );
    }
    const id = suffix => {
      const hash = createHash("sha256")
        .update(`top-vino-synthetic-v1:${values.email}:${suffix}`)
        .digest("hex");
      return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    };
    const deckId = id("deck");
    const cards = [
      [
        "tannins",
        "What are tannins in wine?",
        "Natural polyphenols that give wine its drying grip.",
      ],
      ["barolo", "Which grape variety is used to make Barolo?", "Nebbiolo"],
      [
        "malolactic",
        "What does malolactic fermentation convert?",
        "Malic acid into lactic acid.",
      ],
    ];
    await client.query("BEGIN");
    const existingDeck = (
      await client.query('SELECT "userId" FROM "Deck" WHERE id=$1 FOR UPDATE', [
        deckId,
      ])
    ).rows[0];
    if (existingDeck && existingDeck.userId !== user.id)
      throw new Error("Canonical Deck ownership conflict");
    for (const [key] of cards) {
      const card = (
        await client.query(
          'SELECT "deckId" FROM "Card" WHERE id=$1 FOR UPDATE',
          [id(key)],
        )
      ).rows[0];
      if (card && card.deckId !== deckId)
        throw new Error("Canonical Card ownership conflict");
    }
    await client.query(
      'INSERT INTO "Deck" (id,"userId",name,topic,"updatedAt") VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP) ON CONFLICT (id) DO NOTHING',
      [deckId, user.id, "Wine Fundamentals", "wine"],
    );
    const reconciledDeck = (
      await client.query('SELECT "userId" FROM "Deck" WHERE id=$1 FOR UPDATE', [
        deckId,
      ])
    ).rows[0];
    if (reconciledDeck.userId !== user.id)
      throw new Error("Canonical Deck ownership conflict");
    for (const [key, question, answer] of cards) {
      await client.query(
        'INSERT INTO "Card" (id,"deckId",question,"correctAnswer","incorrectAnswers","updatedAt") VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP) ON CONFLICT (id) DO NOTHING',
        [id(key), deckId, question, answer, []],
      );
    }
    await client.query("COMMIT");
    logger.info(
      {
        event:
          action === "reset"
            ? "sandbox_reset_completed"
            : "sandbox_seed_completed",
      },
      "Missing synthetic fixtures created; existing fixtures preserved",
    );
  } finally {
    await client.end();
  }
}

try {
  await main();
} catch {
  logger.error(
    { event: "sandbox_data_action_failed" },
    "Verify workstation opt-in, independently verified disposable target, provisioned tester and confirmation. Inspect migration status after replay failure; no automatic repair.",
  );
  process.exitCode = 1;
}
