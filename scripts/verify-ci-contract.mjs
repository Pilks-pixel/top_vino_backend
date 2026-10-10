import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

try {
  const path =
    process.argv[2] ??
    fileURLToPath(new URL("../.github/workflows/ci.yml", import.meta.url));
  const source = readFileSync(path, "utf8");
  const workflow = yaml.load(source);
  if (
    /secrets\s*(?:\.|\[)/.test(source) ||
    workflow.permissions?.contents !== "read" ||
    Object.keys(workflow.permissions).length !== 1
  )
    throw new Error("permissions");
  const triggers = workflow.on;
  if (
    !triggers?.push?.branches?.includes("main") ||
    !triggers?.pull_request?.branches?.includes("main") ||
    triggers.push.branches.length !== 1 ||
    [triggers.push, triggers.pull_request].some(
      event => event.paths || event["paths-ignore"],
    ) ||
    workflow.concurrency?.["cancel-in-progress"] !==
      "${{ github.event_name == 'pull_request' }}"
  ) {
    throw new Error("unconditional_runs");
  }
  for (const [job, name] of [
    ["quality", "CI / quality"],
    ["container", "CI / container"],
  ]) {
    const gate = workflow.jobs?.[job];
    if (
      gate?.if !== undefined ||
      gate?.name !== name ||
      gate["runs-on"] !== "ubuntu-24.04"
    )
      throw new Error("required_context");
    for (const step of gate.steps) {
      if (
        step.if !== undefined ||
        step["continue-on-error"] ||
        (step.uses && !/^actions\/[a-z-]+@[0-9a-f]{40}$/.test(step.uses))
      )
        throw new Error("skipped_or_unpinned_step");
    }
  }
  console.log(JSON.stringify({ event: "ci_contract", ok: true }));
} catch {
  console.error(JSON.stringify({ event: "ci_contract", ok: false }));
  process.exitCode = 1;
}
