// Exercises the deployable artifact using disposable, synthetic resources only.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const prefix = `top-vino-image-${process.pid}-${Date.now()}`;
const image = `${prefix}:runtime`;
const builder = `${prefix}:build`;
const network = `${prefix}-network`;
const database = `${prefix}-postgres`;
const containers = [];
const temporary = mkdtempSync(resolve(tmpdir(), "top-vino-image-"));
const env = {
  DATABASE_URL: `postgresql://synthetic:synthetic-password@${database}:5432/synthetic?connect_timeout=1&pool_timeout=1`,
  BETTER_AUTH_SECRET: "synthetic-image-test-secret-with-at-least-32-characters",
  BETTER_AUTH_URL: "https://api.example.test",
  FRONTEND_URL: "https://frontend.example.test",
  PORT: "49152",
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function docker(args, options = {}) {
  const output = execFileSync("docker", args, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });
  return output?.trim() ?? "";
}
function inspect(name) {
  return JSON.parse(docker(["inspect", name]))[0];
}
function run(name, environment = env, options = [], command = []) {
  containers.push(name);
  docker([
    "run",
    "-d",
    "--platform",
    "linux/amd64",
    "--name",
    name,
    "--read-only",
    "--tmpfs",
    "/tmp",
    ...options,
    ...Object.entries(environment).flatMap(([key, value]) => [
      "-e",
      `${key}=${value}`,
    ]),
    image,
    ...command,
  ]);
  return name;
}
async function waitFor(check, description, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  do {
    if (await check()) return;
    await delay(200);
  } while (Date.now() < deadline);
  throw new Error(`Timed out: ${description}`);
}
async function exited(name, expectedCode, timeout = 10_000) {
  await waitFor(() => !inspect(name).State.Running, `${name} exit`, timeout);
  assert.equal(inspect(name).State.ExitCode, expectedCode);
}
function probe(name, path) {
  return JSON.parse(
    docker([
      "exec",
      name,
      "node",
      "--input-type=module",
      "-e",
      `const r = await fetch('http://127.0.0.1:49152${path}', {signal: AbortSignal.timeout(5000)}); console.log(JSON.stringify({status:r.status,body:await r.json()}));`,
    ]),
  );
}
async function healthy(name) {
  await waitFor(() => {
    if (!inspect(name).State.Running)
      throw new Error(`API failed to boot: ${docker(["logs", name])}`);
    try {
      return probe(name, "/health").status === 200;
    } catch {
      return false;
    }
  }, "API liveness");
}
function events(name) {
  return docker(["logs", name])
    .split("\n")
    .filter(Boolean)
    .map(line => JSON.parse(line));
}
async function shutdown(name, signal) {
  const start = Date.now();
  docker(["kill", `--signal=${signal}`, name]);
  await exited(name, 0);
  assert.ok(Date.now() - start < 10_000, "shutdown exceeds ten seconds");
  const logs = events(name);
  assert.equal(logs.filter(log => log.event === "shutdown_started").length, 1);
  assert.ok(logs.some(log => log.event === "database_disconnected"));
}

