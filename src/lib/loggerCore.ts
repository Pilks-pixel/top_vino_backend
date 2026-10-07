import pino from "pino";

const REDACTED_VALUE = "[Redacted]";

// Credential-bearing field names are redacted from every log record
// project-wide, wherever they appear (top level, nested, or in arrays).
const SENSITIVE_FIELD_NAMES = [
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_SECRETS",
  "DATABASE_URL",
  "DIRECT_DATABASE_URL",
  "DIRECT_URL",
  "GOOGLE_CLIENT_SECRET",
  "SANDBOX_PROVISIONING_DATABASE_URL",
  "body",
  "requestBody",
  "databaseUrl",
  "directDatabaseUrl",
  "callbackURL",
  "errorCallbackURL",
  "newUserCallbackURL",
  "redirectTo",
  "accessKey",
  "accesskey",
  "accessToken",
  "accesstoken",
  "apiKey",
  "apikey",
  "authorization",
  "clientSecret",
  "clientsecret",
  "cookie",
  "credential",
  "credentials",
  "csrfToken",
  "csrftoken",
  "currentPassword",
  "currentpassword",
  "idToken",
  "idtoken",
  "jwt",
  "newPassword",
  "newpassword",
  "oneTimeCode",
  "onetimecode",
  "password",
  "passwordConfirmation",
  "passwordconfirmation",
  "passwordHash",
  "passwordhash",
  "privateKey",
  "privatekey",
  "proxyAuthorization",
  "proxyauthorization",
  "refreshToken",
  "refreshtoken",
  "secret",
  "secretKey",
  "secretkey",
  "sessionToken",
  "sessiontoken",
  "setCookie",
  "setcookie",
  "token",
  "totp",
  "verificationCode",
  "verificationcode",
  "xApiKey",
  "xapikey",
] as const;

/**
 * Redaction paths cover the sensitive field names at every nesting depth
 * the app logs, plus the credential-bearing HTTP headers that appear on
 * serialized requests.
 */
export const DEFAULT_REDACT_PATHS: string[] = [
  ...SENSITIVE_FIELD_NAMES.flatMap(field => [
    field,
    `*.${field}`,
    `*.*.${field}`,
    `*.*.*.${field}`,
    `*[*].${field}`,
    `*.*[*].${field}`,
    `req.headers.${field}`,
    `headers.${field}`,
    `req.headers["${field}"]`,
    `headers["${field}"]`,
  ]),
  'req.headers["set-cookie"]',
  'headers["set-cookie"]',
  'req.headers["x-api-key"]',
  'headers["x-api-key"]',
  'req.headers["proxy-authorization"]',
  'headers["proxy-authorization"]',
  'req.headers["x-access-token"]',
  'headers["x-access-token"]',
  'req.headers["x-auth-token"]',
  'headers["x-auth-token"]',
];

const LOG_LEVELS = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
  "silent",
] as const;

type LogLevel = (typeof LOG_LEVELS)[number];

interface LoggerOptions {
  environment?: string;
  logLevel?: string;
  destination?: pino.DestinationStream;
}
/**
 * Serializes the safe subset of a request: method, path without the query
 * string, redacted headers, and connection metadata. Request bodies and raw
 * query strings never appear in automatic logs.
 */
export function serializeRequest(
  request: pino.SerializedRequest,
): Record<string, unknown> {
  return {
    id: request.id,
    method: request.method,
    url: safeRequestPath(request.url),
    // Unknown headers, Origin and Referer may contain credentials or URLs.
    // Retain only the transport metadata needed to investigate a request.
    headers: {
      host: request.headers.host,
      "content-type": request.headers["content-type"],
      "content-length": request.headers["content-length"],
    },
    remoteAddress: request.remoteAddress,
    remotePort: request.remotePort,
  };
}

/** Log route shapes, never arbitrary paths or token-bearing path parameters. */
export function safeRequestPath(url: string): string {
  const path = url.split("?", 1)[0];
  const publicPaths = [
    "/",
    "/health",
    "/ready",
    "/docs",
    "/robots.txt",
    "/openapi.json",
  ];
  if (publicPaths.includes(path)) return path;
  if (path.startsWith("/api/auth/")) {
    const known = [
      "/sign-in/email",
      "/sign-up/email",
      "/sign-out",
      "/get-session",
      "/list-sessions",
      "/change-password",
      "/revoke-session",
      "/revoke-sessions",
      "/revoke-other-sessions",
      "/open-api/generate-schema",
    ];
    return known.includes(path.slice("/api/auth".length))
      ? path
      : "/api/auth/[unavailable]";
  }
  if (/^\/user\/?$/.test(path) || path === "/user/me") return path;
  if (/^\/user\/[^/]+\/?$/.test(path)) return "/user/:userId";
  if (/^\/deck\/?$/.test(path)) return path;
  if (/^\/deck\/[^/]+\/?$/.test(path)) return "/deck/:deckId";
  if (/^\/deck\/[^/]+\/cards\/?$/.test(path)) return "/deck/:deckId/cards";
  if (/^\/deck\/[^/]+\/cards\/[^/]+\/?$/.test(path))
    return "/deck/:deckId/cards/:cardId";
  if (/^\/review\/?$/.test(path) || path === "/review/due") return path;
  if (/^\/review\/progress\/[^/]+\/?$/.test(path))
    return "/review/progress/:cardId";
  return "/[unmatched]";
}

export function serializeResponse(
  response: pino.SerializedResponse,
): Record<string, unknown> {
  return { statusCode: response.statusCode };
}

export function isLogLevel(value: string): value is LogLevel {
  return (LOG_LEVELS as readonly string[]).includes(value);
}

/**
 * Resolves the active log level.
 *
 * LOG_LEVEL is an explicit override: when set it must be one of the pino
 * levels, and an invalid value fails startup with a configuration error.
 * Without an override the level follows the environment: debug in
 * development, silent in test, info in staging and production.
 */
export function resolveLogLevel(
  options: Pick<LoggerOptions, "environment" | "logLevel"> = {},
): LogLevel {
  const environment =
    options.environment ?? process.env.NODE_ENV ?? "development";
  const configuredLevel = Object.hasOwn(options, "logLevel")
    ? options.logLevel
    : process.env.LOG_LEVEL;

  if (configuredLevel !== undefined) {
    if (!isLogLevel(configuredLevel)) {
      throw new Error(
        `Invalid LOG_LEVEL "${configuredLevel}". Expected one of: ${LOG_LEVELS.join(", ")}.`,
      );
    }

    return configuredLevel;
  }

  switch (environment) {
    case "development":
      return "debug";
    case "test":
      return "silent";
    case "staging":
    case "production":
    default:
      return "info";
  }
}

/**
 * Creates the application logger.
 *
 * Production emits structured JSON to stdout; development formats the same
 * records through pino-pretty. Tests inject a destination stream instead of
 * writing to stdout.
 */
export function createLogger(options: LoggerOptions = {}): pino.Logger {
  const environment =
    options.environment ?? process.env.NODE_ENV ?? "development";
  const loggerOptions: pino.LoggerOptions = {
    level: resolveLogLevel(options),
    redact: {
      paths: DEFAULT_REDACT_PATHS,
      censor: REDACTED_VALUE,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (environment === "development" && options.destination === undefined) {
    loggerOptions.transport = {
      target: "pino-pretty",
      options: { colorize: true },
    };
  }

  return options.destination === undefined
    ? pino(loggerOptions)
    : pino(loggerOptions, options.destination);
}
