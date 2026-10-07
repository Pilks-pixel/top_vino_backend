// Operator-visible CLI behavior against a private disposable PostgreSQL instance.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import pg from "pg";

const name = `top-vino-data-${process.pid}-${Date.now()}`;
const docker = args =>
  execFileSync("docker", args, { encoding: "utf8", stdio: "pipe" }).trim();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let client;
try {
  docker([
    "run",
    "-d",
    "--name",
    name,
    "-e",
    "POSTGRES_PASSWORD=synthetic-owner-password",
    "-p",
    "127.0.0.1::5432",
    "postgres:15@sha256:3b0d656f5fff31c7d8a64f500a703dcf3f35e98ce78f602831a73059a5e6a012",
  ]);
  const port = JSON.parse(docker(["inspect", name]))[0].NetworkSettings.Ports[
    "5432/tcp"
  ][0].HostPort;
  const url = `postgresql://postgres:synthetic-owner-password@127.0.0.1:${port}/postgres`;
  const target = `127.0.0.1:${port}/postgres`;
  for (let count = 0; count < 100; count++) {
    try {
      docker(["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]);
      break;
    } catch {
      await delay(200);
    }
  }
  client = new pg.Client({ connectionString: url });
  await client.connect();
  // Only this harness's private PostgreSQL children emulate a workstation.
  // Production guards remain exercised below with real CI/Render settings.
  const environment = {
    ...process.env,
    CI: "false",
    RENDER: "false",
    DIRECT_URL: url,
    SANDBOX_DATA_TOOLS_ENABLED: "true",
    SANDBOX_DATABASE_TARGET: target,
  };
  const command = (action, args = [], env = environment) =>
    spawnSync(
      process.execPath,
      [
        "scripts/sandbox-data.mjs",
        action,
        "--confirm-target",
        target,
        ...(["seed", "reset"].includes(action)
          ? ["--email", "fixture@example.test"]
          : []),
        ...args,
      ],
      { env, encoding: "utf8" },
    );
  for (const guard of [
    { CI: "true" },
    { RENDER: "true" },
    { SANDBOX_DATA_TOOLS_ENABLED: "false" },
    { SANDBOX_DATABASE_TARGET: "wrong-target" },
  ]) {
    const denied = command("migrate", [], { ...environment, ...guard });
    assert.notEqual(
      denied.status,
      0,
      "migrate guards must fail closed before schema changes",
    );
    assert.equal(
      (
        await client.query(
          "SELECT to_regclass('public._prisma_migrations') AS history",
        )
      ).rows[0].history,
      null,
    );
  }
  let result = command("migrate");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(
    !(result.stdout + result.stderr).includes("synthetic-owner-password"),
  );
  assert.ok(
    !result.stdout.includes("Datasource"),
    "raw Prisma output must never be forwarded",
  );
  const migrations = (
    await client.query(
      "SELECT migration_name FROM _prisma_migrations ORDER BY migration_name",
    )
  ).rows;
  result = command("migrate");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(
    (
      await client.query(
        "SELECT migration_name FROM _prisma_migrations ORDER BY migration_name",
      )
    ).rows,
    migrations,
  );
  await client.query(
    `INSERT INTO "user" (id,email,"updatedAt") VALUES ('synthetic-owner','fixture@example.test',CURRENT_TIMESTAMP)`,
  );
  console.log(
    "Guarded workstation migrations succeed and repeat without fixtures; real CI/Render execution is refused.",
  );
  result = command("seed");
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const before = await client.query('SELECT id, name FROM "Deck"');
  assert.equal(before.rowCount, 1);
  assert.equal((await client.query('SELECT id FROM "Card"')).rowCount, 3);
  await client.query('UPDATE "Deck" SET name=$1 WHERE id=$2', [
    "Tester edited Deck",
    before.rows[0].id,
  ]);
  await client.query(
    'INSERT INTO "Deck" (id,"userId",name,"updatedAt") VALUES ($1,$2,$3,CURRENT_TIMESTAMP)',
    ["user-created", "synthetic-owner", "User-created Deck"],
  );
  result = command("seed");
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.deepEqual(
    (await client.query('SELECT name FROM "Deck" ORDER BY name')).rows,
    [{ name: "Tester edited Deck" }, { name: "User-created Deck" }],
  );
  assert.equal((await client.query('SELECT id FROM "Card"')).rowCount, 3);
  console.log(
    "Seed creates missing canonical Cards and preserves edited/user-created Decks.",
  );
  await client.query(
    `INSERT INTO _prisma_migrations (id,checksum,migration_name,started_at,logs) VALUES ('00000000-0000-4000-8000-000000000001','synthetic-checksum','20990101000000_interrupted',CURRENT_TIMESTAMP,'private-migration-log-sentinel')`,
  );
  result = command("status");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const status = JSON.parse(result.stdout.trim());
  const incomplete = status.migrations.find(
    row => row.migration_name === "20990101000000_interrupted",
  );
  assert.equal(incomplete.finished_at, null);
  assert.equal(incomplete.rolled_back_at, null);
  assert.ok(!result.stdout.includes("private-migration-log-sentinel"));
  assert.equal(
    (await client.query('SELECT id FROM "Deck"')).rowCount,
    2,
    "diagnosis does not repair or reset",
  );
  result = command("migrate");
  assert.notEqual(
    result.status,
    0,
    "unfinished migration must block owner migration without automatic repair",
  );
  assert.ok(result.stdout.includes('"prismaCode":"P3009"'));
  assert.ok(!result.stdout.includes("private-migration-log-sentinel"));
  assert.equal(
    (
      await client.query(
        "SELECT rolled_back_at FROM _prisma_migrations WHERE migration_name='20990101000000_interrupted'",
      )
    ).rows[0].rolled_back_at,
    null,
  );
  console.log(
    "Operator status diagnoses interrupted migrations without exposing raw logs or modifying data.",
  );
  await client.query(
    `CREATE ROLE sandbox_runtime LOGIN PASSWORD 'synthetic-runtime-password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT; INSERT INTO "account" (id,"accountId","providerId","userId",password,"updatedAt") VALUES ('synthetic-account','synthetic-owner','credential','synthetic-owner','synthetic-hash',CURRENT_TIMESTAMP)`,
  );
  for (const [args, overrides] of [
    [[], {}],
    [["--confirm-destruction", `ERASE ${target}`], {}],
    [
      [
        "--confirm-destruction",
        `ERASE ${target}`,
        "--runtime-role",
        "postgres",
      ],
      {},
    ],
    [
      [
        "--confirm-destruction",
        `ERASE ${target}`,
        "--runtime-role",
        "sandbox_runtime",
      ],
      { SANDBOX_DATABASE_TARGET: "wrong-target" },
    ],
    [
      [
        "--confirm-destruction",
        `ERASE ${target}`,
        "--runtime-role",
        "sandbox_runtime",
      ],
      { SANDBOX_DATA_TOOLS_ENABLED: "false" },
    ],
  ]) {
    result = command("reset", args, { ...environment, ...overrides });
    assert.notEqual(result.status, 0, "reset safeguards must fail closed");
    assert.equal(
      (await client.query('SELECT id FROM "Deck"')).rowCount,
      2,
      "guard must preserve database",
    );
    assert.ok(
      !(result.stdout + result.stderr).includes("synthetic-owner-password"),
    );
  }
  result = command("reset", [
    "--confirm-destruction",
    `ERASE ${target}`,
    "--runtime-role",
    "sandbox_runtime",
  ]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal((await client.query('SELECT id FROM "Deck"')).rowCount, 1);
  assert.equal((await client.query('SELECT id FROM "Card"')).rowCount, 3);
  assert.equal(
    (await client.query("SELECT password FROM account")).rows[0].password,
    "synthetic-hash",
  );
  const runtime = new pg.Client({
    connectionString: url.replace(
      "postgres:synthetic-owner-password",
      "sandbox_runtime:synthetic-runtime-password",
    ),
  });
  await runtime.connect();
  try {
    assert.equal((await runtime.query('SELECT id FROM "Card"')).rowCount, 3);
    await assert.rejects(
      runtime.query("CREATE TABLE forbidden (id integer)"),
      error => error.code === "42501",
    );
    await assert.rejects(
      runtime.query("SELECT * FROM _prisma_migrations"),
      error => error.code === "42501",
    );
  } finally {
    await runtime.end();
  }
  console.log(
    "Reset guards preserve data; confirmed replay restores fixtures and least-privilege runtime grants.",
  );
} finally {
  await client?.end();
  try {
    docker(["rm", "-f", name]);
  } catch {
    /* already absent */
  }
}
