/**
 * Unit tests: deck.service
 *
 * Mocks both deckAccess.service and deckModel to isolate business logic.
 */
import { jest } from "@jest/globals";

jest.unstable_mockModule("../../src/model/deckModel.js", () => ({
  getDecksByScope: jest.fn(),
  createDeck: jest.fn(),
  updateDeckByID: jest.fn(),
  deleteDeckByID: jest.fn(),
}));

jest.unstable_mockModule("../../src/services/deckAccess.service.js", () => ({
  loadDeck: jest.fn(),
  visibleDeckScope: jest.fn(),
}));

const {
  getDecksByScope,
  createDeck: createDeckModel,
  updateDeckByID,
  deleteDeckByID,
} = await import("../../src/model/deckModel.js");
const { loadDeck, visibleDeckScope } = await import(
  "../../src/services/deckAccess.service.js"
);

const { listDecksForUser, getDeck, createDeck, updateDeck, deleteDeck } =
  await import("../../src/services/deck.service.js");

import { NotFoundError, ForbiddenError } from "../../src/utils/appError.js";

const requestor = {
  id: "user-1",
  email: "u@test.com",
  subscriptionType: "FREE" as const,
};

const mockDeck = {
  id: "deck-1",
  userId: "user-1",
  name: "French Vocab",
  topic: "Languages",
  isPublic: false,
  lastReviewedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockScope = { OR: [{ userId: "user-1" }] };

beforeEach(() => jest.clearAllMocks());

// ─── listDecksForUser ──────────────────────────────────────────────────────

describe("listDecksForUser", () => {
  it("returns decks for target user scoped by requestor visibility", async () => {
    jest.mocked(visibleDeckScope).mockReturnValue(mockScope as never);
    jest.mocked(getDecksByScope).mockResolvedValue([mockDeck]);

    const result = await listDecksForUser(requestor, "user-1");

    expect(result).toEqual([mockDeck]);
    expect(visibleDeckScope).toHaveBeenCalledWith(requestor);
    expect(getDecksByScope).toHaveBeenCalledWith("user-1", mockScope);
  });

  it("returns empty array when no visible decks exist", async () => {
    jest.mocked(visibleDeckScope).mockReturnValue(mockScope as never);
    jest.mocked(getDecksByScope).mockResolvedValue([]);

    const result = await listDecksForUser(requestor, "other-user");

    expect(result).toEqual([]);
  });
});

// ─── getDeck ──────────────────────────────────────────────────────────────────────────

describe("getDeck", () => {
  it("returns deck when accessible", async () => {
    jest.mocked(loadDeck).mockResolvedValue(mockDeck);

    const result = await getDeck(requestor, "deck-1");

    expect(result).toEqual(mockDeck);
    expect(loadDeck).toHaveBeenCalledWith(requestor, "deck-1", "read");
  });

  it("throws NotFoundError when deck does not exist", async () => {
    jest
      .mocked(loadDeck)
      .mockRejectedValue(new NotFoundError("Deck", "missing"));

    await expect(getDeck(requestor, "missing")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("throws ForbiddenError when deck is inaccessible", async () => {
    jest
      .mocked(loadDeck)
      .mockRejectedValue(new ForbiddenError("Access denied"));

    await expect(getDeck({ id: "stranger" }, "deck-1")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

// ─── createDeck ────────────────────────────────────────────────────────────────────────

describe("createDeck", () => {
  it("creates and returns a deck without requiring Deck Access", async () => {
    jest.mocked(createDeckModel).mockResolvedValue(mockDeck);

    const result = await createDeck({
      userId: "user-1",
      name: "French Vocab",
      topic: "Languages",
      isPublic: false,
    });

    expect(result).toEqual(mockDeck);
    expect(loadDeck).not.toHaveBeenCalled();
  });
});

// ─── updateDeck ────────────────────────────────────────────────────────────────────────

describe("updateDeck", () => {
  it("updates deck when edit access is granted", async () => {
    const updated = { ...mockDeck, name: "Spanish Vocab" };
    jest.mocked(loadDeck).mockResolvedValue(mockDeck);
    jest.mocked(updateDeckByID).mockResolvedValue(updated);

    const result = await updateDeck(requestor, "deck-1", {
      name: "Spanish Vocab",
    });

    expect(result).toEqual(updated);
    expect(loadDeck).toHaveBeenCalledWith(requestor, "deck-1", "edit");
  });

  it("throws ForbiddenError when Deck Access denies edit", async () => {
    jest
      .mocked(loadDeck)
      .mockRejectedValue(new ForbiddenError("Access denied"));

    await expect(
      updateDeck({ id: "viewer" }, "deck-1", { name: "X" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(updateDeckByID).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when deck does not exist", async () => {
    jest
      .mocked(loadDeck)
      .mockRejectedValue(new NotFoundError("Deck", "missing"));

    await expect(
      updateDeck(requestor, "missing", { name: "X" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ─── deleteDeck ────────────────────────────────────────────────────────────────────────

describe("deleteDeck", () => {
  it("deletes deck when owner", async () => {
    jest.mocked(loadDeck).mockResolvedValue(mockDeck);
    jest.mocked(deleteDeckByID).mockResolvedValue(undefined);

    const result = await deleteDeck(requestor, "deck-1");

    expect(result).toEqual({ message: "Deck deleted successfully" });
    expect(loadDeck).toHaveBeenCalledWith(requestor, "deck-1", "delete");
  });

  it("throws ForbiddenError when editor tries to delete", async () => {
    jest
      .mocked(loadDeck)
      .mockRejectedValue(new ForbiddenError("Access denied"));

    await expect(deleteDeck({ id: "editor" }, "deck-1")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(deleteDeckByID).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when deck does not exist", async () => {
    jest
      .mocked(loadDeck)
      .mockRejectedValue(new NotFoundError("Deck", "missing"));

    await expect(deleteDeck(requestor, "missing")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
