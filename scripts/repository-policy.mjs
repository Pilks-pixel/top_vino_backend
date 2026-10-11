#!/usr/bin/env node
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const contexts = ["CI / quality", "CI / container"];
function requireThat(value, message) {
  if (!value) throw new Error(message);
}
function checkResults(evidence) {
  requireThat(
    /^[a-f0-9]{40}$/.test(evidence.sha),
    "Evidence must identify the tested commit SHA",
  );
  requireThat(
    evidence.actionsApp?.slug === "github-actions" &&
      Number.isInteger(evidence.actionsApp.id),
    "Missing GitHub Actions app identity",
  );
  for (const name of contexts) {
    const result = evidence.checks
      .filter(check => check.name === name && check.head_sha === evidence.sha)
      .sort((a, b) => b.id - a.id)[0];
    requireThat(
      result?.app?.id === evidence.actionsApp.id &&
        result.app.slug === "github-actions",
      `${name} must originate from GitHub Actions`,
    );
    requireThat(
      result.status === "completed" && result.conclusion === "success",
      `${name} must finish with success; skipped and neutral are not evidence`,
    );
  }
}
function validate(policy, appId = 15368) {
  requireThat(
    policy.target === "branch" && policy.enforcement === "active",
    "Ruleset must actively protect branches",
  );
  requireThat(
    Array.isArray(policy.bypass_actors) && policy.bypass_actors.length === 0,
    "Ruleset must have no bypass actors, including the owner",
  );
  requireThat(
    JSON.stringify(policy.conditions?.ref_name?.include) ===
      '["~DEFAULT_BRANCH"]' &&
      JSON.stringify(policy.conditions?.ref_name?.exclude) === "[]",
    "Ruleset must target only the default branch without exclusions",
  );
  const rules = policy.rules;
  requireThat(
    Array.isArray(rules) &&
      rules.length === 4 &&
      new Set(rules.map(rule => rule.type)).size === 4,
    "Ruleset must contain the four reviewed rules",
  );
  for (const type of [
    "deletion",
    "non_fast_forward",
    "pull_request",
    "required_status_checks",
  ])
    requireThat(
      rules.some(rule => rule.type === type),
      `Missing ${type} protection`,
    );
  const pr = rules.find(rule => rule.type === "pull_request").parameters;
  requireThat(
    pr?.required_approving_review_count === 0 &&
      pr.required_review_thread_resolution === true,
    "Require PRs with resolved conversations and zero approving reviews",
  );
  requireThat(
    pr.require_code_owner_review === false &&
      pr.require_last_push_approval === false,
    "Do not require additional human approval",
  );
  const checks = rules.find(
    rule => rule.type === "required_status_checks",
  ).parameters;
  requireThat(
    checks?.strict_required_status_checks_policy === true &&
      checks.do_not_enforce_on_create === false,
    "Required checks must be strict, including branch creation",
  );
  requireThat(
    checks.required_status_checks?.length === 2 &&
      contexts.every(context =>
        checks.required_status_checks.some(
          check => check.context === context && check.integration_id === appId,
        ),
      ),
    "Both exact required contexts must be bound to GitHub Actions",
  );
}
function verify(evidence) {
  checkResults(evidence);
  requireThat(
    evidence.repository?.default_branch === "main",
    "Expected main as the default branch",
  );
  requireThat(
    evidence.repository.allow_auto_merge === false &&
      evidence.pull?.auto_merge === null,
    "Automatic dependency merging must remain disabled",
  );
  requireThat(
    evidence.pull.state === "open" &&
      evidence.pull.base?.ref === "main" &&
      [evidence.pull.head?.sha, evidence.pull.merge_commit_sha].includes(
        evidence.sha,
      ),
    "Representative PR must be open against main at the tested SHA",
  );
  const active = evidence.rulesets.filter(
    rule => rule.enforcement === "active" && rule.target === "branch",
  );
  requireThat(
    active.length === 1,
    "Expected exactly one active branch ruleset",
  );
  validate(active[0], evidence.actionsApp.id);
  requireThat(
    evidence.actions?.enabled === true &&
      evidence.actions.allowed_actions === "selected" &&
      evidence.actions.sha_pinning_required === true,
    "Actions must allow selected actions with full SHA pinning",
  );
  requireThat(
    evidence.selectedActions?.github_owned_allowed === true &&
      evidence.selectedActions.verified_allowed === false &&
      (evidence.selectedActions.patterns_allowed ?? []).length === 0,
    "Only GitHub-authored and local actions are allowed",
  );
  requireThat(
    evidence.workflowPermissions?.default_workflow_permissions === "read" &&
      evidence.workflowPermissions.can_approve_pull_request_reviews === false,
    "Workflow defaults must be read-only without review approval",
  );
  requireThat(
    evidence.vulnerabilityAlerts === true &&
      evidence.securityUpdates?.enabled === true,
    "Dependabot alerts and security updates must be enabled",
  );
}

