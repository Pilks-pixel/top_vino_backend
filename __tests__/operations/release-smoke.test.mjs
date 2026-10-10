import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execute = promisify(execFile);
const commit = "a".repeat(40);
const deckId = "c3696e5c-3194-48b0-8249-023c1d8a007e";
const password = "private-smoke-password";
const session = "private-smoke-session";

async function fixture(t, overrides = {}) {
  const directory = await mkdtemp(join(tmpdir(), "top-vino-smoke-"));
  const credentials = join(directory, "tester.json");
  await writeFile(
    credentials,
    JSON.stringify({ email: "release@example.test", password }),
    { mode: 0o600 },
  );
  const calls = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    calls.push({
      method: req.method,
      path: req.url,
      cookie: req.headers.cookie,
      origin: req.headers.origin,
      body: Buffer.concat(chunks).toString(),
    });
    const response = overrides[req.url];
    res.setHeader("X-Release-Commit", commit);
    if (response) return response(req, res);
    if (req.url === "/" || req.url === "/docs") {
      res.setHeader("Content-Type", "text/html");
      res.end("<html>Top Vino API reference; Disposable sandbox</html>");
    } else if (req.url === "/health") res.end(JSON.stringify({ status: "ok" }));
    else if (req.url === "/ready") res.end(JSON.stringify({ status: "ready" }));
    else if (req.url === "/openapi.json")
      res.end(
        JSON.stringify({ openapi: "3.1.0", paths: { "/deck/{id}": {} } }),
      );
    else if (req.url === "/api/auth/open-api/generate-schema")
      res.end(
        JSON.stringify({
          openapi: "3.1.1",
          info: { title: "Better Auth capability reference" },
          paths: {},
        }),
      );
    else if (req.url === "/api/auth/sign-in/email") {
      res.setHeader(
        "Set-Cookie",
        `__Secure-better-auth.session_token=${session}; Secure; HttpOnly; SameSite=Lax`,
      );
      res.end(JSON.stringify({ user: { email: "release@example.test" } }));
    } else if (req.url === `/deck/${deckId}`)
      res.end(
        JSON.stringify({
          success: true,
          data: { id: deckId, name: "Synthetic Deck", isPublic: false },
        }),
      );
    else if (req.url === "/api/auth/sign-out")
      res.end(JSON.stringify({ success: true }));
    else {
      res.statusCode = 404;
      res.end("Unknown route");
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  const args = [
    "scripts/release-smoke.mjs",
    "--origin",
    origin,
    "--expected-commit",
    commit,
    "--deck-id",
    deckId,
    "--credentials-file",
    credentials,
    "--allow-test-loopback",
  ];
  const run = async (extra = []) => {
    try {
      return {
        code: 0,
        ...(await execute(process.execPath, [...args, ...extra], {
          env: { ...process.env, NODE_ENV: "test" },
          timeout: 10000,
        })),
      };
    } catch (error) {
      return { code: error.code, stdout: error.stdout, stderr: error.stderr };
    }
  };
  return { calls, run, args, origin, credentials, directory };
}

function privateOutput(result) {
  assert.doesNotMatch(result.stdout + result.stderr, /private-smoke-/);
}

test("operator smoke reads live surfaces and an authorized Deck, then signs out its session", async t => {
  const { run, calls, origin } = await fixture(t);
  const result = await run();
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /release_smoke_passed/);
  privateOutput(result);
  assert.deepEqual(
    calls.map(call => `${call.method} ${call.path}`),
    [
      "GET /",
      "GET /health",
      "GET /ready",
      "GET /docs",
      "GET /openapi.json",
      "GET /api/auth/open-api/generate-schema",
      "POST /api/auth/sign-in/email",
      `GET /deck/${deckId}`,
      "POST /api/auth/sign-out",
    ],
  );
  assert.equal(
    calls.at(-2).cookie,
    `__Secure-better-auth.session_token=${session}`,
  );
  assert.equal(calls.at(-1).origin, origin);
  assert.equal(
    JSON.parse(calls.find(call => call.path === "/api/auth/sign-in/email").body)
      .password,
    password,
  );
});

