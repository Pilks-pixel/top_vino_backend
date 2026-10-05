import { isLogLevel } from "../lib/loggerCore.ts";
import { authSecretOptions } from "../config/authSecrets.ts";

const REQUIRED_ENV_VARS = ["DATABASE_URL", "BETTER_AUTH_URL"] as const;

function invalid(name: string): never {
  throw new Error(`Invalid environment variable: ${name}`);
}

function parseUrl(name: string): URL {
  const value = process.env[name]!;
  try {
    if (value !== value.trim()) invalid(name);
    return new URL(value);
  } catch {
    return invalid(name);
  }
}

function validateHttpUrl(name: string, production: boolean): void {
  const url = parseUrl(name);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    (production && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    url.hostname.includes("*") ||
    (name === "FRONTEND_URL" && process.env[name] !== url.origin)
  ) {
    invalid(name);
  }
}

function validateDatabaseOptions(database: URL): void {
  // Option types match the native PostgreSQL parser in the locked Prisma 6.9 engine.
  const numericOptions: Record<string, number> = {
    connection_limit: 1,
    connect_timeout: 0,
    pool_timeout: 0,
    socket_timeout: 0,
    statement_cache_size: 0,
    max_connection_lifetime: 0,
    max_idle_connection_lifetime: 0,
  };
  const enumOptions: Record<string, readonly string[]> = {
    pgbouncer: ["true", "false"],
    single_use_connections: ["true", "false"],
    sslmode: ["disable", "prefer", "require"],
    sslaccept: ["strict", "accept_invalid_certs"],
    channel_binding: ["disable", "prefer", "require"],
  };
  for (const [name, value] of database.searchParams) {
    if (database.searchParams.getAll(name).length !== 1)
      invalid("DATABASE_URL");
    if (Object.hasOwn(numericOptions, name)) {
      const number = Number(value);
      if (
        !/^\d+$/.test(value) ||
        !Number.isSafeInteger(number) ||
        number < numericOptions[name]
      ) {
        invalid("DATABASE_URL");
      }
    }
    if (
      Object.hasOwn(enumOptions, name) &&
      !enumOptions[name].includes(value)
    ) {
      invalid("DATABASE_URL");
    }
  }
}

export function validateEnv(): { port: number } {
  const environment = process.env.NODE_ENV ?? "development";
  if (!["development", "test", "staging", "production"].includes(environment)) {
    invalid("NODE_ENV");
  }
  const production = environment === "production";
  const secretVariable =
    production || process.env.BETTER_AUTH_SECRETS !== undefined
      ? "BETTER_AUTH_SECRETS"
      : "BETTER_AUTH_SECRET";
  const requiredVars: readonly string[] = [
    REQUIRED_ENV_VARS[0],
    secretVariable,
    REQUIRED_ENV_VARS[1],
    ...(production ? ["FRONTEND_URL", "PORT"] : []),
  ];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`,
    );
  }

  const configuredPort = process.env.PORT ?? "8000";
  const port = Number(configuredPort);
  if (!/^\d+$/.test(configuredPort) || port < 1 || port > 65535) {
    invalid("PORT");
  }

  const database = parseUrl("DATABASE_URL");
  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !database.hostname ||
    database.pathname.length <= 1 ||
    database.hash
  ) {
    invalid("DATABASE_URL");
  }
  validateDatabaseOptions(database);
  authSecretOptions();
  validateHttpUrl("BETTER_AUTH_URL", production);
  if (process.env.FRONTEND_URL !== undefined) {
    validateHttpUrl("FRONTEND_URL", production);
  }
  const logLevel = process.env.LOG_LEVEL;
  if (logLevel !== undefined && !isLogLevel(logLevel)) {
    invalid("LOG_LEVEL");
  }
  if (
    Boolean(process.env.GOOGLE_CLIENT_ID) !==
    Boolean(process.env.GOOGLE_CLIENT_SECRET)
  ) {
    invalid("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET");
  }

  return { port };
}
