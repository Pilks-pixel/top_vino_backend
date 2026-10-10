# Observing the disposable sandbox

Implements preparation for [#51](https://github.com/Pilks-pixel/top_vino_backend/issues/51), based on [decision #38](https://github.com/Pilks-pixel/top_vino_backend/issues/38). Sole operational owner: repository owner Pilks-pixel. Inspect failures by the next business day; prioritize security exposure and data loss at the next working period. No night/weekend, uptime, recovery or response commitment.

## Daily cold path

After first verified deployment, set the public repository variable `SANDBOX_URL` to the exact HTTPS origin, without slash/path/query or credential: `gh variable set SANDBOX_URL --repo Pilks-pixel/top_vino_backend --body <public-origin>`. This is public configuration, not a secret. The setup wizard captures the same public origin locally; it does not enable the probe itself. Run the workflow once through Actions → Sandbox probe → Run workflow and record success.

The scheduled secret-free workflow runs `17 2 * * *` UTC (09:17 Asia/Bangkok). It requests /health with a 90-second timeout for cold start, then /ready with 30 seconds; after either fails it waits five minutes and retries the full sequence once. It fails after both attempts fail, follows no redirects, uses no session, and changes no data. No dependencies or provider credentials are installed. Configuration errors fail immediately and identify a monitoring setup fault; the script never prints upstream bodies, exception text or URL values.

Set GitHub Settings → Notifications → System → Actions to email for failed workflows only. Confirm the currently shown option in your account; if it differs, record that limitation and use the narrowest failure-only setting. Subscribe to this repository and test with a controlled failed **manual** probe, followed by a successful manual run. Verify the owner actually receives the failure email; do not send simulated notices to testers.

Scheduling is best effort and may be delayed/dropped or disabled after repository inactivity. Weekly review must confirm the last successful run and schedule still enabled; a missing run is a monitoring failure, not proof the service is healthy. This once-daily probe does not keep Free compute awake.

## Provider logs, failure emails and live facts

Use [render-monitor](https://github.com/render-oss/skills/tree/main/skills/render-monitor) guidance: inspect service status and latest live deploy, recent error events, CPU/memory and latency during diagnosis. Use dashboard metrics for Neon, not Render Postgres queries: this service uses Neon. Inspect with `render services -o json`, `render deploys list <private-service-id> -o json`, or `render logs -r <private-service-id> --level error -o json` in a private terminal; never copy raw logs into repository records. CLI/MCP metrics availability differs, so dashboard is the fallback and no new API key is required.

The authoritative application stream is correlated redacted JSON stdout ([logging ADR](./adr/0002-logging-contract.md)). Search by timestamp, event, status and application request ID. Dashboard access remains owner-only; no log vendor, log file, pager, Slack channel or shared access.

Render Workspace Settings → Notifications: choose **Only failure notifications**, email on, Slack unset. Verify service overrides agree. Current docs cover failed build/deploy, unhealthy service, failed Blueprint sync and repeated-startup suspension. Confirm quota warnings in billing/usage and Neon near-limit email where the actual Free plan offers it. Dashboard/UI absence is recorded, not assumed available.

| Provider fact | Documentation preparation | Live evidence |
| --- | --- | --- |
| Render Hobby log retention | Seven days in official docs checked 2026-10-07 | Pending console confirmation/date |
| Render failure events/email | Failure-only setting documented | Pending actual setting and received test email |
| Neon diagnostic retention | Not an audit record; inspect current console | Pending retention/window/date |
| Neon near-limit emails | Confirm availability on selected Free plan | Pending actual supported warnings |
| Render/Neon quotas and restore allowance | Use live proportions, no fixed stale numeric limits | Pending current console allowance/date |
| Owner-only dashboard/log access and billing | Required | Pending console confirmation |

References: [Render logging](https://render.com/docs/logging), [notifications](https://render.com/docs/notifications), [Free limitations](https://render.com/docs/free), [Neon plans](https://neon.com/docs/introduction/plans). Recheck at setup. Provider documentation is preparation, not proof your account has those settings.

## Weekly quota and incident review

Weekly and after unusual traffic/build use, inspect Render Free instance hours, outbound bandwidth, build minutes, service state and last probe; Neon compute, storage, transfer/egress, endpoint state and restore window. Record only proportion, date and decision privately; never export URLs/queries/credentials.

- At 70% of any monthly allowance, investigate cause and forecast renewal/exhaustion.
- At 80%, or projected exhaustion before renewal, pause discretionary use and explicitly choose reduction, approved durable service or retirement.
- A quota-caused suspension forces graduation. Never add a payment method or enable automatic paid overage to “fix” the sandbox.

Stop deployments/discretionary traffic when continuing could worsen abuse, compromise, loss or exhaustion. Inspect the sanitized [incident record](./operations/incidents.md) for disruption and monthly recovery time. A failed candidate with a healthy previous instance and unaffected testers is an operational event, not a user-impacting incident.

## Reset and loss communication

Public docs always state synthetic disposable data, cold starts/reset, no uptime/recovery promise and no personal/irreplaceable information. Before planned reset, give known testers 72 hours of direct email notice and publish the same notice in /docs through reviewed configuration/content. The owner sends notices; this change sends no mail and does not enable outbound application email. Do not put recipient lists in source.

For emergency reset/unexpected loss, notify affected testers by the next business day: broad scope lost, whether deterministic reseeding succeeded, and no promised recovery. Then record sanitized impact/recovery/follow-up. Preserve private evidence separately and never publish exploit details or personal information.

## Seven forced graduation gates

Any one ends the unchanged Free posture and freezes new reliance and irreplaceable data until an explicit choice of durable beta, suitable topology, or retirement:

1. A user relies on continuity or requests non-disposable data.
2. An uptime, recovery or support-response commitment is needed.
3. Required recovery exceeds provider restore capability.
4. More than seven days of logs, native request logs, centralized search or shared access is needed.
5. Two user-impacting incidents occur in rolling 30 days.
6. Operational recovery takes more than two hours in one month.
7. One provider-quota suspension.

Before irreplaceable data: establish **daily off-provider backups**, maximum **24-hour recovery-point objective**, documented restoration and a successful restore rehearsal plus API smoke. Local synthetic restore preparation in #52 does not satisfy a live backup schedule. Buy only the guarantee a measured trigger requires. AWS evaluation follows [portability](./portability.md); no gate silently authorizes paid resources.

## Pending acceptance

First public deployment (#49), last actual probe success, failure-only workflow email received, provider notifications/retention/quota allowances, owner access and $0 controls all require live operator evidence. Keep these unchecked until recorded; script tests verify sequencing and sanitization only.
