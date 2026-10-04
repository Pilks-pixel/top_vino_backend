export const sandboxWarning =
  "This sandbox uses synthetic disposable data, may sleep or reset, and has no uptime or recovery promise. Do not enter personal or irreplaceable information.";

export const authCapabilityWarning =
  "Better Auth capability reference: advertised routes may be disabled. A schema entry does not guarantee that a capability is available. Public sign-up, email recovery and verification, and Google OAuth require separate deployment prerequisites.";

export const sandboxNotice = `<aside aria-label="Sandbox notice" style="padding:1rem;border-bottom:2px solid #92400e;background:#fef3c7;color:#451a03"><strong>Disposable sandbox</strong><p>${sandboxWarning}</p><p>${authCapabilityWarning}</p></aside>`;

export const rootPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Top Vino API sandbox</title></head><body><h1>Top Vino API sandbox</h1>${sandboxNotice}<p><a href="/docs">Browse the API reference</a></p></body></html>`;
