/**
 * Test database helper
 *
 * Provides a Prisma client wired to the test database,
 * and a cleanDb() function that TRUNCATEs all tables
 * with CASCADE before each test (called in beforeEach hooks).
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

import { PrismaClient } from "../../generated/prisma/client.js";

export const testPrisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

/**
 * Truncates all application tables in dependency order.
 * Call in beforeEach to guarantee test isolation.
 */
export async function cleanDb(): Promise<void> {
  // Delete in reverse-dependency order to avoid FK violations
  await testPrisma.$executeRawUnsafe(
    `TRUNCATE TABLE
      "account",
      "session",
      "verification",
      "UserCardReview",
      "UserResponse",
      "UserCardProgress",
      "Card",
      "DeckCollaborator",
      "Deck",
      "user"
    RESTART IDENTITY CASCADE`,
  );
}

/**
 * Disconnect the test Prisma client.
 * Call in afterAll.
 */
export async function disconnectDb(): Promise<void> {
  await testPrisma.$disconnect();
}
