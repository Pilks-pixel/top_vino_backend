import pino from "pino";

const REDACTED_VALUE = "[Redacted]";
const SENSITIVE_FIELDS = new Set([
  "accesskey",
  "accesstoken",
  "apikey",
  "authorization",
  "clientsecret",
  "cookie",
  "credential",
  "credentials",
  "csrftoken",
  "currentpassword",
  "idtoken",
  "jwt",
  "newpassword",
  "onetimecode",
  "password",
  "passwordconfirmation",
  "passwordhash",
  "privatekey",
  "proxyauthorization",
  "refreshtoken",
  "secret",
  "secretkey",
  "sessiontoken",
  "setcookie",
  "token",
  "totp",
  "verificationcode",
  "xapikey",
]);

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

function normalizeFieldName(fieldName: string): string {
  return fieldName.replace(/[-_]/g, "").toLowerCase();
}

function isSensitiveField(fieldName: string): boolean {
  const normalizedFieldName = normalizeFieldName(fieldName);

  return (
    SENSITIVE_FIELDS.has(normalizedFieldName) ||
    normalizedFieldName.endsWith("apikey") ||
    normalizedFieldName.endsWith("password") ||
    normalizedFieldName.endsWith("secret") ||
    normalizedFieldName.endsWith("token")
  );
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sanitizeStructuredValue(
  value: unknown,
  seen = new WeakMap<object, unknown>(),
): unknown {
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return seen.get(value);
    }

    const sanitizedArray: unknown[] = [];
    seen.set(value, sanitizedArray);
    value.forEach(item =>
      sanitizedArray.push(sanitizeStructuredValue(item, seen)),
    );
    return sanitizedArray;
  }

  if (value === null || typeof value !== "object" || !isPlainObject(value)) {
    return value;
  }

  if (seen.has(value)) {
    return seen.get(value);
  }

  const sanitizedObject = Object.create(null) as Record<string, unknown>;
  seen.set(value, sanitizedObject);

  for (const [fieldName, fieldValue] of Object.entries(value)) {
    sanitizedObject[fieldName] = isSensitiveField(fieldName)
      ? REDACTED_VALUE
      : sanitizeStructuredValue(fieldValue, seen);
  }

  return sanitizedObject;
}

function sanitizeLogLine(line: string): string {
  const trailingWhitespace = line.match(/\s*$/)?.[0] ?? "";
  const json = line.slice(0, line.length - trailingWhitespace.length);

  try {
    const sanitized = JSON.stringify(sanitizeStructuredValue(JSON.parse(json)));
    return sanitized === undefined ? line : `${sanitized}${trailingWhitespace}`;
  } catch {
    return line;
  }
}

export function serializeRequest(
  request: pino.SerializedRequest,
): Record<string, unknown> {
  return {
    id: request.id,
    method: request.method,
    url: request.url.split("?", 1)[0],
    headers: sanitizeStructuredValue(request.headers),
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
    hooks: { streamWrite: sanitizeLogLine },
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
