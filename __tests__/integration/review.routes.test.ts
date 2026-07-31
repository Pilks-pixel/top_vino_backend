/**
 * Integration tests: review routes
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
const { createTestUser, createTestDeck, createTestCard, createTestProgress } =
  await import("../setup/factories.js");

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

// ─── POST /review ─────────────────────────────────────────────────────────────

describe("POST /review", () => {
  it("creates a review and returns 201", async () => {
    const deck = await createTestDeck(testUser.id);
    const card = await createTestCard(deck.id);

    const res = await request(app).post("/review").send({
      cardId: card.id,
      quality: 4,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.review).toBeDefined();
    expect(res.body.data.progress).toBeDefined();
  });

  it("returns 404 when card does not exist", async () => {
    const res = await request(app).post("/review").send({
      cardId: "00000000-0000-0000-0000-000000000000",
      quality: 3,
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 when quality is out of range", async () => {
    const deck = await createTestDeck(testUser.id);
    const card = await createTestCard(deck.id);

    const res = await request(app).post("/review").send({
      cardId: card.id,
      quality: 10,
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app).post("/review").send({ quality: 3 });
    expect(res.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    (
      auth.api.getSession as unknown as ReturnType<typeof jest.fn>
    ).mockResolvedValueOnce(null);

    const res = await request(app).post("/review").send({
      cardId: "00000000-0000-0000-0000-000000000000",
      quality: 3,
    });

    expect(res.status).toBe(401);
  });
});

describe("multi-review sequence", () => {
  it("follows SM-2 interval progression across five successful reviews", async () => {
    const dayMs = 24 * 60 * 60 * 1000;
    const expectedIntervals = [1, 6, 15, 38, 95];

    const user = await createTestUser();
    const deck = await createTestDeck(user.id);
    const card = await createTestCard(deck.id);

    for (const expectedDays of expectedIntervals) {
      const requestStart = Date.now();
      const res = await request(app).post("/review").send({
        userId: user.id,
        cardId: card.id,
        quality: 4,
      });

      expect(res.status).toBe(201);
      const nextReviewAt = new Date(
        res.body.data.progress.nextReviewAt,
      ).getTime();
      const deltaMs = nextReviewAt - requestStart;
      const expectedMs = expectedDays * dayMs;

      expect(Math.abs(deltaMs - expectedMs)).toBeLessThanOrEqual(dayMs);
    }
  });
});

// ─── GET /review/due?userId= ──────────────────────────────────────────────────

describe("GET /review/due", () => {
  it("returns only due cards when some are due and some are not", async () => {
    const deck = await createTestDeck(testUser.id);
    const dueCard = await createTestCard(deck.id);
    const notDueCard = await createTestCard(deck.id);
    await createTestCard(deck.id); // no progress record — never due

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await createTestProgress(testUser.id, dueCard.id, {
      nextReviewAt: yesterday,
    });
    await createTestProgress(testUser.id, notDueCard.id, {
      nextReviewAt: tomorrow,
    });

    const res = await request(app).get("/review/due");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(dueCard.id);
  });

  it("returns 401 when unauthenticated", async () => {
    (
      auth.api.getSession as unknown as ReturnType<typeof jest.fn>
    ).mockResolvedValueOnce(null);

    const res = await request(app).get("/review/due");

    expect(res.status).toBe(401);
  });
});

// ─── GET /review/progress/:cardId ─────────────────────────────────────────────

describe("GET /review/progress/:cardId", () => {
  it("returns progress for a user+card pair", async () => {
    const deck = await createTestDeck(testUser.id);
    const card = await createTestCard(deck.id);

    await request(app).post("/review").send({ cardId: card.id, quality: 4 });

    const res = await request(app).get(`/review/progress/${card.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBe(testUser.id);
    expect(res.body.data.cardId).toBe(card.id);
  });

  it("returns 404 when progress does not exist", async () => {
    const res = await request(app).get(
      "/review/progress/00000000-0000-0000-0000-000000000000",
    );

    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    const deck = await createTestDeck(testUser.id);
    const card = await createTestCard(deck.id);
    (
      auth.api.getSession as unknown as ReturnType<typeof jest.fn>
    ).mockResolvedValueOnce(null);

    const res = await request(app).get(`/review/progress/${card.id}`);

    expect(res.status).toBe(401);
  });
});
