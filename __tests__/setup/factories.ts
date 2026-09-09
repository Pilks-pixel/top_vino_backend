/**
 * Test data factories
 *
 * Each factory inserts a record into the test database and returns it.
 * Use these in beforeEach / test bodies to build fixture data.
 *
 * Every factory accepts a partial override so tests can vary specific fields.
 */
import { testPrisma } from "./testDb.ts";
import { randomUUID } from "node:crypto";
import type {
  User,
  Deck,
  Card,
  UserCardProgress,
  DeckCollaborator,
} from "../../generated/prisma/client.js";
import { CollaboratorRole } from "../../generated/prisma/index.js";
import type { SubscriptionTier } from "../../src/utils/userSchema.ts";

// ─── User ────────────────────────────────────────────────────────────────────

export async function createTestUser(
  overrides: Partial<{
    name: string;
    email: string;
    subscriptionType: SubscriptionTier;
  }> = {},
): Promise<User> {
  return testPrisma.user.create({
    data: {
      name: overrides.name ?? `Test User ${randomUUID().slice(0, 8)}`,
      email: overrides.email ?? `user-${randomUUID()}@test.com`,
      subscriptionType: overrides.subscriptionType ?? "FREE",
    },
  });
}

// ─── Deck ────────────────────────────────────────────────────────────────────

export async function createTestDeck(
  userId: string,
  overrides: Partial<{
    name: string;
    topic: string;
    isPublic: boolean;
  }> = {},
): Promise<Deck> {
  return testPrisma.deck.create({
    data: {
      userId,
      name: overrides.name ?? `Test Deck ${randomUUID().slice(0, 8)}`,
      topic: overrides.topic ?? "general",
      isPublic: overrides.isPublic ?? false,
    },
  });
}

// ─── Card ────────────────────────────────────────────────────────────────────

export async function createTestCard(
  deckId: string,
  overrides: Partial<{
    type: string;
    question: string;
    correctAnswer: string;
  }> = {},
): Promise<Card> {
  return testPrisma.card.create({
    data: {
      deckId,
      type: overrides.type ?? "basic",
      question: overrides.question ?? `Question ${randomUUID().slice(0, 8)}?`,
      correctAnswer:
        overrides.correctAnswer ?? `Answer ${randomUUID().slice(0, 8)}`,
      incorrectAnswers: [],
    },
  });
}

// ─── UserCardProgress ────────────────────────────────────────────────────────

export async function createTestProgress(
  userId: string,
  cardId: string,
  overrides: Partial<{
    nextReviewAt: Date;
    lastReviewedAt: Date;
    easeFactor: number;
    reviewCount: number;
    correctStreak: number;
  }> = {},
): Promise<UserCardProgress> {
  return testPrisma.userCardProgress.create({
    data: {
      userId,
      cardId,
      easeFactor: overrides.easeFactor ?? 2.5,
      reviewCount: overrides.reviewCount ?? 1,
      correctStreak: overrides.correctStreak ?? 0,
      lastReviewedAt: overrides.lastReviewedAt ?? new Date(),
      nextReviewAt: overrides.nextReviewAt ?? new Date(),
    },
  });
}

// ─── DeckCollaborator ─────────────────────────────────────────────────────────

export async function createTestDeckCollaborator(
  deckId: string,
  userId: string,
  role: "EDITOR" | "VIEWER" = "VIEWER",
): Promise<DeckCollaborator> {
  return testPrisma.deckCollaborator.create({
    data: {
      deckId,
      userId,
      role:
        role === "EDITOR" ? CollaboratorRole.EDITOR : CollaboratorRole.VIEWER,
    },
  });
}
