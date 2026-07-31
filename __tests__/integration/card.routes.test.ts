/**
 * Integration tests: card routes
 *
 * Tests against the real test database with mocked Better Auth sessions.
 * Cards are nested under decks: /deck/:deckId/cards
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

import { jest } from "@jest/globals";

// Mock auth BEFORE importing app
jest.unstable_mockModule("../../src/lib/auth.js", () => ({
  auth: {
    api: { getSession: jest.fn() },
    handler: jest.fn(),
  },
}));

const request = (await import("supertest")).default;
const { auth } = await import("../../src/lib/auth.js");
const { app } = await import("../setup/testApp.js");
const { cleanDb, disconnectDb } = await import("../setup/testDb.js");
const { createTestUser, createTestDeck, createTestCard } = await import(
  "../setup/factories.js"
);

let testUser: { id: string; email: string; subscriptionType: string };

beforeEach(async () => {
  await cleanDb();
  testUser = await createTestUser();
  (
    auth.api.getSession as unknown as ReturnType<typeof jest.fn>
  ).mockResolvedValue({
    user: {
      id: testUser.id,
      email: testUser.email,
      subscriptionType: "FREE",
    },
    session: {},
  });
});

afterAll(async () => disconnectDb());

const basicCard = {
  type: "basic",
  question: "What is the capital of France?",
  correctAnswer: "Paris",
};

// ─── POST /deck/:deckId/cards ─────────────────────────────────────────────────

describe("POST /deck/:deckId/cards", () => {
  it("creates a card and returns 201", async () => {
    const deck = await createTestDeck(testUser.id);
    const res = await request(app)
      .post(`/deck/${deck.id}/cards`)
      .send(basicCard);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.question).toBe(basicCard.question);
    expect(res.body.data.deckId).toBe(deck.id);
  });

  it("returns 404 when deck does not exist", async () => {
    const res = await request(app)
      .post("/deck/00000000-0000-0000-0000-000000000000/cards")
      .send(basicCard);
    expect(res.status).toBe(404);
  });

  it("returns 400 when question is missing", async () => {
    const deck = await createTestDeck(testUser.id);
    const res = await request(app)
      .post(`/deck/${deck.id}/cards`)
      .send({ type: "basic", correctAnswer: "Paris" });
    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
  });

  it("returns 400 when type is invalid", async () => {
    const deck = await createTestDeck(testUser.id);
    const res = await request(app)
      .post(`/deck/${deck.id}/cards`)
      .send({ type: "flash_unknown", question: "Q?", correctAnswer: "A" });
    expect(res.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    const deck = await createTestDeck(testUser.id);
    (
      auth.api.getSession as unknown as ReturnType<typeof jest.fn>
    ).mockResolvedValueOnce(null);

    const res = await request(app)
      .post(`/deck/${deck.id}/cards`)
      .send(basicCard);

    expect(res.status).toBe(401);
  });
});

// ─── GET /deck/:deckId/cards ──────────────────────────────────────────────────

describe("GET /deck/:deckId/cards", () => {
  it("returns all cards for a deck", async () => {
    const deck = await createTestDeck(testUser.id);
    await createTestCard(deck.id, { question: "Q1" });
    await createTestCard(deck.id, { question: "Q2" });
    const res = await request(app).get(`/deck/${deck.id}/cards`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it("returns empty array when deck has no cards", async () => {
    const deck = await createTestDeck(testUser.id);
    const res = await request(app).get(`/deck/${deck.id}/cards`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("returns 404 when deck does not exist", async () => {
    const res = await request(app).get(
      "/deck/00000000-0000-0000-0000-000000000000/cards",
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    const deck = await createTestDeck(testUser.id);
    (
      auth.api.getSession as unknown as ReturnType<typeof jest.fn>
    ).mockResolvedValueOnce(null);

    const res = await request(app).get(`/deck/${deck.id}/cards`);

    expect(res.status).toBe(401);
  });
});

// ─── GET /deck/:deckId/cards/:id ──────────────────────────────────────────────

describe("GET /deck/:deckId/cards/:id", () => {
  it("returns the card by id", async () => {
    const deck = await createTestDeck(testUser.id);
    const card = await createTestCard(deck.id);
    const res = await request(app).get(`/deck/${deck.id}/cards/${card.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(card.id);
  });

  it("returns 404 when card does not exist", async () => {
    const deck = await createTestDeck(testUser.id);
    const res = await request(app).get(
      `/deck/${deck.id}/cards/00000000-0000-0000-0000-000000000000`,
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    const deck = await createTestDeck(testUser.id);
    const card = await createTestCard(deck.id);
    (
      auth.api.getSession as unknown as ReturnType<typeof jest.fn>
    ).mockResolvedValueOnce(null);

    const res = await request(app).get(`/deck/${deck.id}/cards/${card.id}`);

    expect(res.status).toBe(401);
  });
});

// ─── PUT /deck/:deckId/cards/:id ──────────────────────────────────────────────

describe("PUT /deck/:deckId/cards/:id", () => {
  it("updates a card", async () => {
    const deck = await createTestDeck(testUser.id);
    const card = await createTestCard(deck.id);
    const res = await request(app)
      .put(`/deck/${deck.id}/cards/${card.id}`)
      .send({ question: "Updated question?" });
    expect(res.status).toBe(200);
    expect(res.body.data.question).toBe("Updated question?");
  });

  it("returns 404 for non-existent card", async () => {
    const deck = await createTestDeck(testUser.id);
    const res = await request(app)
      .put(`/deck/${deck.id}/cards/00000000-0000-0000-0000-000000000000`)
      .send({ question: "X" });
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    const deck = await createTestDeck(testUser.id);
    const card = await createTestCard(deck.id);
    (
      auth.api.getSession as unknown as ReturnType<typeof jest.fn>
    ).mockResolvedValueOnce(null);

    const res = await request(app)
      .put(`/deck/${deck.id}/cards/${card.id}`)
      .send({ question: "Updated question?" });

    expect(res.status).toBe(401);
  });
});

// ─── DELETE /deck/:deckId/cards/:id ───────────────────────────────────────────

describe("DELETE /deck/:deckId/cards/:id", () => {
  it("deletes a card and returns success", async () => {
    const deck = await createTestDeck(testUser.id);
    const card = await createTestCard(deck.id);
    const res = await request(app).delete(`/deck/${deck.id}/cards/${card.id}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Card deleted successfully");
  });

  it("returns 404 for non-existent card", async () => {
    const deck = await createTestDeck(testUser.id);
    const res = await request(app).delete(
      `/deck/${deck.id}/cards/00000000-0000-0000-0000-000000000000`,
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    const deck = await createTestDeck(testUser.id);
    const card = await createTestCard(deck.id);
    (
      auth.api.getSession as unknown as ReturnType<typeof jest.fn>
    ).mockResolvedValueOnce(null);

    const res = await request(app).delete(`/deck/${deck.id}/cards/${card.id}`);

    expect(res.status).toBe(401);
  });
});
