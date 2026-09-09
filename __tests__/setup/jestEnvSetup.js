// Runs in every Jest worker before any module is loaded.
// Forces DATABASE_URL to the test database, overriding any .env value.
process.env.DATABASE_URL =
  "postgresql://pete:hello_you@localhost:5432/top_vino_test";
process.env.NODE_ENV = "test";
process.env.PORT = "8001";
process.env.BETTER_AUTH_SECRET = "top-vino-test-only-secret";
process.env.BETTER_AUTH_URL = "http://localhost:8001";
