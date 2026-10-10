import { validateEnv } from "../../src/utils/env.ts";

describe("validateEnv", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.DATABASE_URL = "postgresql://localhost:5432/top_vino";
    process.env.BETTER_AUTH_SECRET = "some-super-secret-key-at-least-32-chars";
    process.env.BETTER_AUTH_URL = "http://localhost:8000";
    delete process.env.BETTER_AUTH_SECRETS;
    delete process.env.AUTH_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function productionEnv() {
    process.env.NODE_ENV = "production";
    process.env.PORT = "8000";
    process.env.BETTER_AUTH_URL = "https://api.example.test";
    process.env.FRONTEND_URL = "https://frontend.example.test";
    process.env.BETTER_AUTH_SECRETS =
      "1:synthetic-production-signing-secret-at-least-32-characters";
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.LOG_LEVEL;
  }

  it("throws when DATABASE_URL is missing", () => {
    delete process.env.DATABASE_URL;

    expect(() => validateEnv()).toThrow(Error);
    expect(() => validateEnv()).toThrow(/DATABASE_URL/);
  });

  it("throws when BETTER_AUTH_SECRET is missing", () => {
    delete process.env.BETTER_AUTH_SECRET;

    expect(() => validateEnv()).toThrow(Error);
    expect(() => validateEnv()).toThrow(/BETTER_AUTH_SECRET/);
  });

  it("throws when BETTER_AUTH_URL is missing", () => {
    delete process.env.BETTER_AUTH_URL;

    expect(() => validateEnv()).toThrow(Error);
    expect(() => validateEnv()).toThrow(/BETTER_AUTH_URL/);
  });

  it("throws listing all missing vars when multiple are missing", () => {
    delete process.env.DATABASE_URL;
    delete process.env.BETTER_AUTH_SECRET;

    expect(() => validateEnv()).toThrow(
      "Missing required environment variables: DATABASE_URL, BETTER_AUTH_SECRET",
    );
  });

  it("returns without throwing when all required vars are set", () => {
    expect(() => validateEnv()).not.toThrow();
  });

  it("requires versioned signing secrets in production even when a valid singular secret exists", () => {
    productionEnv();
    delete process.env.BETTER_AUTH_SECRETS;
    process.env.BETTER_AUTH_SECRET = "some-super-secret-key-at-least-32-chars";
    expect(() => validateEnv()).toThrow(/BETTER_AUTH_SECRETS/);
  });

  it.each([
    "",
    "private-malformed-secret",
    "1:private-short-secret",
    "1junk:private-signing-secret-longer-than-32-characters",
    "-1:private-signing-secret-longer-than-32-characters",
    "9007199254740992:private-signing-secret-longer-than-32-characters",
    "1:private-signing-secret-longer-than-32-characters,1:other-private-secret-longer-than-32-characters",
    "1:private-signing-secret-longer-than-32-characters,2:other-private-secret-longer-than-32-characters",
    "2:private-signing-secret-longer-than-32-characters,1:private-signing-secret-longer-than-32-characters",
    "1: private-signing-secret-longer-than-32-characters",
    "1:private-signing-secret-longer-than-32-characters,",
  ])(
    "rejects malformed production versioned secrets without exposing their values (%#)",
    value => {
      productionEnv();
      process.env.BETTER_AUTH_SECRETS = value;
      expect(() => validateEnv()).toThrow(/BETTER_AUTH_SECRETS/);
      try {
        validateEnv();
      } catch (error) {
        expect((error as Error).message).not.toContain("private-");
      }
    },
  );

  it("accepts overlapping keys with the highest version first and no singular production secret", () => {
    productionEnv();
    process.env.BETTER_AUTH_SECRETS =
      "3:current-synthetic-signing-secret-at-least-32-characters,1:previous-synthetic-signing-secret-at-least-32-characters";
    expect(() => validateEnv()).not.toThrow();
  });

  it("requires an explicit browser origin in production", () => {
    productionEnv();
    delete process.env.FRONTEND_URL;

    expect(() => validateEnv()).toThrow(/FRONTEND_URL/);
  });

  it.each([
    ["PORT", "0"],
    ["PORT", "65536"],
    ["PORT", "8000.5"],
    ["PORT", "8000junk"],
    ["PORT", " 8000 "],
    ["DATABASE_URL", "https://user:private-password@example.test/db"],
    ["DATABASE_URL", "postgresql://localhost"],
    ["DATABASE_URL", "postgresql://localhost/db?connection_limit=invalid"],
    ["DATABASE_URL", "postgresql://localhost/db?connection_limit=0"],
    ["DATABASE_URL", "postgresql://localhost/db?connect_timeout=-1"],
    ["DATABASE_URL", "postgresql://localhost/db?pool_timeout=1.5"],
    ["DATABASE_URL", "postgresql://localhost/db?pgbouncer=invalid"],
    [
      "DATABASE_URL",
      "postgresql://localhost/db?max_connection_lifetime=invalid",
    ],
    [
      "DATABASE_URL",
      "postgresql://localhost/db?max_idle_connection_lifetime=-1",
    ],
    [
      "DATABASE_URL",
      "postgresql://localhost/db?single_use_connections=invalid",
    ],
    ["DATABASE_URL", "postgresql://localhost/db?sslmode=invalid"],
    [
      "DATABASE_URL",
      "postgresql://localhost/db?connection_limit=5&connection_limit=6",
    ],
    ["BETTER_AUTH_SECRET", "private-short-secret"],
    ["BETTER_AUTH_URL", "http://api.example.test"],
    ["BETTER_AUTH_URL", "https://user:private-password@api.example.test"],
    ["FRONTEND_URL", "https://frontend.example.test/path"],
    ["FRONTEND_URL", "https://*.example.test"],
    ["FRONTEND_URL", "https://frontend.example.test/"],
    ["FRONTEND_URL", "*"],
    ["LOG_LEVEL", "private-invalid-level"],
    ["NODE_ENV", "prduction"],
  ])("rejects invalid %s without exposing its value", (name, value) => {
    productionEnv();
    process.env[name] = value;

    expect(() => validateEnv()).toThrow(new RegExp(name));
    try {
      validateEnv();
    } catch (error) {
      expect((error as Error).message).not.toContain(value);
    }
  });

  it("allows deferred OAuth but rejects a partial provider configuration", () => {
    productionEnv();
    expect(() => validateEnv()).not.toThrow();
    process.env.GOOGLE_CLIENT_ID = "synthetic-client";
    expect(() => validateEnv()).toThrow(/GOOGLE_CLIENT/);
  });

  it("returns a numeric validated port rather than a Unix socket path", () => {
    productionEnv();
    process.env.PORT = "49152";
    expect(validateEnv()).toEqual({ port: 49152 });
  });

  it("accepts the resolved PostgreSQL pool settings without connecting", () => {
    productionEnv();
    process.env.DATABASE_URL =
      "postgresql://localhost/db?connection_limit=5&connect_timeout=15&pool_timeout=10&sslmode=require";
    expect(() => validateEnv()).not.toThrow();
  });
});