function api(endpoint, method = "GET", body, paged = false) {
  const args = [
    "api",
    endpoint,
    "--method",
    method,
    "-H",
    "Accept: application/vnd.github+json",
    "-H",
    "X-GitHub-Api-Version: 2026-03-10",
  ];
  if (body !== undefined) args.push("--input", "-");
  if (paged) args.push("--paginate", "--slurp");
  const output = execFileSync("gh", args, {
    encoding: "utf8",
    input: body === undefined ? undefined : JSON.stringify(body),
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 30000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return output.trim() ? JSON.parse(output) : null;
}
function target(repository, pr) {
  requireThat(
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) &&
      /^[1-9][0-9]*$/.test(pr),
    "Expected OWNER/REPO and PR number",
  );
  return `repos/${repository}`;
}
function results(repository, number) {
  const root = target(repository, number);
  const actionsApp = api("apps/github-actions");
  const pull = api(`${root}/pulls/${number}`);
  requireThat(
    pull.state === "open" && pull.base.ref === "main",
    "Choose an open representative PR targeting main",
  );
  const shas = [
    ...new Set([pull.merge_commit_sha, pull.head.sha].filter(Boolean)),
  ];
  const checks = shas.flatMap(sha =>
    api(
      `${root}/commits/${sha}/check-runs?per_page=100&filter=latest`,
      "GET",
      undefined,
      true,
    ).flatMap(page => page.check_runs),
  );
  const sha =
    shas.find(candidate =>
      contexts.every(name =>
        checks.some(
          check => check.head_sha === candidate && check.name === name,
        ),
      ),
    ) ?? pull.head.sha;
  const current = api(`${root}/pulls/${number}`);
  requireThat(
    current.head.sha === pull.head.sha &&
      current.merge_commit_sha === pull.merge_commit_sha,
    "PR changed while collecting evidence; retry",
  );
  return {
    capturedAt: new Date().toISOString(),
    repositoryName: repository,
    prNumber: Number(number),
    sha,
    actionsApp: { id: actionsApp.id, slug: actionsApp.slug },
    pull,
    checks,
  };
}
function capture(repository, number) {
  const root = target(repository, number);
  const evidence = results(repository, number);
  const summaries = api(
    `${root}/rulesets?includes_parents=true&per_page=100`,
    "GET",
    undefined,
    true,
  ).flat();
  evidence.rulesets = summaries.map(rule => api(`${root}/rulesets/${rule.id}`));
  evidence.repository = api(root);
  evidence.actions = api(`${root}/actions/permissions`);
  evidence.selectedActions = api(
    `${root}/actions/permissions/selected-actions`,
  );
  evidence.workflowPermissions = api(`${root}/actions/permissions/workflow`);
  try {
    api(`${root}/vulnerability-alerts`);
    evidence.vulnerabilityAlerts = true;
  } catch (error) {
    if (String(error.stderr).includes("(HTTP 404)"))
      evidence.vulnerabilityAlerts = false;
    else throw error;
  }
  evidence.securityUpdates = api(`${root}/automated-security-fixes`);
  return evidence;
}
function apply(repository, number) {
  const root = target(repository, number);
  const evidence = results(repository, number);
  checkResults(evidence);
  const policy = JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL("../.github/policies/main-ruleset.json", import.meta.url),
      ),
      "utf8",
    ),
  );
  for (const check of policy.rules.find(
    rule => rule.type === "required_status_checks",
  ).parameters.required_status_checks)
    check.integration_id = evidence.actionsApp.id;
  validate(policy, evidence.actionsApp.id);
  const repo = api(root);
  requireThat(
    repo.default_branch === "main",
    "Default branch must be main before applying policy",
  );
  const existing = api(
    `${root}/rulesets?includes_parents=true&per_page=100`,
    "GET",
    undefined,
    true,
  ).flat();
  requireThat(
    existing.filter(rule => rule.name === policy.name).length <= 1,
    "Multiple sandbox-main rulesets exist; inspect and reconcile first",
  );
  requireThat(
    !existing.some(
      rule =>
        rule.source_type !== "Repository" ||
        (rule.target === "branch" &&
          rule.enforcement === "active" &&
          rule.name !== policy.name),
    ),
    "Other active or inherited rulesets exist; inspect and reconcile first",
  );
  const previous = existing.find(rule => rule.name === policy.name);
  // No policy writes occur before current successful job evidence and conflict checks.
  api(`${root}/actions/permissions`, "PUT", {
    enabled: true,
    allowed_actions: "selected",
    sha_pinning_required: true,
  });
  api(`${root}/actions/permissions/selected-actions`, "PUT", {
    github_owned_allowed: true,
    verified_allowed: false,
    patterns_allowed: [],
  });
  api(`${root}/actions/permissions/workflow`, "PUT", {
    default_workflow_permissions: "read",
    can_approve_pull_request_reviews: false,
  });
  api(root, "PATCH", { allow_auto_merge: false });
  api(`${root}/vulnerability-alerts`, "PUT");
  api(`${root}/automated-security-fixes`, "PUT");
  api(
    `${root}/rulesets${previous ? `/${previous.id}` : ""}`,
    previous ? "PUT" : "POST",
    policy,
  );
  const applied = capture(repository, number);
  verify(applied);
  return applied;
}
try {
  const [command, arg, number, output] = process.argv.slice(2);
  if (["validate", "check-results", "verify"].includes(command)) {
    const input = JSON.parse(readFileSync(arg, "utf8"));
    if (command === "validate") validate(input);
    if (command === "check-results") checkResults(input);
    if (command === "verify") verify(input);
  } else if (["capture", "apply"].includes(command)) {
    requireThat(output, "Supply a private evidence output path");
    const evidence =
      command === "apply" ? apply(arg, number) : capture(arg, number);
    writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, {
      mode: 0o600,
    });
    chmodSync(output, 0o600);
  } else
    throw new Error(
      "Usage: repository-policy.mjs {validate|check-results|verify} FILE | {capture|apply} OWNER/REPO PR OUTPUT",
    );
  console.log(
    "Policy command completed. Live enforcement still requires the documented owner merge-blocking check.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
