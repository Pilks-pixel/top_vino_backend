/**
 * Integration tests: deck routes
 *
 * Tests against real test database with mocked Better Auth sessions.
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
const { createTestUser, createTestDeck, createTestDeckCollaborator } =
  await import("../setup/factories.js");

// consider if subscriptionType should be a union type or enum instead of string
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

// ─── POST /deck ───────────────────────────────────────────────────────────────

describe("POST /deck", () => {
  it("creates a deck and returns 201", async () => {
    const res = await request(app).post("/deck").send({
      name: "French Vocab",
      topic: "Languages",
      isPublic: false,
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      name: "French Vocab",
      userId: testUser.id,
    });
  });

  it("returns 400 when name is missing", async () => {
    const res = await request(app).post("/deck").send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 401 when unauthenticated", async () => {
    (
      auth.api.getSession as unknown as ReturnType<typeof jest.fn>
    ).mockResolvedValueOnce(null);

    const res = await request(app).post("/deck").send({ name: "My Deck" });

    expect(res.status).toBe(401);
  });
});

// ─── GET /deck ────────────────────────────────────────────────────────────────

describe("GET /deck", () => {
  it("returns own decks (public + private) when userId is absent", async () => {
    await createTestDeck(testUser.id, { name: "Deck A", isPublic: false });
    await createTestDeck(testUser.id, { name: "Deck B", isPublic: true });

    const res = await request(app).get("/deck");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it("returns only public decks when requesting another user's decks", async () => {
    const otherUser = await createTestUser({ email: "other-decks@test.com" });
    await createTestDeck(otherUser.id, { name: "Public Deck", isPublic: true });
    await createTestDeck(otherUser.id, {
      name: "Private Deck",
      isPublic: false,
    });

    const res = await request(app).get(`/deck?userId=${otherUser.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe("Public Deck");
    expect(res.body.data[0].isPublic).toBe(true);
    expect(res.body.data[0].userId).toBe(otherUser.id);
  });

  it("returns 401 when unauthenticated", async () => {
    (
      auth.api.getSession as unknown as ReturnType<typeof jest.fn>
    ).mockResolvedValueOnce(null);

    const res = await request(app).get("/deck");

    expect(res.status).toBe(401);
  });
});

// ─── GET /deck/:id ────────────────────────────────────────────────────────────

describe("GET /deck/:id", () => {
  it("returns own deck by id", async () => {
    const deck = await createTestDeck(testUser.id);
    const res = await request(app).get(`/deck/${deck.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(deck.id);
  });

  it("returns 403 when stranger requests another user's private deck", async () => {
    const owner = await createTestUser({ email: "private-owner@test.com" });
    const deck = await createTestDeck(owner.id, { isPublic: false });
    const res = await request(app).get(`/deck/${deck.id}`);
    expect(res.status).toBe(403);
  });

  it("returns 200 for a public deck owned by another user", async () => {
    const owner = await createTestUser({ email: "public-owner@test.com" });
    const deck = await createTestDeck(owner.id, { isPublic: true });
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

  it("returns 401 when unauthenticated", async () => {
    const deck = await createTestDeck(testUser.id);
    (
      auth.api.getSession as unknown as ReturnType<typeof jest.fn>
    ).mockResolvedValueOnce(null);
    const res = await request(app).get(`/deck/${deck.id}`);
    expect(res.status).toBe(401);
  });
});

// ─── PUT /deck/:id ────────────────────────────────────────────────────────────

describe("PUT /deck/:id", () => {
  it("updates deck when authenticated user matches owner", async () => {
    const deck = await createTestDeck(testUser.id);

    const res = await request(app)
      .put(`/deck/${deck.id}`)
      .send({ name: "Updated Deck", topic: "Updated Topic", isPublic: true });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Updated Deck");
  });

  it("returns 403 when authenticated user does not match owner", async () => {
    const owner = await createTestUser({ email: "owner@test.com" });
    const other = await createTestUser({ email: "other-owner@test.com" });
    const deck = await createTestDeck(owner.id);

    (
      auth.api.getSession as unknown as ReturnType<typeof jest.fn>
    ).mockResolvedValue({
      user: { id: other.id, email: other.email, subscriptionType: "FREE" },
      session: {},
    });

    const res = await request(app)
      .put(`/deck/${deck.id}`)
      .send({ name: "Hacked" });

    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent deck", async () => {
    const res = await request(app)
      .put(`/deck/00000000-0000-0000-0000-000000000000`)
      .send({ name: "X" });
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    const deck = await createTestDeck(testUser.id);
    (
      auth.api.getSession as unknown as ReturnType<typeof jest.fn>
    ).mockResolvedValueOnce(null);
    const res = await request(app).put(`/deck/${deck.id}`).send({ name: "X" });
    expect(res.status).toBe(401);
  });
});

// ─── DELETE /deck/:id ─────────────────────────────────────────────────────────

describe("DELETE /deck/:id", () => {
  it("deletes deck when authenticated user matches owner", async () => {
    const deck = await createTestDeck(testUser.id);

    const res = await request(app).delete(`/deck/${deck.id}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Deck deleted successfully");
  });

  it("returns 403 when authenticated user does not match owner", async () => {
    const owner = await createTestUser({ email: "delete-owner@test.com" });
    const other = await createTestUser({ email: "delete-other@test.com" });
    const deck = await createTestDeck(owner.id);

    (
      auth.api.getSession as unknown as ReturnType<typeof jest.fn>
    ).mockResolvedValue({
      user: { id: other.id, email: other.email, subscriptionType: "FREE" },
      session: {},
    });

    const res = await request(app).delete(`/deck/${deck.id}`);

    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent deck", async () => {
    const res = await request(app).delete(
      "/deck/00000000-0000-0000-0000-000000000000",
    );

    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    const deck = await createTestDeck(testUser.id);
    (
      auth.api.getSession as unknown as ReturnType<typeof jest.fn>
    ).mockResolvedValueOnce(null);
    const res = await request(app).delete(`/deck/${deck.id}`);
    expect(res.status).toBe(401);
  });
});

// ─── Collaborator access ──────────────────────────────────────────────────────────────────

describe("GET /deck listing includes collaborator-visible private decks", () => {
  it("includes private deck shared with requestor as collaborator", async () => {
    const owner = await createTestUser({ email: "collab-owner@test.com" });
    const privateDeck = await createTestDeck(owner.id, { isPublic: false });
    await createTestDeckCollaborator(privateDeck.id, testUser.id, "VIEWER");

    const res = await request(app).get(`/deck?userId=${owner.id}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.map((d: { id: string }) => d.id);
    expect(ids).toContain(privateDeck.id);
  });
});

describe("EDITOR collaborator can update but not delete", () => {
  it("allows EDITOR to update the deck", async () => {
    const owner = await createTestUser({ email: "editor-owner@test.com" });
    const deck = await createTestDeck(owner.id);
    await createTestDeckCollaborator(deck.id, testUser.id, "EDITOR");

    const res = await request(app)
      .put(`/deck/${deck.id}`)
      .send({ name: "Editor Update" });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Editor Update");
  });

  it("returns 403 when EDITOR tries to delete the deck", async () => {
    const owner = await createTestUser({ email: "editor-del-owner@test.com" });
    const deck = await createTestDeck(owner.id);
    await createTestDeckCollaborator(deck.id, testUser.id, "EDITOR");

    const res = await request(app).delete(`/deck/${deck.id}`);

    expect(res.status).toBe(403);
  });
});

describe("VIEWER collaborator can only read", () => {
  it("returns 403 when VIEWER tries to update the deck", async () => {
    const owner = await createTestUser({ email: "viewer-owner@test.com" });
    const deck = await createTestDeck(owner.id);
    await createTestDeckCollaborator(deck.id, testUser.id, "VIEWER");

    const res = await request(app)
      .put(`/deck/${deck.id}`)
      .send({ name: "Viewer Update" });

    expect(res.status).toBe(403);
  });

  it("returns 403 when VIEWER tries to delete the deck", async () => {
    const owner = await createTestUser({ email: "viewer-delete@test.com" });
    const deck = await createTestDeck(owner.id);
    await createTestDeckCollaborator(deck.id, testUser.id, "VIEWER");

    const res = await request(app).delete(`/deck/${deck.id}`);

    expect(res.status).toBe(403);
  });

  it("returns 200 when VIEWER reads a shared private deck", async () => {
    const owner = await createTestUser({ email: "viewer-read@test.com" });
    const deck = await createTestDeck(owner.id, { isPublic: false });
    await createTestDeckCollaborator(deck.id, testUser.id, "VIEWER");

    const res = await request(app).get(`/deck/${deck.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(deck.id);
  });
});
