import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// CLI seam: repository administrators submit GitHub API evidence, not internal helpers.
function run(command, input) {
  const dir = mkdtempSync(join(tmpdir(), "vino-policy-"));
  try {
    const file = join(dir, "input.json");
    writeFileSync(file, JSON.stringify(input));
    return spawnSync(
      process.execPath,
      ["scripts/repository-policy.mjs", command, file],
      { encoding: "utf8" },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function checks() {
  return ["CI / quality", "CI / container"].map((name, i) => ({
    id: i + 1,
    name,
    head_sha: "a".repeat(40),
    status: "completed",
    conclusion: "success",
    app: { id: 15368, slug: "github-actions" },
  }));
}

test("administrator cannot accept a skipped required job as successful evidence", () => {
  const evidence = {
    sha: "a".repeat(40),
    actionsApp: { id: 15368, slug: "github-actions" },
    checks: checks(),
  };
  evidence.checks[1].conclusion = "skipped";
  const result = run("check-results", evidence);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CI \/ container.*success/);
});

test("administrator can accept successful executions bound to GitHub Actions", () => {
  const result = run("check-results", {
    sha: "a".repeat(40),
    actionsApp: { id: 15368, slug: "github-actions" },
    checks: checks(),
  });
  assert.equal(result.status, 0, result.stderr);
});

test("a newer failed rerun prevents using an older passing run", () => {
  const evidence = {
    sha: "a".repeat(40),
    actionsApp: { id: 15368, slug: "github-actions" },
    checks: checks(),
  };
  evidence.checks.push({ ...evidence.checks[0], id: 3, conclusion: "failure" });
  assert.equal(run("check-results", evidence).status, 1);
});

test("status evidence from another app or commit cannot unlock policy setup", () => {
  for (const change of [
    { app: { id: 1, slug: "other" } },
    { head_sha: "b".repeat(40) },
  ]) {
    const evidence = {
      sha: "a".repeat(40),
      actionsApp: { id: 15368, slug: "github-actions" },
      checks: checks(),
    };
    Object.assign(evidence.checks[0], change);
    assert.equal(run("check-results", evidence).status, 1);
  }
});

function ruleset() {
  return {
    name: "sandbox-main",
    target: "branch",
    enforcement: "active",
    bypass_actors: [],
    conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
    rules: [
      { type: "deletion" },
      { type: "non_fast_forward" },
      {
        type: "pull_request",
        parameters: {
          required_approving_review_count: 0,
          required_review_thread_resolution: true,
          require_code_owner_review: false,
          dismiss_stale_reviews_on_push: false,
          require_last_push_approval: false,
          allowed_merge_methods: ["merge", "squash", "rebase"],
        },
      },
      {
        type: "required_status_checks",
        parameters: {
          strict_required_status_checks_policy: true,
          do_not_enforce_on_create: false,
          required_status_checks: [
            { context: "CI / quality", integration_id: 15368 },
            { context: "CI / container", integration_id: 15368 },
          ],
        },
      },
    ],
  };
}

test("operator cannot apply a ruleset that lets the owner bypass checks", () => {
  const policy = ruleset();
  policy.bypass_actors = [
    { actor_type: "RepositoryRole", actor_id: 5, bypass_mode: "always" },
  ];
  const result = run("validate", policy);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /bypass/);
});

test("reviewed policy permits PRs without approvals but never relaxed checks or force pushes", () => {
  assert.equal(run("validate", ruleset()).status, 0);
  const changes = [
    policy => {
      policy.enforcement = "disabled";
    },
    policy => {
      policy.conditions.ref_name.exclude = ["refs/heads/main"];
    },
    policy => {
      policy.rules = policy.rules.filter(
        rule => rule.type !== "non_fast_forward",
      );
    },
    policy => {
      policy.rules[2].parameters.required_review_thread_resolution = false;
    },
    policy => {
      policy.rules[2].parameters.required_approving_review_count = 1;
    },
    policy => {
      policy.rules[3].parameters.strict_required_status_checks_policy = false;
    },
    policy => {
      policy.rules[3].parameters.required_status_checks[0].integration_id = 1;
    },
    policy => {
      policy.rules[3].parameters.required_status_checks[0].context = "quality";
    },
  ];
  for (const change of changes) {
    const policy = ruleset();
    change(policy);
    assert.equal(run("validate", policy).status, 1);
  }
});

function settingsEvidence() {
  return {
    sha: "a".repeat(40),
    actionsApp: { id: 15368, slug: "github-actions" },
    checks: checks(),
    repository: { default_branch: "main", allow_auto_merge: false },
    pull: {
      state: "open",
      base: { ref: "main" },
      head: { sha: "a".repeat(40) },
      merge_commit_sha: "a".repeat(40),
      auto_merge: null,
    },
    rulesets: [ruleset()],
    actions: {
      enabled: true,
      allowed_actions: "selected",
      sha_pinning_required: true,
    },
    selectedActions: {
      github_owned_allowed: true,
      verified_allowed: false,
      patterns_allowed: [],
    },
    workflowPermissions: {
      default_workflow_permissions: "read",
      can_approve_pull_request_reviews: false,
    },
    vulnerabilityAlerts: true,
    securityUpdates: { enabled: true },
  };
}

test("verification detects live settings drift after a previously successful PR", () => {
  const evidence = settingsEvidence();
  evidence.actions.sha_pinning_required = false;
  const result = run("verify", evidence);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /SHA/);
});

test("complete settings and genuine successful runs verify without merging the PR", () => {
  const result = run("verify", settingsEvidence());
  assert.equal(result.status, 0, result.stderr);
});

test("live verification rejects automerge, extra bypassing rulesets and disabled Dependabot", () => {
  const changes = [
    evidence => {
      evidence.repository.allow_auto_merge = true;
    },
    evidence => {
      evidence.pull.auto_merge = {};
    },
    evidence => {
      evidence.rulesets.push(ruleset());
    },
    evidence => {
      evidence.securityUpdates.enabled = false;
    },
    evidence => {
      evidence.selectedActions.verified_allowed = true;
    },
    evidence => {
      evidence.selectedActions.patterns_allowed = ["*"];
    },
    evidence => {
      evidence.workflowPermissions.default_workflow_permissions = "write";
    },
    evidence => {
      evidence.pull.head.sha = "b".repeat(40);
      evidence.pull.merge_commit_sha = "c".repeat(40);
    },
  ];
  for (const change of changes) {
    const evidence = settingsEvidence();
    change(evidence);
    assert.equal(run("verify", evidence).status, 1);
  }
});
