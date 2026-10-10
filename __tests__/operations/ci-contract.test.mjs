import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(
  new URL("../../scripts/verify-ci-contract.mjs", import.meta.url),
);
test("the repository workflow provides both required source and image gates", () => {
  const result = spawnSync(process.execPath, [cli], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import yaml from "js-yaml";
function altered(change) {
  const dir = mkdtempSync(join(tmpdir(), "vino-ci-policy-"));
  try {
    const workflow = yaml.load(
      readFileSync(
        new URL("../../.github/workflows/ci.yml", import.meta.url),
        "utf8",
      ),
    );
    change(workflow);
    const path = join(dir, "ci.yml");
    writeFileSync(path, yaml.dump(workflow));
    return spawnSync(process.execPath, [cli, path], { encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
test("a required job cannot report passing by skipping application checks", () => {
  const result = altered(workflow => {
    workflow.jobs.quality.if = "github.event_name == 'push'";
  });
  assert.equal(result.status, 1);
});
test("main runs cannot be cancelled or suppressed by path filters", () => {
  assert.equal(
    altered(workflow => {
      workflow.concurrency["cancel-in-progress"] = true;
    }).status,
    1,
  );
  assert.equal(
    altered(workflow => {
      workflow.on.push.paths = ["src/**"];
    }).status,
    1,
  );
});
test("CI cannot require provider secrets or mutable third-party actions", () => {
  assert.equal(
    altered(workflow => {
      workflow.jobs.quality.env.DATABASE_URL = "${{ secrets.DATABASE_URL }}";
    }).status,
    1,
  );
  assert.equal(
    altered(workflow => {
      workflow.jobs.quality.steps[0].uses = "actions/checkout@v6";
    }).status,
    1,
  );
});
