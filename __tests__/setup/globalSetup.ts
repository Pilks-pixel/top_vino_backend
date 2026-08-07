/**
 * Jest Global Setup
 *
 * Runs ONCE before all test suites.
 * - Ensures TEST database exists (creates it if missing)
 * - Runs prisma migrate deploy against the test database
 */
import { execSync } from "child_process";
import * as dotenv from "dotenv";
import pg from "pg";

const { Client } = pg;

export default async function globalSetup() {
  // Load test env
  dotenv.config({ path: ".env.test" });

  const TEST_DB = "top_vino_test";
  const configuredDatabaseUrl = process.env.DATABASE_URL;
  if (!configuredDatabaseUrl) {
    throw new Error(
      "[globalSetup] DATABASE_URL must be set to connect to PostgreSQL.",
    );
  }

  const adminDatabaseUrl = new URL(configuredDatabaseUrl);
  adminDatabaseUrl.pathname = "/postgres";
  const testDatabaseUrl = new URL(configuredDatabaseUrl);
  testDatabaseUrl.pathname = `/${TEST_DB}`;

  // 1. Create test database if it doesn't exist
  const client = new Client({ connectionString: adminDatabaseUrl.toString() });
  try {
    await client.connect();
  } catch (err) {
    throw new Error(
      "[globalSetup] Cannot connect to PostgreSQL. Is the database running?\n" +
        "  Start it with: docker compose up -d postgres\n" +
        `  Original error: ${(err as Error).message}`,
    );
  }

  const result = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [TEST_DB],
  );

  if (result.rowCount === 0) {
    // Need to use template0 to avoid encoding issues
    await client.query(`CREATE DATABASE ${TEST_DB} TEMPLATE template0`);
    console.log(`[globalSetup] Created test database: ${TEST_DB}`);
  } else {
    console.log(`[globalSetup] Test database already exists: ${TEST_DB}`);
  }

  await client.end();

  // 2. Run migrations against test database
  console.log("[globalSetup] Running migrations...");
  execSync("npx prisma migrate deploy", {
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl.toString(),
    },
    stdio: "inherit",
  });

  console.log("[globalSetup] Migrations complete.");
}
