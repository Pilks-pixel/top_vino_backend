import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  chmodSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function run(args, env = {}) {
  return spawnSync(
    process.execPath,
    ["scripts/verify-portability.mjs", ...args],
    { encoding: "utf8", env: { ...process.env, ...env } },
  );
}

test("portability operator cannot accidentally export an arbitrary supplied source URL", () => {
  const result = run([
    "--source-url",
    "postgresql://private-password@live.example/data",
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /disposable synthetic databases only/);
  assert.ok(!result.stderr.includes("private-password"));
});

test("operator must choose a private export directory outside the checkout", () => {
  const directory = mkdtempSync(join(tmpdir(), "vino-portability-test-"));
  try {
    chmodSync(directory, 0o755);
    const result = run(["--image", "fixture:image", "--output", directory]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /private directory/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  const inside = run(["--image", "fixture:image", "--output", "artifacts"]);
  assert.equal(inside.status, 1);
  assert.match(inside.stderr, /outside the checkout/);
});

test("rehearsal preserves earlier artifacts instead of overwriting their evidence", () => {
  const directory = mkdtempSync(join(tmpdir(), "vino-portability-existing-"));
  try {
    chmodSync(directory, 0o700);
    writeFileSync(join(directory, "previous.dump"), "previous evidence", {
      mode: 0o600,
    });
    const result = run(["--image", "fixture:image", "--output", directory]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /empty private directory/);
    assert.equal(
      readFileSync(join(directory, "previous.dump"), "utf8"),
      "previous evidence",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
