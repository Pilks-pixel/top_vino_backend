/**
 * Unit tests: card.service
 */
import { jest } from "@jest/globals";

jest.unstable_mockModule("../../src/model/cardModel.js", () => ({
  getCardsForDeck: jest.fn(),
  getCardByID: jest.fn(),
  createCard: jest.fn(),
  updateCardByID: jest.fn(),
  deleteCardByID: jest.fn(),
}));

jest.unstable_mockModule("../../src/model/deckModel.js", () => ({
  getDeckByID: jest.fn(),
  getAllDecksForUser: jest.fn(),
  createDeck: jest.fn(),
  updateDeckByID: jest.fn(),
  deleteDeckByID: jest.fn(),
}));

const {
  getCardsForDeck,
  getCardByID,
  createCard: createCardModel,
  updateCardByID,
  deleteCardByID,
} = await import("../../src/model/cardModel.js");
const { getDeckByID } = await import("../../src/model/deckModel.js");

const { listCardsForDeck, getCard, createCard, updateCard, deleteCard } =
  await import("../../src/services/card.service.js");

import { NotFoundError } from "../../src/utils/appError.js";

const mockDeck = {
  id: "deck-1",
  userId: "user-1",
  name: "Test Deck",
  topic: null,
  isPublic: false,
  lastReviewedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const mockCard = {
  id: "card-1",
  deckId: "deck-1",
  type: "basic",
  question: "What is 2+2?",
  correctAnswer: "4",
  incorrectAnswers: [],
  referenceAnswer: null,
  topic: null,
  subtopic: null,
  sourceType: null,
  sourceMetadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("listCardsForDeck", () => {
  it("returns cards when deck exists", async () => {
    jest.mocked(getDeckByID).mockResolvedValue(mockDeck);
    jest.mocked(getCardsForDeck).mockResolvedValue([mockCard]);
    const result = await listCardsForDeck("deck-1");
    expect(result).toEqual([mockCard]);
  });

  it("throws NotFoundError when deck does not exist", async () => {
    jest.mocked(getDeckByID).mockResolvedValue(null);
    await expect(listCardsForDeck("missing")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("getCard", () => {
  it("returns card when found", async () => {
    jest.mocked(getCardByID).mockResolvedValue(mockCard);
    const result = await getCard("card-1");
    expect(result).toEqual(mockCard);
  });

  it("throws NotFoundError when card does not exist", async () => {
    jest.mocked(getCardByID).mockResolvedValue(null);
    await expect(getCard("missing")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("createCard", () => {
  it("creates card when deck exists", async () => {
    jest.mocked(getDeckByID).mockResolvedValue(mockDeck);
    jest.mocked(createCardModel).mockResolvedValue(mockCard);
    const input = {
      deckId: "deck-1",
      type: "basic" as const,
      question: "Q?",
      correctAnswer: "A",
      incorrectAnswers: [],
    };
    const result = await createCard(input);
    expect(result).toEqual(mockCard);
  });

  it("throws NotFoundError when deck does not exist", async () => {
    jest.mocked(getDeckByID).mockResolvedValue(null);
    await expect(
      createCard({
        deckId: "missing",
        type: "basic" as const,
        question: "Q?",
        correctAnswer: "A",
        incorrectAnswers: [],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("updateCard", () => {
  it("updates card when found", async () => {
    const updated = { ...mockCard, question: "Updated?" };
    jest.mocked(getCardByID).mockResolvedValue(mockCard);
    jest.mocked(updateCardByID).mockResolvedValue(updated);
    const result = await updateCard("card-1", { question: "Updated?" });
    expect(result).toEqual(updated);
  });

  it("throws NotFoundError when card does not exist", async () => {
    jest.mocked(getCardByID).mockResolvedValue(null);
    await expect(
      updateCard("missing", { question: "X" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("deleteCard", () => {
  it("deletes card and returns success message", async () => {
    jest.mocked(getCardByID).mockResolvedValue(mockCard);
    jest.mocked(deleteCardByID).mockResolvedValue(undefined);
    const result = await deleteCard("card-1");
    expect(result).toEqual({ message: "Card deleted successfully" });
  });

  it("throws NotFoundError when card does not exist", async () => {
    jest.mocked(getCardByID).mockResolvedValue(null);
    await expect(deleteCard("missing")).rejects.toBeInstanceOf(NotFoundError);
  });
});