test("a different live commit fails before credentials are transmitted", async t => {
  const { run, calls } = await fixture(t, {
    "/": (_req, res) => {
      res.setHeader("X-Release-Commit", "b".repeat(40));
      res.end("Top Vino");
    },
  });
  const result = await run();
  assert.equal(result.code, 1);
  assert.match(result.stderr, /commit_identity/);
  privateOutput(result);
  assert.deepEqual(
    calls.map(call => call.path),
    ["/"],
  );
});

test("noncanonical origins and malformed commit identifiers fail before any HTTP request", async t => {
  const { run, calls, origin } = await fixture(t);
  for (const extra of [
    ["--origin", `${origin}/private-password`],
    ["--origin", `${origin}?token=private-smoke-token`],
    ["--origin", `${origin}#private-smoke-token`],
    ["--origin", "https://user:private-smoke-password@example.test"],
    ["--expected-commit", "short"],
    ["--deck-id", "../private-smoke-path"],
  ]) {
    const result = await run(extra);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /configuration/);
    privateOutput(result);
  }
  assert.equal(calls.length, 0);
});

test("credentials require an existing private external file and a synthetic tester", async t => {
  const { run, calls, credentials } = await fixture(t);
  const { chmod } = await import("node:fs/promises");
  await chmod(credentials, 0o644);
  const exposed = await run();
  assert.equal(exposed.code, 1);
  assert.match(exposed.stderr, /configuration/);
  await chmod(credentials, 0o600);
  await writeFile(
    credentials,
    JSON.stringify({ email: "person@example.com", password }),
  );
  const personal = await run();
  assert.equal(personal.code, 1);
  privateOutput(exposed);
  privateOutput(personal);
  assert.equal(calls.length, 0);
});

test("a Deck redirect is never followed and the smoke session is cleaned up on failure", async t => {
  const { run, calls } = await fixture(t, {
    [`/deck/${deckId}`]: (_req, res) => {
      res.statusCode = 302;
      res.setHeader("Location", "/private-smoke-stolen");
      res.end();
    },
  });
  const result = await run();
  assert.equal(result.code, 1);
  assert.match(result.stderr, /authorized_deck/);
  privateOutput(result);
  assert.equal(
    calls.some(call => call.path === "/private-smoke-stolen"),
    false,
  );
  assert.equal(calls.at(-1).path, "/api/auth/sign-out");
});

test("a stalled Deck read times out, reports a safe stage, and still signs out", async t => {
  const { run, calls } = await fixture(t, {
    [`/deck/${deckId}`]: (_req, res) => {
      setTimeout(
        () => res.end(JSON.stringify({ success: true, data: { id: deckId } })),
        500,
      );
    },
  });
  const result = await run(["--timeout-ms", "100"]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /authorized_deck/);
  privateOutput(result);
  assert.equal(calls.at(-1).path, "/api/auth/sign-out");
});

test("a failed session cleanup keeps release acceptance pending", async t => {
  const { run } = await fixture(t, {
    "/api/auth/sign-out": (_req, res) => {
      res.statusCode = 500;
      res.end("private-smoke-database-credential");
    },
  });
  const result = await run();
  assert.equal(result.code, 1);
  assert.match(result.stderr, /session_cleanup/);
  assert.equal(JSON.parse(result.stderr).cleanupFailed, true);
  privateOutput(result);
});

test("failed readiness stops smoke before synthetic credentials reach the API", async t => {
  const { run, calls } = await fixture(t, {
    "/ready": (_req, res) => {
      res.statusCode = 503;
      res.end("private-smoke-database-url");
    },
  });
  const result = await run();
  assert.equal(result.code, 1);
  assert.match(result.stderr, /readiness/);
  assert.equal(
    calls.some(call => call.path === "/api/auth/sign-in/email"),
    false,
  );
  privateOutput(result);
});

test("a successful status with no sandbox API reference is not a passing docs smoke", async t => {
  const { run, calls } = await fixture(t, {
    "/docs": (_req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end("private-smoke-upstream-error-page");
    },
  });
  const result = await run();
  assert.equal(result.code, 1);
  assert.match(result.stderr, /documentation/);
  assert.equal(
    calls.some(call => call.path === "/api/auth/sign-in/email"),
    false,
  );
  privateOutput(result);
});
