import assert from "node:assert/strict";
import test from "node:test";
import { probeSandbox } from "../../scripts/sandbox-probe.mjs";

test("cold health then readiness succeeds without retry or credentials", async () => {
  const observed = [];
  const result = await probeSandbox("https://sandbox.example.test", {
    request: async (url, options) => {
      observed.push({ url, options });
      return { ok: true };
    },
    wait: async () => {
      throw new Error("unexpected wait");
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(
    observed.map(x => new URL(x.url).pathname),
    ["/health", "/ready"],
  );
  assert.ok(
    observed.every(
      x =>
        x.options.redirect === "error" &&
        x.options.credentials === "omit" &&
        !x.options.headers,
    ),
  );
});

test("failed readiness retries the whole cold path after five minutes", async () => {
  const paths = [],
    waits = [];
  const result = await probeSandbox("https://sandbox.example.test", {
    request: async url => {
      paths.push(new URL(url).pathname);
      return { ok: paths.length !== 2 };
    },
    wait: async ms => {
      waits.push(ms);
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 2);
  assert.deepEqual(paths, ["/health", "/ready", "/health", "/ready"]);
  assert.deepEqual(waits, [300000]);
});

test("two failed cold starts fail without probing readiness or leaking errors", async () => {
  const paths = [];
  const result = await probeSandbox("https://sandbox.example.test", {
    request: async url => {
      paths.push(new URL(url).pathname);
      throw new Error("private upstream body");
    },
    wait: async () => {},
  });
  assert.equal(result.ok, false);
  assert.deepEqual(paths, ["/health", "/health"]);
  assert.equal(JSON.stringify(result).includes("private"), false);
});

test("rejects configuration credentials and paths before any HTTP request", async () => {
  for (const origin of [
    "",
    "http://sandbox.example.test",
    "https://user:password@sandbox.example.test",
    "https://sandbox.example.test/path",
    "https://sandbox.example.test?token=private",
  ]) {
    await assert.rejects(
      probeSandbox(origin, {
        request: async () => {
          throw new Error("HTTP must not run");
        },
      }),
      /Invalid SANDBOX_URL/,
    );
  }
});
