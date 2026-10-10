// Runs in every Jest worker before any module is loaded.
// Forces DATABASE_URL to the test database, overriding any .env value.
const configuredTestUrl = new URL(
  process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    "postgresql://pete:hello_you@localhost:5432/top_vino_test",
);
configuredTestUrl.pathname = "/top_vino_test";
process.env.DATABASE_URL = configuredTestUrl.toString();
process.env.NODE_ENV = "test";
process.env.PORT = "8001";
process.env.BETTER_AUTH_SECRET = "top-vino-test-only-secret";
process.env.BETTER_AUTH_URL = "http://localhost:8001";
