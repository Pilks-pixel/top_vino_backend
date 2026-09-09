/**
 * Returns the Express app instance for use with Supertest.
 *
 * Importing directly from src/app.ts ensures integration tests
 * exercise the full middleware stack (CORS, validation, error handler).
 */
import app from "../../src/app.ts";
import { disconnectPrisma } from "../../src/lib/prisma.ts";

afterAll(async () => {
  await disconnectPrisma();
});

export { app };
