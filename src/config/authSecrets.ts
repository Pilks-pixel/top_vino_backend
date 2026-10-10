export type SigningSecret = { version: number; value: string };

export function authSecretOptions(env: NodeJS.ProcessEnv = process.env): {
  secret?: string;
  secrets?: SigningSecret[];
} {
  const production = env.NODE_ENV === "production";
  const configured = env.BETTER_AUTH_SECRETS;
  if (production && !configured) {
    throw new Error(
      "Missing required environment variable: BETTER_AUTH_SECRETS",
    );
  }
  if (production && (env.BETTER_AUTH_SECRET || env.AUTH_SECRET)) {
    throw new Error(
      "Invalid environment variable: BETTER_AUTH_SECRET/AUTH_SECRET (production uses BETTER_AUTH_SECRETS)",
    );
  }
  if (configured === undefined) return { secret: env.BETTER_AUTH_SECRET };

  const invalid = () =>
    new Error("Invalid environment variable: BETTER_AUTH_SECRETS");
  let previousVersion = Infinity;
  const values = new Set<string>();
  const secrets = configured.split(",").map(entry => {
    const match = entry.match(/^(0|[1-9]\d*):([^\s,:]+)$/);
    if (!match) throw invalid();
    const version = Number(match[1]);
    const value = match[2];
    if (
      !Number.isSafeInteger(version) ||
      version >= previousVersion ||
      value.length < 32 ||
      values.has(value)
    ) {
      throw invalid();
    }
    previousVersion = version;
    values.add(value);
    return { version, value };
  });
  return { secrets };
}
