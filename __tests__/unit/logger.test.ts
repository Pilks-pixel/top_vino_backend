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
});
