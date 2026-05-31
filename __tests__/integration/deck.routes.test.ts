/**
 * Integration tests: deck routes
 *
 * Tests against real test database.
 * Ownership is passed via userId query param (pre-auth convention).
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

import request from "supertest";
import { app } from "../setup/testApp.js";
import { cleanDb, disconnectDb } from "../setup/testDb.js";
import { createTestUser, createTestDeck } from "../setup/factories.js";

beforeEach(async () => cleanDb());
afterAll(async () => disconnectDb());

// ─── POST /deck ───────────────────────────────────────────────────────────────

describe("POST /deck", () => {
  it("creates a deck and returns 201", async () => {
    const user = await createTestUser();
    const res = await request(app).post("/deck").send({
      userId: user.id,
      name: "French Vocab",
      topic: "Languages",
      isPublic: false,
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      name: "French Vocab",
      userId: user.id,
    });
  });

  it("returns 400 when name is missing", async () => {
    const user = await createTestUser();
    const res = await request(app).post("/deck").send({ userId: user.id });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 when userId is missing", async () => {
    const res = await request(app).post("/deck").send({ name: "My Deck" });
    expect(res.status).toBe(400);
  });
});

// ─── GET /deck?userId= ────────────────────────────────────────────────────────

describe("GET /deck", () => {
  it("returns decks for a user", async () => {
    const user = await createTestUser();
    await createTestDeck(user.id, { name: "Deck A" });
    await createTestDeck(user.id, { name: "Deck B" });
    const res = await request(app).get(`/deck?userId=${user.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it("returns empty array when user has no decks", async () => {
    const user = await createTestUser();
    const res = await request(app).get(`/deck?userId=${user.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("returns 400 when userId is missing", async () => {
    const res = await request(app).get("/deck");
    expect(res.status).toBe(400);
  });
});

// ─── GET /deck/:id ────────────────────────────────────────────────────────────

describe("GET /deck/:id", () => {
  it("returns deck by id", async () => {
    const user = await createTestUser();
    const deck = await createTestDeck(user.id);
    const res = await request(app).get(`/deck/${deck.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(deck.id);
  });

  it("returns 404 for non-existent deck", async () => {
    const res = await request(app).get(
      "/deck/00000000-0000-0000-0000-000000000000",
    );
    expect(res.status).toBe(404);
  });
});

// ─── PUT /deck/:id ────────────────────────────────────────────────────────────

describe("PUT /deck/:id", () => {
  it("updates deck when userId matches owner", async () => {
    const user = await createTestUser();
    const deck = await createTestDeck(user.id);
    const res = await request(app)
      .put(`/deck/${deck.id}?userId=${user.id}`)
      .send({ name: "Updated Deck", topic: "Updated Topic", isPublic: true });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Updated Deck");
  });

  it("returns 403 when userId does not match owner", async () => {
    const user = await createTestUser();
    const other = await createTestUser();
    const deck = await createTestDeck(user.id);
    const res = await request(app)
      .put(`/deck/${deck.id}?userId=${other.id}`)
      .send({ name: "Hacked" });
    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent deck", async () => {
    const user = await createTestUser();
    const res = await request(app)
      .put(`/deck/00000000-0000-0000-0000-000000000000?userId=${user.id}`)
      .send({ name: "X" });
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /deck/:id ─────────────────────────────────────────────────────────

describe("DELETE /deck/:id", () => {
  it("deletes deck when userId matches owner", async () => {
    const user = await createTestUser();
    const deck = await createTestDeck(user.id);
    const res = await request(app).delete(`/deck/${deck.id}?userId=${user.id}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Deck deleted successfully");
  });

  it("returns 403 when userId does not match owner", async () => {
    const user = await createTestUser();
    const other = await createTestUser();
    const deck = await createTestDeck(user.id);
    const res = await request(app).delete(
      `/deck/${deck.id}?userId=${other.id}`,
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent deck", async () => {
    const user = await createTestUser();
    const res = await request(app).delete(
      `/deck/00000000-0000-0000-0000-000000000000?userId=${user.id}`,
    );
    expect(res.status).toBe(404);
  });
});
