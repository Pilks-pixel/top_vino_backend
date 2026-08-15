import pino from "pino";

const REDACTED_VALUE = "[Redacted]";

const SENSITIVE_FIELD_NAMES = [
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

export type LogLevel = (typeof LOG_LEVELS)[number];

export interface LoggerOptions {
  environment?: string;
  logLevel?: string;
  destination?: pino.DestinationStream;
}

export function serializeRequest(
  request: pino.SerializedRequest,
): Record<string, unknown> {
  return {
    id: request.id,
    method: request.method,
    url: request.url.split("?", 1)[0],
    headers: request.headers,
    remoteAddress: request.remoteAddress,
    remotePort: request.remotePort,
  };
}

export function serializeResponse(
  response: pino.SerializedResponse,
): Record<string, unknown> {
  return { statusCode: response.statusCode };
}

function isLogLevel(value: string): value is LogLevel {
  return (LOG_LEVELS as readonly string[]).includes(value);
}

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

export const logger = createLogger();
