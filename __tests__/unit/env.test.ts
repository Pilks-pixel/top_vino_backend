import { validateEnv } from "../../src/utils/env.ts";

describe("validateEnv", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.DATABASE_URL = "postgresql://localhost:5432/top_vino";
    process.env.BETTER_AUTH_SECRET = "some-super-secret-key-at-least-32-chars";
    process.env.BETTER_AUTH_URL = "http://localhost:8000";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

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
});
