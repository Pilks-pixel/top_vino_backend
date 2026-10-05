// Production stays at the pre-frontend stage until a reviewed change enables
// another capability. The upstream schema remains a broader capability reference.
const sandboxCapabilities = new Set([
  "POST /sign-in/email",
  "POST /sign-out",
  "GET /get-session",
  "GET /list-sessions",
  "POST /change-password",
  "POST /revoke-session",
  "POST /revoke-sessions",
  "POST /revoke-other-sessions",
]);

export function isSandboxAuthCapability(method: string, path: string): boolean {
  return sandboxCapabilities.has(`${method} ${path}`);
}
