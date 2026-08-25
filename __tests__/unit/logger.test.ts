import { createLogger, resolveLogLevel } from "../../src/lib/logger.ts";

describe("resolveLogLevel", () => {
  it.each([
    ["development", "debug"],
    ["test", "silent"],
    ["staging", "info"],
    ["production", "info"],
  ])("defaults %s to %s", (environment, expectedLevel) => {
    expect(resolveLogLevel({ environment, logLevel: undefined })).toBe(
      expectedLevel,
    );
  });

  it.each(["trace", "debug", "info", "warn", "error", "fatal", "silent"])(
    "accepts %s as an override",
    logLevel => {
      expect(resolveLogLevel({ environment: "production", logLevel })).toBe(
        logLevel,
      );
    },
  );

  it("rejects an invalid LOG_LEVEL with a configuration error", () => {
    expect(() =>
      resolveLogLevel({ environment: "production", logLevel: "verbose" }),
    ).toThrow(
      'Invalid LOG_LEVEL "verbose". Expected one of: trace, debug, info, warn, error, fatal, silent.',
    );
  });
});

describe("createLogger", () => {
  it("writes to an injected destination without changing the environment", () => {
    const originalEnvironment = { ...process.env };
    const output: string[] = [];
    const destination = {
      write(message: string): void {
        output.push(message);
      },
    };

    const testLogger = createLogger({
      environment: "production",
      logLevel: "info",
      destination,
    });

    testLogger.info("captured message");

    expect(process.env).toEqual(originalEnvironment);
    expect(JSON.parse(output[0])).toMatchObject({
      level: 30,
      msg: "captured message",
    });
  });

  it("redacts credential fields from structured output", () => {
    const output: string[] = [];
    const destination = {
      write(message: string): void {
        output.push(message);
      },
    };

    const testLogger = createLogger({
      environment: "production",
      logLevel: "info",
      destination,
    });

    testLogger.info(
      {
        username: "safe-user",
        password: "password-secret",
        token: "token-secret",
        apiKey: "api-key-secret",
        nested: { password: "nested-password-secret" },
      },
      "structured data",
    );

    const logLine = output.join("");
    expect(logLine).toContain("safe-user");
    expect(logLine).not.toContain("password-secret");
    expect(logLine).not.toContain("token-secret");
    expect(logLine).not.toContain("api-key-secret");
    expect(logLine).not.toContain("nested-password-secret");
  });

  it("redacts sensitive fields in child bindings, arrays, and request headers natively", () => {
    const output: string[] = [];
    const destination = {
      write(message: string): void {
        output.push(message);
      },
    };

    const testLogger = createLogger({
      environment: "production",
      logLevel: "info",
      destination,
    });

    const childLogger = testLogger.child({
      req: {
        id: "req-123",
        method: "POST",
        url: "/login",
        headers: {
          host: "localhost",
          authorization: "Bearer super-secret-token",
          cookie: "session=sensitive-cookie-value",
          "set-cookie": ["secret-session=abc"],
          "x-api-key": "secret-x-key",
        },
      },
    });

    childLogger.info(
      {
        users: [
          {
            id: "1",
            refreshToken: "refresh-secret",
            email: "user@example.com",
          },
        ],
        deep: { level1: { level2: { secretKey: "secret-key-val" } } },
      },
      "processed auth request",
    );

    const logRecord = JSON.parse(output[0]) as {
      req: {
        headers: Record<string, unknown>;
      };
      users: Array<{ id: string; refreshToken: string; email: string }>;
      deep: { level1: { level2: { secretKey: string } } };
    };

    expect(logRecord.req.headers.host).toBe("localhost");
    expect(logRecord.req.headers.authorization).toBe("[Redacted]");
    expect(logRecord.req.headers.cookie).toBe("[Redacted]");
    expect(logRecord.req.headers["set-cookie"]).toBe("[Redacted]");
    expect(logRecord.req.headers["x-api-key"]).toBe("[Redacted]");
    expect(logRecord.users[0].email).toBe("user@example.com");
    expect(logRecord.users[0].refreshToken).toBe("[Redacted]");
    expect(logRecord.deep.level1.level2.secretKey).toBe("[Redacted]");

    const rawOutput = output.join("");
    expect(rawOutput).not.toContain("super-secret-token");
    expect(rawOutput).not.toContain("sensitive-cookie-value");
    expect(rawOutput).not.toContain("secret-session=abc");
    expect(rawOutput).not.toContain("secret-x-key");
    expect(rawOutput).not.toContain("refresh-secret");
    expect(rawOutput).not.toContain("secret-key-val");
  });
});
