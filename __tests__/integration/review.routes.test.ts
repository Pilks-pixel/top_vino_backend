/**
 * Integration tests: review routes
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

// ─── POST /review ─────────────────────────────────────────────────────────────

describe("POST /review", () => {
  it("creates a review and returns 201", async () => {
    const user = await createTestUser();
    const deck = await createTestDeck(user.id);
    const card = await createTestCard(deck.id);
    const res = await request(app).post("/review").send({
      userId: user.id,
      cardId: card.id,
      quality: 4,
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.review).toBeDefined();
    expect(res.body.data.progress).toBeDefined();
  });

  it("returns 404 when card does not exist", async () => {
    const user = await createTestUser();
    const res = await request(app).post("/review").send({
      userId: user.id,
      cardId: "00000000-0000-0000-0000-000000000000",
      quality: 3,
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 when quality is out of range", async () => {
    const user = await createTestUser();
    const deck = await createTestDeck(user.id);
    const card = await createTestCard(deck.id);
    const res = await request(app).post("/review").send({
      userId: user.id,
      cardId: card.id,
      quality: 10,
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app).post("/review").send({ quality: 3 });
    expect(res.status).toBe(400);
  });
});

// ─── GET /review/due?userId= ──────────────────────────────────────────────────

describe("GET /review/due", () => {
  it("returns due cards for a user", async () => {
    const user = await createTestUser();
    const deck = await createTestDeck(user.id);
    // Why is createTestCard called twice?
    await createTestCard(deck.id);
    // Submit a review so progress exists
    const card = await createTestCard(deck.id);
    await request(app)
      .post("/review")
      .send({ userId: user.id, cardId: card.id, quality: 0 });
    const res = await request(app).get(`/review/due?userId=${user.id}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("returns 400 when userId is missing", async () => {
    const res = await request(app).get("/review/due");
    expect(res.status).toBe(400);
  });
});

// ─── GET /review/progress/:userId/:cardId ─────────────────────────────────────

describe("GET /review/progress/:userId/:cardId", () => {
  it("returns progress for a user+card pair", async () => {
    const user = await createTestUser();
    const deck = await createTestDeck(user.id);
    const card = await createTestCard(deck.id);
    // Create progress by submitting a review
    await request(app)
      .post("/review")
      .send({ userId: user.id, cardId: card.id, quality: 4 });
    const res = await request(app).get(
      `/review/progress/${user.id}/${card.id}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBe(user.id);
    expect(res.body.data.cardId).toBe(card.id);
  });

  it("returns 404 when progress does not exist", async () => {
    const user = await createTestUser();
    const res = await request(app).get(
      `/review/progress/${user.id}/00000000-0000-0000-0000-000000000000`,
    );
    expect(res.status).toBe(404);
  });
});
