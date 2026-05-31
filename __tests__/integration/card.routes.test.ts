/**
 * Integration tests: card routes
 *
 * Tests against the real test database.
 * Cards are nested under decks: /deck/:deckId/cards
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

import request from "supertest";
import { app } from "../setup/testApp.js";
import { cleanDb, disconnectDb } from "../setup/testDb.js";
import {
  createTestUser,
  createTestDeck,
  createTestCard,
} from "../setup/factories.js";

beforeEach(async () => cleanDb());
afterAll(async () => disconnectDb());

const basicCard = {
  type: "basic",
  question: "What is the capital of France?",
  correctAnswer: "Paris",
};

// ─── POST /deck/:deckId/cards ─────────────────────────────────────────────────

describe("POST /deck/:deckId/cards", () => {
  it("creates a card and returns 201", async () => {
    const user = await createTestUser();
    const deck = await createTestDeck(user.id);
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
    const user = await createTestUser();
    const deck = await createTestDeck(user.id);
    const res = await request(app)
      .post(`/deck/${deck.id}/cards`)
      .send({ type: "basic", correctAnswer: "Paris" });
    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
  });

  it("returns 400 when type is invalid", async () => {
    const user = await createTestUser();
    const deck = await createTestDeck(user.id);
    const res = await request(app)
      .post(`/deck/${deck.id}/cards`)
      .send({ type: "flash_unknown", question: "Q?", correctAnswer: "A" });
    expect(res.status).toBe(400);
  });
});

// ─── GET /deck/:deckId/cards ──────────────────────────────────────────────────

describe("GET /deck/:deckId/cards", () => {
  it("returns all cards for a deck", async () => {
    const user = await createTestUser();
    const deck = await createTestDeck(user.id);
    await createTestCard(deck.id, { question: "Q1" });
    await createTestCard(deck.id, { question: "Q2" });
    const res = await request(app).get(`/deck/${deck.id}/cards`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it("returns empty array when deck has no cards", async () => {
    const user = await createTestUser();
    const deck = await createTestDeck(user.id);
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
});

// ─── GET /deck/:deckId/cards/:id ──────────────────────────────────────────────

describe("GET /deck/:deckId/cards/:id", () => {
  it("returns the card by id", async () => {
    const user = await createTestUser();
    const deck = await createTestDeck(user.id);
    const card = await createTestCard(deck.id);
    const res = await request(app).get(`/deck/${deck.id}/cards/${card.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(card.id);
  });

  it("returns 404 when card does not exist", async () => {
    const user = await createTestUser();
    const deck = await createTestDeck(user.id);
    const res = await request(app).get(
      `/deck/${deck.id}/cards/00000000-0000-0000-0000-000000000000`,
    );
    expect(res.status).toBe(404);
  });
});

// ─── PUT /deck/:deckId/cards/:id ──────────────────────────────────────────────

describe("PUT /deck/:deckId/cards/:id", () => {
  it("updates a card", async () => {
    const user = await createTestUser();
    const deck = await createTestDeck(user.id);
    const card = await createTestCard(deck.id);
    const res = await request(app)
      .put(`/deck/${deck.id}/cards/${card.id}`)
      .send({ question: "Updated question?" });
    expect(res.status).toBe(200);
    expect(res.body.data.question).toBe("Updated question?");
  });

  it("returns 404 for non-existent card", async () => {
    const user = await createTestUser();
    const deck = await createTestDeck(user.id);
    const res = await request(app)
      .put(`/deck/${deck.id}/cards/00000000-0000-0000-0000-000000000000`)
      .send({ question: "X" });
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /deck/:deckId/cards/:id ───────────────────────────────────────────

describe("DELETE /deck/:deckId/cards/:id", () => {
  it("deletes a card and returns success", async () => {
    const user = await createTestUser();
    const deck = await createTestDeck(user.id);
    const card = await createTestCard(deck.id);
    const res = await request(app).delete(`/deck/${deck.id}/cards/${card.id}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Card deleted successfully");
  });

  it("returns 404 for non-existent card", async () => {
    const user = await createTestUser();
    const deck = await createTestDeck(user.id);
    const res = await request(app).delete(
      `/deck/${deck.id}/cards/00000000-0000-0000-0000-000000000000`,
    );
    expect(res.status).toBe(404);
  });
});
