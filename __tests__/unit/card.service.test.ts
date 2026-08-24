/**
 * Unit tests: card.service
 */
import { jest } from "@jest/globals";

jest.unstable_mockModule("../../src/services/deckAccess.service.js", () => ({
  loadDeck: jest.fn(),
  loadCard: jest.fn(),
}));

jest.unstable_mockModule("../../src/model/cardModel.js", () => ({
  getCardsForDeck: jest.fn(),
  createCard: jest.fn(),
  updateCardByID: jest.fn(),
  deleteCardByID: jest.fn(),
}));

const { loadDeck, loadCard } = await import(
  "../../src/services/deckAccess.service.js"
);
const {
  getCardsForDeck,
  createCard: createCardModel,
  updateCardByID,
  deleteCardByID,
} = await import("../../src/model/cardModel.js");

const { listCardsForDeck, getCard, createCard, updateCard, deleteCard } =
  await import("../../src/services/card.service.js");

import { ForbiddenError, NotFoundError } from "../../src/utils/appError.js";

const requestor = { id: "user-1" };

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
  it("calls loadDeck with 'read' and returns cards", async () => {
    jest.mocked(loadDeck).mockResolvedValue(mockDeck);
    jest.mocked(getCardsForDeck).mockResolvedValue([mockCard]);

    const result = await listCardsForDeck(requestor, "deck-1");

    expect(loadDeck).toHaveBeenCalledWith(requestor, "deck-1", "read");
    expect(getCardsForDeck).toHaveBeenCalledWith("deck-1");
    expect(result).toEqual([mockCard]);
  });

  it("propagates ForbiddenError from loadDeck", async () => {
    jest
      .mocked(loadDeck)
      .mockRejectedValue(new ForbiddenError("Access denied"));

    await expect(listCardsForDeck(requestor, "deck-1")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("propagates NotFoundError from loadDeck", async () => {
    jest
      .mocked(loadDeck)
      .mockRejectedValue(new NotFoundError("Deck", "missing"));

    await expect(listCardsForDeck(requestor, "missing")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("getCard", () => {
  it("calls loadCard with 'read' and returns card when deckId matches", async () => {
    jest.mocked(loadCard).mockResolvedValue(mockCard);

    const result = await getCard(requestor, "deck-1", "card-1");

    expect(loadCard).toHaveBeenCalledWith(requestor, "card-1", "read");
    expect(result).toEqual(mockCard);
  });

  it("throws NotFoundError when card.deckId does not match deckId", async () => {
    jest
      .mocked(loadCard)
      .mockResolvedValue({ ...mockCard, deckId: "other-deck" });

    await expect(getCard(requestor, "deck-1", "card-1")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("propagates NotFoundError when card does not exist", async () => {
    jest
      .mocked(loadCard)
      .mockRejectedValue(new NotFoundError("Card", "missing"));

    await expect(
      getCard(requestor, "deck-1", "missing"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("propagates ForbiddenError from loadCard", async () => {
    jest
      .mocked(loadCard)
      .mockRejectedValue(new ForbiddenError("Access denied"));

    await expect(getCard(requestor, "deck-1", "card-1")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("createCard", () => {
  const input = {
    type: "basic" as const,
    question: "Q?",
    correctAnswer: "A",
    incorrectAnswers: [],
  };

  it("calls loadDeck with 'edit' and creates card on success", async () => {
    jest.mocked(loadDeck).mockResolvedValue(mockDeck);
    jest.mocked(createCardModel).mockResolvedValue(mockCard);

    const result = await createCard(requestor, "deck-1", input);

    expect(loadDeck).toHaveBeenCalledWith(requestor, "deck-1", "edit");
    expect(createCardModel).toHaveBeenCalledWith("deck-1", input);
    expect(result).toEqual(mockCard);
  });

  it("propagates ForbiddenError when VIEWER calls edit", async () => {
    jest
      .mocked(loadDeck)
      .mockRejectedValue(new ForbiddenError("Access denied"));

    await expect(createCard(requestor, "deck-1", input)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("propagates NotFoundError when deck does not exist", async () => {
    jest
      .mocked(loadDeck)
      .mockRejectedValue(new NotFoundError("Deck", "missing"));

    await expect(
      createCard(requestor, "missing", input),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("updateCard", () => {
  it("calls loadCard with 'edit' and updates when deckId matches", async () => {
    const updated = { ...mockCard, question: "Updated?" };
    jest.mocked(loadCard).mockResolvedValue(mockCard);
    jest.mocked(updateCardByID).mockResolvedValue(updated);

    const result = await updateCard(requestor, "deck-1", "card-1", {
      question: "Updated?",
    });

    expect(loadCard).toHaveBeenCalledWith(requestor, "card-1", "edit");
    expect(updateCardByID).toHaveBeenCalledWith("card-1", {
      question: "Updated?",
    });
    expect(result).toEqual(updated);
  });

  it("throws NotFoundError when card.deckId does not match deckId", async () => {
    jest
      .mocked(loadCard)
      .mockResolvedValue({ ...mockCard, deckId: "other-deck" });

    await expect(
      updateCard(requestor, "deck-1", "card-1", { question: "X" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("propagates NotFoundError when card does not exist", async () => {
    jest
      .mocked(loadCard)
      .mockRejectedValue(new NotFoundError("Card", "missing"));

    await expect(
      updateCard(requestor, "deck-1", "missing", { question: "X" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("propagates ForbiddenError from loadCard", async () => {
    jest
      .mocked(loadCard)
      .mockRejectedValue(new ForbiddenError("Access denied"));

    await expect(
      updateCard(requestor, "deck-1", "card-1", { question: "X" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("deleteCard", () => {
  it("calls loadCard with 'edit', deletes, and returns success message when deckId matches", async () => {
    jest.mocked(loadCard).mockResolvedValue(mockCard);
    jest.mocked(deleteCardByID).mockResolvedValue(undefined);

    const result = await deleteCard(requestor, "deck-1", "card-1");

    expect(loadCard).toHaveBeenCalledWith(requestor, "card-1", "edit");
    expect(deleteCardByID).toHaveBeenCalledWith("card-1");
    expect(result).toEqual({ message: "Card deleted successfully" });
  });

  it("throws NotFoundError when card.deckId does not match deckId", async () => {
    jest
      .mocked(loadCard)
      .mockResolvedValue({ ...mockCard, deckId: "other-deck" });

    await expect(
      deleteCard(requestor, "deck-1", "card-1"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("propagates NotFoundError when card does not exist", async () => {
    jest
      .mocked(loadCard)
      .mockRejectedValue(new NotFoundError("Card", "missing"));

    await expect(
      deleteCard(requestor, "deck-1", "missing"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("propagates ForbiddenError from loadCard", async () => {
    jest
      .mocked(loadCard)
      .mockRejectedValue(new ForbiddenError("Access denied"));

    await expect(
      deleteCard(requestor, "deck-1", "card-1"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
