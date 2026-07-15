/**
 * Test data factories
 *
 * Each factory inserts a record into the test database and returns it.
 * Use these in beforeEach / test bodies to build fixture data.
 *
 * Every factory accepts a partial override so tests can vary specific fields.
 */
import { testPrisma } from "./testDb.js";
import type { User, Deck, Card } from "../../generated/prisma/client.js";

// ─── User ────────────────────────────────────────────────────────────────────

let userCounter = 0;

export async function createTestUser(
  overrides: Partial<{
    name: string;
    email: string;
    subscriptionType: "FREE" | "PRO";
  }> = {},
): Promise<User> {
  userCounter++;
  return testPrisma.user.create({
    data: {
      name: overrides.name ?? `Test User ${userCounter}`,
      email: overrides.email ?? `user${userCounter}@test.com`,
      subscriptionType: overrides.subscriptionType ?? "FREE",
    },
  });
}

// ─── Deck ────────────────────────────────────────────────────────────────────

let deckCounter = 0;

export async function createTestDeck(
  userId: string,
  overrides: Partial<{
    name: string;
    topic: string;
    isPublic: boolean;
  }> = {},
): Promise<Deck> {
  deckCounter++;
  return testPrisma.deck.create({
    data: {
      userId,
      name: overrides.name ?? `Test Deck ${deckCounter}`,
      topic: overrides.topic ?? "general",
      isPublic: overrides.isPublic ?? false,
    },
  });
}

// ─── Card ────────────────────────────────────────────────────────────────────

let cardCounter = 0;

export async function createTestCard(
  deckId: string,
  overrides: Partial<{
    type: string;
    question: string;
    correctAnswer: string;
  }> = {},
): Promise<Card> {
  cardCounter++;
  return testPrisma.card.create({
    data: {
      deckId,
      type: overrides.type ?? "basic",
      question: overrides.question ?? `Question ${cardCounter}?`,
      correctAnswer: overrides.correctAnswer ?? `Answer ${cardCounter}`,
      incorrectAnswers: [],
    },
  });
}
