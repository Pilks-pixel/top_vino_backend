/**
 * Unit tests: deck.service
 *
 * Mocks the model layer to isolate business logic.
 */
import { jest } from "@jest/globals";

jest.unstable_mockModule("../../src/model/deckModel.js", () => ({
  getAllDecksForUser: jest.fn(),
  getDeckByID: jest.fn(),
  createDeck: jest.fn(),
  updateDeckByID: jest.fn(),
  deleteDeckByID: jest.fn(),
}));

const {
  getAllDecksForUser,
  getDeckByID,
  createDeck: createDeckModel,
  updateDeckByID,
  deleteDeckByID,
} = await import("../../src/model/deckModel.js");

const { listDecksForUser, getDeck, createDeck, updateDeck, deleteDeck } =
  await import("../../src/services/deck.service.js");

import { NotFoundError, ForbiddenError } from "../../src/utils/appError.js";

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

beforeEach(() => jest.clearAllMocks());

// ─── listDecksForUser ─────────────────────────────────────────────────────────

describe("listDecksForUser", () => {
  it("returns decks for the user", async () => {
    jest.mocked(getAllDecksForUser).mockResolvedValue([mockDeck]);
    const result = await listDecksForUser("user-1");
    expect(result).toEqual([mockDeck]);
    expect(getAllDecksForUser).toHaveBeenCalledWith("user-1", undefined);
  });

  it("returns empty array when user has no decks", async () => {
    jest.mocked(getAllDecksForUser).mockResolvedValue([]);
    const result = await listDecksForUser("user-1");
    expect(result).toEqual([]);
  });
});

// ─── getDeck ──────────────────────────────────────────────────────────────────

describe("getDeck", () => {
  it("returns deck when found", async () => {
    jest.mocked(getDeckByID).mockResolvedValue(mockDeck);
    const result = await getDeck("deck-1");
    expect(result).toEqual(mockDeck);
  });

  it("throws NotFoundError when deck does not exist", async () => {
    jest.mocked(getDeckByID).mockResolvedValue(null);
    await expect(getDeck("missing")).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ─── createDeck ───────────────────────────────────────────────────────────────

describe("createDeck", () => {
  it("creates and returns a deck", async () => {
    jest.mocked(createDeckModel).mockResolvedValue(mockDeck);
    const result = await createDeck({
      userId: "user-1",
      name: "French Vocab",
      topic: "Languages",
      isPublic: false,
    });
    expect(result).toEqual(mockDeck);
  });
});

// ─── updateDeck ───────────────────────────────────────────────────────────────

describe("updateDeck", () => {
  it("updates deck when owner matches", async () => {
    const updated = { ...mockDeck, name: "Spanish Vocab" };
    jest.mocked(getDeckByID).mockResolvedValue(mockDeck);
    jest.mocked(updateDeckByID).mockResolvedValue(updated);
    const result = await updateDeck("deck-1", "user-1", {
      name: "Spanish Vocab",
    });
    expect(result).toEqual(updated);
  });

  it("throws NotFoundError when deck does not exist", async () => {
    jest.mocked(getDeckByID).mockResolvedValue(null);
    await expect(
      updateDeck("missing", "user-1", { name: "X" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ForbiddenError when requestor is not owner", async () => {
    jest.mocked(getDeckByID).mockResolvedValue(mockDeck);
    await expect(
      updateDeck("deck-1", "other-user", { name: "X" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ─── deleteDeck ───────────────────────────────────────────────────────────────

describe("deleteDeck", () => {
  it("deletes deck when owner matches", async () => {
    jest.mocked(getDeckByID).mockResolvedValue(mockDeck);
    jest.mocked(deleteDeckByID).mockResolvedValue(undefined);
    const result = await deleteDeck("deck-1", "user-1");
    expect(result).toEqual({ message: "Deck deleted successfully" });
  });

  it("throws NotFoundError when deck does not exist", async () => {
    jest.mocked(getDeckByID).mockResolvedValue(null);
    await expect(deleteDeck("missing", "user-1")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("throws ForbiddenError when requestor is not owner", async () => {
    jest.mocked(getDeckByID).mockResolvedValue(mockDeck);
    await expect(deleteDeck("deck-1", "other-user")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
