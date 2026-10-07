# Protected main and dependency updates

[Decision #34](https://github.com/Pilks-pixel/top_vino_backend/issues/34) fixes this policy; [implementation #48](https://github.com/Pilks-pixel/top_vino_backend/issues/48) belongs to [spec #41](https://github.com/Pilks-pixel/top_vino_backend/issues/41). Committed configuration describes the intended settings. **Live settings and owner enforcement remain pending until the procedure below produces evidence.** Do not enable automatic sandbox deployment before that evidence exists.

## Reviewed policy

`.github/policies/main-ruleset.json` creates `sandbox-main`: active on the default branch, no bypass actors (including the owner), PRs required, zero approving reviews, resolved conversations, strict up-to-date checks, blocked deletion and force pushes. The exact raw required contexts are `CI / quality` and `CI / container`, from the GitHub Actions App. GitHub uses the **job name**, rather than the workflow UI grouping, as the ruleset context. The template uses github.com Actions App ID `15368`; the setup command resolves `/apps/github-actions` and binds the returned ID before applying it.

Repository Actions settings allow GitHub-authored and local actions, require full commit SHA pins, disallow verified third-party authors and other patterns, and default to read-only tokens without review-approval permission. The reviewed #47 workflow separately declares `contents: read`, full SHA external actions, synthetic disposable credentials and unconditional jobs. It must receive no repository/environment/provider credentials, deployment permission, OIDC permission, or registry credentials. Settings cannot prove that source contract; review workflow changes before acceptance.

Dependabot alerts and security fixes are enabled separately from `.github/dependabot.yml`. That file requests weekly npm, Docker and Actions version updates, grouping compatible minor/patch updates while majors stay separate. Version updates become active when the file reaches the default branch. All updates require reviewed PRs and the same two CI checks. Repository auto-merge is disabled. Review alerts explicitly; blanket `npm audit` is not a required check. Docker/Node/npm and database pins are a shared release contract: update all related pins and recheck the image together. Dependabot suggesting an image or runtime change is not approval to broaden that contract. Retain existing secret scanning and push protection.

## Repeatable API setup

Use Node from `.nvmrc`, authenticated `gh`, and a repository administrator with permission to read/write repository settings. Choose an **open representative PR targeting main** containing the reviewed #47 workflow, with both required jobs truly successful. Stacked PRs targeting another layer do not satisfy this precondition; keep this live step pending until a suitable main-target PR exists. No PR needs to be merged to apply or inspect policy.

```bash
node --test __tests__/operations/*.test.mjs
node scripts/repository-policy.mjs validate .github/policies/main-ruleset.json
# Explicit live mutation: read this runbook and the reviewed JSON before running.
node scripts/repository-policy.mjs apply Pilks-pixel/top_vino_backend PR_NUMBER /tmp/top-vino-policy.json
node scripts/repository-policy.mjs verify /tmp/top-vino-policy.json
```

`apply` checks fresh PR evidence before any mutation, refuses conflicting or inherited rulesets, updates the same named ruleset on reruns, then reads settings back and verifies them. It applies selected action trust, full SHA requirement, read-only token defaults, disabled auto-merge, Dependabot alerts/security fixes, and the ruleset. It never writes application secrets, merges PRs, or closes issues. If GitHub refuses an endpoint, the process fails; earlier settings may already have applied. Inspect the current settings, resolve the permission/plan or conflict, and rerun. It does not remove other protections to force success.

Read-only capture and verification can be repeated after settings drift or a new PR commit:

```bash
node scripts/repository-policy.mjs capture Pilks-pixel/top_vino_backend PR_NUMBER /tmp/top-vino-policy.json
node scripts/repository-policy.mjs verify /tmp/top-vino-policy.json
```

Evidence includes the PR head/merge SHA, current check runs, GitHub Actions identity, settings, and timestamp. It contains repository metadata but no application credentials. Keep it private; record only sanitized setting summaries, commit SHA, PR/check URLs, result and time in release evidence. Capture is read-only; `verify` validates the captured snapshot and does not establish that settings stayed unchanged afterward. Capture again for release acceptance.

## Dashboard fallback

If API permissions are unavailable, run:

```bash
bash scripts/setup-repository-policy.sh PR_NUMBER
```

The wizard walks the existing reviewed settings through Actions > General, Advanced Security, General > Pull Requests, and Rulesets. It captures no credentials and opens no paid services. It leaves the wizard helper library intact. Inspect its five stages first; it only writes a private API evidence file at the end. Dashboard steps need an administrator; if API readback is unavailable, collect equivalent screenshots/settings exports and keep automated live verification pending.

## Live acceptance procedure

1. Review the actual workflow on the representative main-target PR. Both jobs must have no job `if`, dependencies that can skip them, path filters, or `continue-on-error`; source/image assertions must run. Review any future changes against #47. Check the raw GitHub check API names and App source, rather than relying on the UI's workflow prefix.
2. Run both jobs on the current PR SHA. Capture and verify settings. The verifier accepts only completed `success` results; `skipped`, `neutral`, missing jobs, old-SHA results, another app and a newer failed rerun fail validation.
3. As the owner, inspect a representative PR while either required job is pending or failed. Confirm the merge control is blocked by the required check and there is no bypass/override control. Inspect an out-of-date PR and an unresolved conversation: each must also prevent merging. Use an already blocked PR or a throwaway main-target test branch/PR, then restore/retest it; do not merge or push directly to main merely to test protection. Record PR, SHA, screenshots and ruleset evidence privately. If the PR is a draft, the draft state alone is insufficient blocking evidence; inspect the displayed required-check/conversation/up-to-date reasons and leave the actual owner merge-control criterion pending if they cannot be established without changing PR readiness.
4. Inspect the active ruleset as owner: empty bypass list, strict GitHub Actions sources, deletion/non-fast-forward rules, zero approvals, and conversation resolution. Confirm no additional active/inherited ruleset conflicts. Verify Dependabot alerts/security-update toggles and the weekly config on the default branch; record version-update activation only after it reaches main.

**GitHub itself accepts skipped/neutral required jobs as passing.** The ruleset has no native success-only option. The guarantee therefore depends on the unconditional reviewed workflow and actual-success evidence together. Do not claim the ruleset alone rejects skipped jobs. The Render release gate must also retain this contract because Render counts skipped/neutral checks as passing. Leave any unexecuted owner/PR, dependency activation, and live release criteria pending.

Official references: [ruleset check names](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/troubleshooting-rules), [skipped status behavior](https://docs.github.com/en/pull-requests/reference/status-checks), [Actions policy API](https://docs.github.com/en/rest/actions/permissions), [ruleset API](https://docs.github.com/en/rest/repos/rules), [dashboard Actions policy](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository), [Dependabot options](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference), [ruleset import](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/managing-rulesets-for-a-repository).