try {
  console.log(
    "Building locked Linux AMD64 production image without runtime secrets...",
  );
  docker(
    [
      "build",
      "--platform",
      "linux/amd64",
      "--target",
      "runtime",
      "-t",
      image,
      ".",
    ],
    { stdio: "inherit", timeout: 900_000 },
  );
  docker(
    [
      "build",
      "--platform",
      "linux/amd64",
      "--target",
      "build",
      "-t",
      builder,
      ".",
    ],
    { stdio: "inherit", timeout: 900_000 },
  );
  const metadata = JSON.parse(docker(["image", "inspect", image]))[0];
  assert.equal(metadata.Architecture, "amd64");
  assert.equal(metadata.Os, "linux");
  assert.equal(metadata.Config.User, "node");
  assert.deepEqual(metadata.Config.Cmd, ["node", "dist/server.js"]);
  assert.ok(!metadata.Config.Entrypoint?.length);
  assert.equal(metadata.Config.StopSignal, "SIGTERM");
  assert.equal(metadata.Config.Healthcheck.Interval, 30_000_000_000);
  assert.equal(metadata.Config.Healthcheck.Timeout, 5_000_000_000);
  assert.equal(metadata.Config.Healthcheck.StartPeriod, 10_000_000_000);
  assert.equal(metadata.Config.Healthcheck.Retries, 3);
  docker([
    "run",
    "--rm",
    "--platform",
    "linux/amd64",
    "--network",
    "none",
    image,
    "node",
    "--input-type=module",
    "-e",
    `
    import assert from 'node:assert/strict'; import fs from 'node:fs';
    assert.notEqual(process.getuid(), 0);
    assert.equal(process.version, 'v24.20.0');
    assert.deepEqual(fs.readdirSync('.').sort(), ['dist','generated','node_modules','package-lock.json','package.json']);
    for (const path of ['src','__tests__','.env','.env.test','.git','docs','dist/scripts','node_modules/prisma','node_modules/typescript','node_modules/jest','node_modules/eslint','node_modules/ts-jest','node_modules/husky','node_modules/pino-pretty']) assert.ok(!fs.existsSync(path), path);
    const walk = dir => fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(dir+'/'+e.name) : [dir+'/'+e.name]);
    assert.ok(walk('dist').every(path => path.endsWith('.js')));
    assert.ok(fs.existsSync('generated/prisma/libquery_engine-debian-openssl-3.0.x.so.node'));
  `,
  ]);

  console.log(
    "Checking offline startup, fail-closed configuration, and sanitized failures...",
  );
  const offline = run(`${prefix}-offline`, env, ["--network", "none"]);
  await healthy(offline);
  assert.equal(probe(offline, "/ready").status, 503);
  await shutdown(offline, "SIGTERM");
  for (const [key, value] of [
    ["DATABASE_URL", ""],
    ["PORT", "private-invalid-port"],
    ["BETTER_AUTH_SECRET", "private-short-secret"],
    ["BETTER_AUTH_URL", "private-invalid-url"],
    ["FRONTEND_URL", ""],
    ["LOG_LEVEL", "private-invalid-level"],
    ["GOOGLE_CLIENT_ID", "private-partial-oauth"],
  ]) {
    const name = run(
      `${prefix}-invalid-${key.toLowerCase()}`,
      { ...env, [key]: value },
      ["--network", "none"],
    );
    await exited(name, 1);
    const output = docker(["logs", name]);
    assert.ok(!output.includes("private-"), "configuration value leaked");
    assert.ok(events(name).some(log => log.event === "startup_failure"));
  }
  const malformedDatabase = run(
    `${prefix}-malformed-database`,
    {
      ...env,
      DATABASE_URL:
        "postgresql://user:private-password@localhost/db?connection_limit=private-invalid-option",
    },
    ["--network", "none"],
  );
  await exited(malformedDatabase, 1);
  assert.ok(!docker(["logs", malformedDatabase]).includes("private-"));
  assert.ok(
    events(malformedDatabase).some(log => log.event === "startup_failure"),
  );

  console.log("Migrating temporary PostgreSQL outside the production image...");
  docker(["network", "create", network]);
  containers.push(database);
  docker([
    "run",
    "-d",
    "--name",
    database,
    "--network",
    network,
    "-e",
    "POSTGRES_USER=synthetic",
    "-e",
    "POSTGRES_PASSWORD=synthetic-password",
    "-e",
    "POSTGRES_DB=synthetic",
    "postgres:15",
  ]);
  await waitFor(() => {
    try {
      docker([
        "exec",
        database,
        "pg_isready",
        "-U",
        "synthetic",
        "-d",
        "synthetic",
      ]);
      return true;
    } catch {
      return false;
    }
  }, "PostgreSQL");
  docker(
    [
      "run",
      "--rm",
      "--platform",
      "linux/amd64",
      "--network",
      network,
      "-e",
      `DATABASE_URL=${env.DATABASE_URL}`,
      "--mount",
      `type=bind,src=${resolve(root, "prisma/migrations")},dst=/app/prisma/migrations,readonly`,
      builder,
      "./node_modules/.bin/prisma",
      "migrate",
      "deploy",
    ],
    { stdio: "inherit" },
  );
  // Provision a synthetic tester via Better Auth's server API, outside runtime HTTP.
  docker([
    "run",
    "--rm",
    "--platform",
    "linux/amd64",
    "--network",
    network,
    ...Object.entries({ ...env, NODE_ENV: "production" }).flatMap(
      ([key, value]) => ["-e", `${key}=${value}`],
    ),
    builder,
    "node",
    "--input-type=module",
    "-e",
    `
      const {auth} = await import('./dist/lib/auth.js');
      await auth.api.signUpEmail({body:{name:'Image Tester',email:'image@example.test',password:'synthetic-tester-password'}});
      const {default:prisma} = await import('./dist/lib/prisma.js'); await prisma.$disconnect();
    `,
  ]);
  const api = run(`${prefix}-api`, env, [
    "--network",
    network,
    "-p",
    "127.0.0.1::49152",
  ]);
  await healthy(api);
  const port = inspect(api).NetworkSettings.Ports["49152/tcp"][0].HostPort;
  const address = `http://127.0.0.1:${port}`;
  assert.equal(
    (await fetch(`${address}/health`)).status,
    200,
    "port must bind on all interfaces",
  );
  assert.deepEqual(probe(api, "/ready"), {
    status: 200,
    body: { status: "ready" },
  });
  const login = await fetch(`${address}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: env.BETTER_AUTH_URL,
    },
    body: JSON.stringify({
      email: "image@example.test",
      password: "synthetic-tester-password",
    }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers
    .getSetCookie()
    .map(value => value.split(";", 1)[0])
    .join("; ");
  assert.ok(cookie);
  const profile = await fetch(`${address}/user/me`, { headers: { cookie } });
  assert.equal(profile.status, 200);
  assert.equal((await profile.json()).data.email, "image@example.test");
  await waitFor(
    () => inspect(api).State.Health?.Status === "healthy",
    "Docker healthcheck",
    45_000,
  );
  // Keep an actual HTTP body in flight while termination begins.
  const pending = httpRequest(`${address}/unknown`, {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": "2" },
  });
  const finished = new Promise((resolve, reject) => {
    pending.on("response", response => {
      response.resume();
      response.on("end", () => resolve(response.statusCode));
    });
    pending.on("error", reject);
  });
  pending.write("{");
  await delay(200);
  const started = Date.now();
  docker(["kill", "--signal=SIGTERM", api]);
  await waitFor(
    () => events(api).some(log => log.event === "shutdown_started"),
    "shutdown start",
  );
  docker(["kill", "--signal=SIGINT", api]);
  assert.equal(
    inspect(api).State.Running,
    true,
    "in-flight request must finish",
  );
  pending.end("}");
  assert.equal(await finished, 404);
  await exited(api, 0);
  assert.ok(Date.now() - started < 10_000);
  const gracefulLogs = events(api);
  assert.equal(
    gracefulLogs.filter(log => log.event === "shutdown_started").length,
    1,
  );
  assert.ok(gracefulLogs.some(log => log.event === "database_disconnected"));
  assert.ok(gracefulLogs.some(log => log.event === "shutdown_already_started"));
  const interrupt = run(`${prefix}-interrupt`, env, ["--network", network]);
  await healthy(interrupt);
  assert.equal(probe(interrupt, "/ready").status, 200);
  await shutdown(interrupt, "SIGINT");

  const unavailable = run(`${prefix}-unavailable`, env, ["--network", network]);
  await healthy(unavailable);
  assert.equal(probe(unavailable, "/ready").status, 200);
  docker(["stop", database]);
  assert.equal(probe(unavailable, "/ready").status, 503);
  assert.equal(probe(unavailable, "/health").status, 200);
  await shutdown(unavailable, "SIGTERM");

  console.log("Checking repeated signals and shutdown failure deadlines...");
  // Faults enter at the OS/HTTP/database boundary without adding runtime test hooks.
  const hook = resolve(temporary, "shutdown-fault.mjs");
  writeFileSync(
    hook,
    `
    import {Server} from 'node:http';
    if (process.env.SHUTDOWN_FAULT === 'close') Server.prototype.close = function(callback) { queueMicrotask(() => callback(new Error('synthetic close failure'))); return this; };
    if (process.env.SHUTDOWN_FAULT === 'timeout') Server.prototype.close = function() { return this; };
    if (process.env.SHUTDOWN_FAULT === 'disconnect') {
      const {PrismaClient} = await import('/app/generated/prisma/client.js');
      PrismaClient.prototype.$disconnect = async function() { throw new Error('synthetic disconnect failure'); };
    }
    if (process.env.SHUTDOWN_FAULT === 'disconnect-timeout') {
      const {PrismaClient} = await import('/app/generated/prisma/client.js');
      PrismaClient.prototype.$disconnect = async function() { await new Promise(() => {}); };
    }
  `,
  );
  for (const [fault, event] of [
    ["close", "http_server_close_failure"],
    ["disconnect", "database_disconnect_failure"],
    ["timeout", "shutdown_timeout"],
    ["disconnect-timeout", "shutdown_timeout"],
  ]) {
    const name = run(
      `${prefix}-fault-${fault}`,
      { ...env, SHUTDOWN_FAULT: fault },
      [
        "--network",
        "none",
        "--mount",
        `type=bind,src=${hook},dst=/tmp/shutdown-fault.mjs,readonly`,
      ],
      ["node", "--import", "/tmp/shutdown-fault.mjs", "dist/server.js"],
    );
    await healthy(name);
    docker(["kill", "--signal=SIGTERM", name]);
    if (fault === "timeout") docker(["kill", "--signal=SIGINT", name]);
    await exited(name, 1, 12_000);
    const logs = events(name);
    assert.equal(
      logs.filter(log => log.event === "shutdown_started").length,
      1,
    );
    assert.ok(logs.some(log => log.event === event));
    if (fault === "timeout") {
      assert.ok(logs.some(log => log.event === "shutdown_already_started"));
    }
    if (event === "shutdown_timeout") {
      const started = logs.find(log => log.event === "shutdown_started");
      const timedOut = logs.find(log => log.event === "shutdown_timeout");
      const elapsed = Date.parse(timedOut.time) - Date.parse(started.time);
      assert.ok(
        elapsed >= 9_900 && elapsed < 10_500,
        "hard deadline was not enforced",
      );
      const finished = Date.parse(inspect(name).State.FinishedAt);
      assert.ok(
        finished - Date.parse(started.time) < 11_000,
        "timeout did not terminate the process",
      );
    }
  }
  console.log("Production image acceptance passed.");
} finally {
  for (const name of containers.reverse()) {
    try {
      docker(["rm", "-f", name], { stdio: "ignore" });
    } catch {
      /* already absent */
    }
  }
  try {
    docker(["network", "rm", network], { stdio: "ignore" });
  } catch {
    /* not created */
  }
  try {
    docker(["image", "rm", image, builder], { stdio: "ignore" });
  } catch {
    /* build failed */
  }
  rmSync(temporary, { recursive: true, force: true });
}
