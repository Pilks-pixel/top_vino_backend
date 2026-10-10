/** Origins are literal configuration values; no wildcard or suffix matching. */
export function reviewedBrowserOrigins(): string[] {
  const frontend =
    process.env.FRONTEND_URL ??
    (process.env.NODE_ENV === "production"
      ? undefined
      : "http://localhost:3000");
  const api = process.env.BETTER_AUTH_URL
    ? new URL(process.env.BETTER_AUTH_URL).origin
    : undefined;
  return [
    ...new Set(
      [api, frontend].filter((origin): origin is string => Boolean(origin)),
    ),
  ];
}

// Only the deployment's reviewed one-hop contract is supported. Never trust
// arbitrary chains or treat a generic truthy environment value as permission.
export function reviewedProxyTrust(): false | 1 {
  const configured = process.env.TRUST_PROXY;
  if (configured === undefined || configured === "false") return false;
  if (configured === "render-1") return 1;
  throw new Error("Invalid environment variable: TRUST_PROXY");
}

export const AUTH_CLIENT_IP_HEADER = "x-top-vino-client-ip";
