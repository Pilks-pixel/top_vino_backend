import {
  mkdirSync,
  realpathSync,
  statSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:https";
import { request as proxyRequest } from "node:http";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// This rehearsal owns disposable synthetic resources; it never accepts live URLs.
const args = process.argv.slice(2);
if (
  args.some(
    (value, i) => i % 2 === 0 && !["--image", "--output"].includes(value),
  )
) {
  console.error(
    "This rehearsal accepts disposable synthetic databases only; use the reviewed live export runbook for Neon.",
  );
  process.exit(1);
}
const options = Object.fromEntries(
  Array.from({ length: args.length / 2 }, (_, i) => [
    args[i * 2],
    args[i * 2 + 1],
  ]),
);
const root = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
let output;
try {
  if (!options["--image"] || !options["--output"] || args.length !== 4)
    throw new Error("Supply --image IMAGE --output PRIVATE_DIRECTORY");
  output = resolve(options["--output"]);
  if (output === root || output.startsWith(root + sep))
    throw new Error("Export artifacts must remain outside the checkout");
  mkdirSync(output, { recursive: true, mode: 0o700 });
  output = realpathSync(output);
  if (output === root || output.startsWith(root + sep))
    throw new Error("Export artifacts must remain outside the checkout");
  if ((statSync(output).mode & 0o077) !== 0)
    throw new Error("Exports require a private directory (chmod 700)");
  if (readdirSync(output).length)
    throw new Error(
      "Use an empty private directory to preserve previous evidence",
    );
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const pgImage =
  "postgres:15@sha256:3b0d656f5fff31c7d8a64f500a703dcf3f35e98ce78f602831a73059a5e6a012";
const image = options["--image"];
const prefix = `vino-portability-${process.pid}-${Date.now()}`;
const network = `${prefix}-network`;
const source = `${prefix}-source`;
const restored = `${prefix}-restored`;
const containers = [];
const gateways = [];
const authFiles = mkdtempSync(resolve(tmpdir(), "vino-portability-auth-"));
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const temporary = mkdtempSync(resolve(tmpdir(), "vino-portability-tls-"));
const adminPassword = randomBytes(24).toString("hex");
const ownerPassword = randomBytes(24).toString("hex");
const runtimePassword = randomBytes(24).toString("hex");
const rotatedPassword = randomBytes(24).toString("hex");
const testerPassword = randomBytes(24).toString("hex");
const restoredTesterPassword = randomBytes(24).toString("hex");
const email = "portability@example.test";
const ownerId = "10000000-0000-4000-8000-000000000001";
const viewerId = "10000000-0000-4000-8000-000000000002";
const deckId = "20000000-0000-4000-8000-000000000001";
const cardId = "30000000-0000-4000-8000-000000000001";
const tables = [
  "Card",
  "Deck",
  "DeckCollaborator",
  "UserCardProgress",
  "UserCardReview",
  "UserResponse",
  "_prisma_migrations",
  "account",
  "session",
  "user",
  "verification",
];
const excluded = ["account", "session", "verification"];
let stage = "image validation";
let networkCreated = false;
function docker(args, extra = {}) {
  try {
    return execFileSync("docker", args, {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
      timeout: 120_000,
      maxBuffer: 16 * 1024 * 1024,
      ...extra,
    });
  } catch {
    throw new Error(
      `Docker operation failed during ${stage}; credentials and command output suppressed`,
    );
  }
}
function sql(container, query) {
  return docker(
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "synthetic_admin",
      "-d",
      "portability",
      "-At",
    ],
    { input: query },
  ).trim();
}
async function waitFor(check, label, timeout = 45_000) {
  const deadline = Date.now() + timeout;
  do {
    if (await check()) return;
    await new Promise(done => setTimeout(done, 250));
  } while (Date.now() < deadline);
  throw new Error(`Timed out during ${label}`);
}
function url(host, role, password) {
  return `postgresql://${role}:${password}@${host}:5432/portability?sslmode=require&sslaccept=strict&sslcert=/tls/ca.crt&connection_limit=5&connect_timeout=5&pool_timeout=10`;
}
function environment(host, role = "runtime_a", password = runtimePassword) {
  return {
    DATABASE_URL: url(host, role, password),
    DIRECT_URL: url(host, "migration_owner", ownerPassword),
    BETTER_AUTH_SECRETS: "1:" + randomBytes(32).toString("hex"),
    BETTER_AUTH_URL: "https://api.example.test",
    FRONTEND_URL: "https://frontend.example.test",
    PORT: "49152",
    NODE_ENV: "production",
    RELEASE_COMMIT: commit,
  };
}
function envArgs(values) {
  return Object.entries(values).flatMap(([key, value]) => [
    "-e",
    `${key}=${value}`,
  ]);
}
const certificateMount = [
  "--mount",
  `type=bind,src=${temporary},dst=/tls,readonly`,
];
const clientCertificateMount = [
  "--mount",
  `type=bind,src=${resolve(temporary, "ca.crt")},dst=/tls/ca.crt,readonly`,
];
function nodeJob(env, code) {
  return docker([
    "run",
    "--rm",
    "--platform",
    "linux/amd64",
    "--network",
    network,
    ...clientCertificateMount,
    ...envArgs(env),
    "--entrypoint",
    "node",
    image,
    "--input-type=module",
    "-e",
    code,
  ]).trim();
}
function grant(container, role) {
  sql(
    container,
    `GRANT CONNECT ON DATABASE portability TO ${role}; GRANT USAGE ON SCHEMA public TO ${role}; GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ${tables
      .filter(table => table !== "_prisma_migrations")
      .map(table => `"${table}"`)
      .join(",")} TO ${role};`,
  );
}
async function database(name, host, runtimeRole, password) {
  containers.push(name);
  docker([
    "run",
    "-d",
    "--name",
    name,
    "--network",
    network,
    "--network-alias",
    host,
    "-e",
    "POSTGRES_USER=synthetic_admin",
    "-e",
    `POSTGRES_PASSWORD=${adminPassword}`,
    "-e",
    "POSTGRES_DB=portability",
    ...certificateMount,
    pgImage,
    "sh",
    "-c",
    "cp /tls/server.key /tmp/server.key && cp /tls/server.crt /tmp/server.crt && chown postgres:postgres /tmp/server.key /tmp/server.crt && chmod 600 /tmp/server.key && exec docker-entrypoint.sh postgres -c ssl=on -c ssl_cert_file=/tmp/server.crt -c ssl_key_file=/tmp/server.key",
  ]);
  await waitFor(() => {
    try {
      sql(name, "SELECT 1;");
      return true;
    } catch {
      return false;
    }
  }, "PostgreSQL bootstrap");
  sql(
    name,
    `CREATE ROLE migration_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${ownerPassword}'; CREATE ROLE ${runtimeRole} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${password}'; ALTER DATABASE portability OWNER TO migration_owner; ALTER SCHEMA public OWNER TO migration_owner; REVOKE CREATE ON SCHEMA public FROM PUBLIC;`,
  );
}
function inventory(container) {
  const counts = Object.fromEntries(
    tables.map(table => [
      table,
      Number(sql(container, `SELECT count(*) FROM "${table}";`)),
    ]),
  );
  const schemas = JSON.parse(
    sql(
      container,
      `SELECT json_agg(nspname ORDER BY nspname) FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname <> 'information_schema';`,
    ),
  );
  const extensions = JSON.parse(
    sql(
      container,
      "SELECT json_agg(row_to_json(e) ORDER BY extname) FROM (SELECT extname, extversion FROM pg_extension) e;",
    ),
  );
  const columns = JSON.parse(
    sql(
      container,
      `SELECT json_agg(row_to_json(c) ORDER BY table_name, logical_position) FROM (SELECT table_name, row_number() OVER (PARTITION BY table_name ORDER BY ordinal_position) AS logical_position, column_name, udt_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public') c;`,
    ),
  );
  const constraints = JSON.parse(
    sql(
      container,
      `SELECT json_agg(row_to_json(c) ORDER BY relation, name) FROM (SELECT conrelid::regclass::text AS relation, conname AS name, pg_get_constraintdef(oid) AS definition, convalidated AS validated FROM pg_constraint WHERE connamespace = 'public'::regnamespace) c;`,
    ),
  );
  const invariants = {
    orphanCards: Number(
      sql(
        container,
        'SELECT count(*) FROM "Card" c LEFT JOIN "Deck" d ON d.id=c."deckId" WHERE d.id IS NULL;',
      ),
    ),
    duplicateCollaborators: Number(
      sql(
        container,
        'SELECT count(*) FROM (SELECT "deckId", "userId" FROM "DeckCollaborator" GROUP BY 1,2 HAVING count(*)>1) duplicates;',
      ),
    ),
    invalidReviewQuality: Number(
      sql(
        container,
        'SELECT count(*) FROM "UserCardReview" WHERE quality<0 OR quality>5;',
      ),
    ),
    invalidProgress: Number(
      sql(
        container,
        'SELECT count(*) FROM "UserCardProgress" WHERE "reviewCount"<0 OR "currentInterval"<1;',
      ),
    ),
    unvalidatedConstraints: Number(
      sql(
        container,
        "SELECT count(*) FROM pg_constraint WHERE connamespace='public'::regnamespace AND NOT convalidated;",
      ),
    ),
  };
  for (const value of Object.values(invariants))
    assert.equal(value, 0, "Restored key invariant failed");
  return { schemas, extensions, columns, constraints, counts, invariants };
}
function credential(env, password) {
  nodeJob(
    { ...env, DATABASE_URL: env.DIRECT_URL, TESTER_PASSWORD: password },
    `
    const {PrismaClient}=await import('./generated/prisma/client.js'); const {hashPassword}=await import('better-auth/crypto');
    const p=new PrismaClient(); const {randomUUID}=await import('node:crypto');
    await p.account.create({data:{id:randomUUID(),accountId:'${ownerId}',userId:'${ownerId}',providerId:'credential',password:await hashPassword(process.env.TESTER_PASSWORD)}});
    await p.$disconnect();
  `,
  );
}
async function api(name, env) {
  let backend;
  const gateway = createServer(
    {
      key: readFileSync(resolve(temporary, "server.key")),
      cert: readFileSync(resolve(temporary, "server.crt")),
    },
    (request, response) => {
      if (!backend) {
        response.writeHead(503).end();
        return;
      }
      const upstream = proxyRequest(
        backend,
        { method: request.method, path: request.url, headers: request.headers },
        reply => {
          response.writeHead(reply.statusCode, reply.headers);
          reply.pipe(response);
        },
      );
      upstream.on("error", () => response.writeHead(502).end());
      request.pipe(upstream);
    },
  );
  gateways.push(gateway);
  await new Promise((done, reject) => {
    gateway.once("error", reject);
    gateway.listen(0, "127.0.0.1", done);
  });
  const origin = `https://127.0.0.1:${gateway.address().port}`;
  containers.push(name);
  docker([
    "run",
    "-d",
    "--platform",
    "linux/amd64",
    "--name",
    name,
    "--network",
    network,
    "--read-only",
    "--tmpfs",
    "/tmp",
    "-p",
    "127.0.0.1::49152",
    ...clientCertificateMount,
    ...envArgs({ ...env, BETTER_AUTH_URL: origin }),
    image,
  ]);
  const port = JSON.parse(docker(["inspect", name]))[0].NetworkSettings.Ports[
    "49152/tcp"
  ][0].HostPort;
  backend = `http://127.0.0.1:${port}`;
  await waitFor(async () => {
    try {
      return (
        (await fetch(`${backend}/ready`, { signal: AbortSignal.timeout(2000) }))
          .status === 200
      );
    } catch {
      return false;
    }
  }, "migrated candidate readiness");
  return origin;
}
async function smoke(origin, password) {
  const credentials = resolve(
    authFiles,
    randomBytes(8).toString("hex") + ".json",
  );
  writeFileSync(credentials, JSON.stringify({ email, password }), {
    mode: 0o600,
  });
  try {
    const summary = await new Promise((done, reject) => {
      const child = spawn(
        process.execPath,
        [
          resolve(root, "scripts/release-smoke.mjs"),
          "--origin",
          origin,
          "--expected-commit",
          commit,
          "--deck-id",
          deckId,
          "--credentials-file",
          credentials,
        ],
        {
          env: {
            ...process.env,
            NODE_EXTRA_CA_CERTS: resolve(temporary, "ca.crt"),
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let output = "";
      child.stdout.on("data", chunk => {
        output += chunk;
      });
      child.stderr.resume();
      child.on("error", () =>
        reject(new Error("Standard release smoke could not start")),
      );
      child.on("exit", code =>
        code === 0
          ? done(JSON.parse(output))
          : reject(
              new Error(
                "Standard HTTPS release smoke failed; private credentials and output suppressed",
              ),
            ),
      );
    });
    assert.equal(summary.event, "release_smoke_passed");
    assert.equal(summary.commit, commit);
    return {
      standardHttpsSmoke: true,
      commit: summary.commit,
      logsReview: summary.logsReview,
    };
  } finally {
    rmSync(credentials, { force: true });
  }
}
const started = Date.now();
try {
  const imageMetadata = JSON.parse(docker(["image", "inspect", image]))[0];
  assert.equal(imageMetadata.Architecture, "amd64");
  assert.equal(imageMetadata.Config.User, "node");
  assert.deepEqual(imageMetadata.Config.Entrypoint, [
    "/app/release/entrypoint.sh",
  ]);
  stage = "ephemeral TLS setup";
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      resolve(temporary, "ca.key"),
      "-out",
      resolve(temporary, "ca.crt"),
      "-days",
      "1",
      "-subj",
      "/CN=Top Vino rehearsal CA",
    ],
    { stdio: "ignore" },
  );
  execFileSync(
    "openssl",
    [
      "req",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      resolve(temporary, "server.key"),
      "-out",
      resolve(temporary, "server.csr"),
      "-subj",
      "/CN=source",
    ],
    { stdio: "ignore" },
  );
  writeFileSync(
    resolve(temporary, "extensions"),
    "basicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:source,DNS:restore,DNS:localhost,IP:127.0.0.1\n",
  );
  execFileSync(
    "openssl",
    [
      "x509",
      "-req",
      "-in",
      resolve(temporary, "server.csr"),
      "-CA",
      resolve(temporary, "ca.crt"),
      "-CAkey",
      resolve(temporary, "ca.key"),
      "-CAcreateserial",
      "-out",
      resolve(temporary, "server.crt"),
      "-days",
      "1",
      "-extfile",
      resolve(temporary, "extensions"),
    ],
    { stdio: "ignore" },
  );
  docker(["network", "create", network]);
  networkCreated = true;
  stage = "empty stock PostgreSQL migration";
  await database(source, "source", "runtime_a", runtimePassword);
  const sourceEnv = environment("source");
  docker([
    "run",
    "--rm",
    "--platform",
    "linux/amd64",
    "--network",
    network,
    ...certificateMount,
    ...envArgs(sourceEnv),
    image,
    "node",
    "-e",
    "process.exit(0)",
  ]);
  grant(source, "runtime_a");
  stage = "synthetic fixture creation";
  const directTls = nodeJob(
    { ...sourceEnv, DATABASE_URL: sourceEnv.DIRECT_URL },
    `
    const {PrismaClient}=await import('./generated/prisma/client.js'); const p=new PrismaClient();
    const tls=await p.$queryRawUnsafe('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()'); if(tls[0]?.ssl!==true) throw new Error('TLS required');
    await p.user.createMany({data:[{id:'${ownerId}',email:'${email}',name:'Synthetic owner'},{id:'${viewerId}',email:'viewer@example.test',name:'Synthetic viewer'}]});
    await p.deck.create({data:{id:'${deckId}',userId:'${ownerId}',name:'Synthetic portability Deck',isPublic:true}});
    await p.card.create({data:{id:'${cardId}',deckId:'${deckId}',question:'Synthetic question',correctAnswer:'Synthetic answer',incorrectAnswers:[]}});
    await p.deckCollaborator.create({data:{deckId:'${deckId}',userId:'${viewerId}',role:'VIEWER'}});
    await p.userCardProgress.createMany({data:[{userId:'${ownerId}',cardId:'${cardId}',reviewCount:2,currentInterval:6},{userId:'${viewerId}',cardId:'${cardId}',reviewCount:1,currentInterval:1}]});
    await p.userCardReview.createMany({data:[{userId:'${ownerId}',cardId:'${cardId}',quality:5},{userId:'${viewerId}',cardId:'${cardId}',quality:3}]});
    await p.userResponse.create({data:{userId:'${ownerId}',cardId:'${cardId}',userInput:'Synthetic answer',isCorrect:true}});
    await p.$disconnect(); console.log('TLS verified');
  `,
  );
  assert.equal(directTls, "TLS verified");
  credential(sourceEnv, testerPassword);
  stage = "source API smoke";
  const originalApi = `${prefix}-api-source`;
  const sourceSmoke = await smoke(
    await api(originalApi, sourceEnv),
    testerPassword,
  );
  const runtimeTls = sql(
    source,
    "SELECT bool_and(s.ssl) FROM pg_stat_ssl s JOIN pg_stat_activity a USING(pid) WHERE a.usename='runtime_a' AND a.client_addr IS NOT NULL;",
  );
  assert.equal(runtimeTls, "t");
  let before = inventory(source);
  assert.equal(before.counts.user, 2);
  assert.equal(before.counts.Deck, 1);
  assert.equal(before.counts.Card, 1);
  assert.equal(before.counts.UserCardProgress, 2);
  assert.equal(before.counts.UserCardReview, 2);
  assert.equal(before.counts.account, 1);
  sql(
    source,
    `INSERT INTO session (id,token,"userId","expiresAt","updatedAt") VALUES ('synthetic-export-session','${randomBytes(24).toString("hex")}','${ownerId}',NOW()+interval '1 hour',NOW()); INSERT INTO verification (id,identifier,value,"expiresAt","updatedAt") VALUES ('synthetic-export-verification','${email}','${randomBytes(24).toString("hex")}',NOW()+interval '1 hour',NOW());`,
  );
  before = inventory(source);
  assert.ok(before.counts.session > 0);
  assert.ok(before.counts.verification > 0);
  stage = "sanitized synthetic logical export";
  const dumpStarted = Date.now();
  const dump = docker(
    [
      "exec",
      source,
      "pg_dump",
      "-U",
      "migration_owner",
      "-d",
      "portability",
      "--format=custom",
      "--schema=public",
      "--no-owner",
      "--no-acl",
      "--no-comments",
      ...excluded.map(table => `--exclude-table-data=public.${table}`),
    ],
    { encoding: null },
  );
  const dumpMs = Date.now() - dumpStarted;
  const checksum = createHash("sha256").update(dump).digest("hex");
  const artifact = resolve(output, "synthetic.dump");
  writeFileSync(artifact, dump, { mode: 0o600 });
  assert.equal(
    createHash("sha256").update(readFileSync(artifact)).digest("hex"),
    checksum,
  );
  stage = "stock PostgreSQL restore";
  await database(restored, "restore", "runtime_b", rotatedPassword);
  sql(restored, "DROP SCHEMA public CASCADE;");
  const restoreStarted = Date.now();
  docker(
    [
      "exec",
      "-i",
      restored,
      "pg_restore",
      "-U",
      "migration_owner",
      "-d",
      "portability",
      "--no-owner",
      "--no-acl",
      "--exit-on-error",
      "--single-transaction",
    ],
    { input: readFileSync(artifact) },
  );
  const restoreMs = Date.now() - restoreStarted;
  const after = inventory(restored);
  const expected = structuredClone(before);
  for (const table of excluded) expected.counts[table] = 0;
  assert.deepEqual(
    after,
    expected,
    "Schema, extensions, row counts and invariants must survive sanitized restore",
  );
  const restoredEnv = environment("restore", "runtime_b", rotatedPassword);
  grant(restored, "runtime_b");
  credential(restoredEnv, restoredTesterPassword);
  stage = "restored same-image API smoke";
  const restoredSmoke = await smoke(
    await api(`${prefix}-api-restored`, restoredEnv),
    restoredTesterPassword,
  );
  const restoredTls = sql(
    restored,
    "SELECT bool_and(s.ssl) FROM pg_stat_ssl s JOIN pg_stat_activity a USING(pid) WHERE a.usename='runtime_b' AND a.client_addr IS NOT NULL;",
  );
  assert.equal(restoredTls, "t");
  stage = "source credential rotation without image rebuild";
  docker(["stop", "--time", "10", originalApi]);
  sql(source, `ALTER ROLE runtime_a PASSWORD '${rotatedPassword}';`);
  const rotatedEnv = {
    ...sourceEnv,
    DATABASE_URL: url("source", "runtime_a", rotatedPassword),
  };
  const rotatedSmoke = await smoke(
    await api(`${prefix}-api-rotated`, rotatedEnv),
    testerPassword,
  );
  assert.equal(
    JSON.parse(docker(["image", "inspect", image]))[0].Id,
    imageMetadata.Id,
  );
  const report = {
    version: 1,
    syntheticOnly: true,
    capturedAt: new Date().toISOString(),
    imageId: imageMetadata.Id,
    postgresImage: pgImage,
    postgresVersion: sql(source, "SHOW server_version;"),
    artifact: {
      file: "synthetic.dump",
      sha256: checksum,
      bytes: dump.length,
      dumpMs,
      restoreMs,
    },
    inventory: after,
    sourceSmoke,
    restoredSmoke,
    rotatedSmoke,
    directTls: true,
    runtimeTls: true,
    rotatedWithoutRebuild: true,
    excludedDataTables: excluded,
    actualNeonExport: "pending",
    neonTransactionPool: "pending",
    totalMs: Date.now() - started,
  };
  writeFileSync(
    resolve(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
    { mode: 0o600 },
  );
  writeFileSync(
    resolve(output, "synthetic.dump.sha256"),
    checksum + "  synthetic.dump\n",
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      result: "passed",
      imageId: report.imageId,
      postgresVersion: report.postgresVersion,
      sha256: checksum,
      bytes: dump.length,
      dumpMs,
      restoreMs,
      totalMs: report.totalMs,
      actualNeonExport: "pending",
      neonTransactionPool: "pending",
    }),
  );
} catch (error) {
  console.error(
    `Portability rehearsal failed during ${stage}: ${error.message}`,
  );
  process.exitCode = 1;
} finally {
  for (const gateway of gateways) {
    gateway.closeAllConnections();
    await new Promise(done => gateway.close(done));
  }
  for (const name of containers.reverse()) {
    try {
      docker(["rm", "-f", name]);
    } catch {
      console.error(`Could not remove owned container ${name}`);
      process.exitCode = 1;
    }
  }
  if (networkCreated) {
    try {
      docker(["network", "rm", network]);
    } catch {
      console.error(`Could not remove owned network ${network}`);
      process.exitCode = 1;
    }
  }
  rmSync(temporary, { recursive: true, force: true });
  rmSync(authFiles, { recursive: true, force: true });
}
