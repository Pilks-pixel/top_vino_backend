/**
 * Unit tests: review.service
 */
import { jest } from "@jest/globals";

jest.unstable_mockModule("../../src/model/reviewModel.js", () => ({
  createReview: jest.fn(),
  getDueCards: jest.fn(),
  getCardProgress: jest.fn(),
  upsertCardProgress: jest.fn(),
}));

jest.unstable_mockModule("../../src/model/cardModel.js", () => ({
  getCardsForDeck: jest.fn(),
  getCardByID: jest.fn(),
  createCard: jest.fn(),
  updateCardByID: jest.fn(),
  deleteCardByID: jest.fn(),
}));

const { createReview, getDueCards, getCardProgress, upsertCardProgress } =
  await import("../../src/model/reviewModel.js");
const { getCardByID } = await import("../../src/model/cardModel.js");

const { submitReview, listDueCards, getProgress } = await import(
  "../../src/services/review.service.js"
);

import { NotFoundError, BadRequestError } from "../../src/utils/appError.js";

const mockCard = {
  id: "card-1",
  deckId: "deck-1",
  type: "basic",
  question: "Q?",
  correctAnswer: null,
  incorrectAnswers: [],
  referenceAnswer: null,
  topic: null,
  subtopic: null,
  sourceType: null,
  sourceMetadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const mockProgress = {
  userId: "user-1",
  cardId: "card-1",
  easeFactor: 2.5,
  reviewCount: 0,
  correctStreak: 0,
  currentInterval: 1,
  lastReviewedAt: null,
  nextReviewAt: null,
  isMarkedForReview: false,
};
const mockReview = {
  id: "review-1",
  userId: "user-1",
  cardId: "card-1",
  quality: 4,
  easeFactor: 2.6,
  interval: 1,
  reviewedAt: new Date(),
  a: null,
  b: null,
  c: null,
};

beforeEach(() => jest.clearAllMocks());

// ─── submitReview ─────────────────────────────────────────────────────────────

describe("submitReview", () => {
  it("creates a review and updates progress", async () => {
    jest.mocked(getCardByID).mockResolvedValue(mockCard);
    jest.mocked(getCardProgress).mockResolvedValue(mockProgress);
    jest.mocked(createReview).mockResolvedValue(mockReview);
    jest
      .mocked(upsertCardProgress)
      .mockResolvedValue({ ...mockProgress, reviewCount: 1 });

    const result = await submitReview({
      userId: "user-1",
      cardId: "card-1",
      quality: 4,
    });
    expect(result.review).toBeDefined();
    expect(result.progress).toBeDefined();
    expect(createReview).toHaveBeenCalled();
    expect(upsertCardProgress).toHaveBeenCalled();
  });

  it("throws NotFoundError when card does not exist", async () => {
    jest.mocked(getCardByID).mockResolvedValue(null);
    await expect(
      submitReview({ userId: "user-1", cardId: "missing", quality: 4 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws BadRequestError when quality is out of range", async () => {
    await expect(
      submitReview({ userId: "user-1", cardId: "card-1", quality: 6 }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});

// ─── listDueCards ─────────────────────────────────────────────────────────────

describe("listDueCards", () => {
  it("returns due cards for user", async () => {
    jest.mocked(getDueCards).mockResolvedValue([mockCard]);
    const result = await listDueCards("user-1");
    expect(result).toEqual([mockCard]);
    expect(getDueCards).toHaveBeenCalledWith("user-1");
  });
});

// ─── getProgress ─────────────────────────────────────────────────────────────

describe("getProgress", () => {
  it("returns progress when found", async () => {
    jest.mocked(getCardProgress).mockResolvedValue(mockProgress);
    const result = await getProgress("user-1", "card-1");
    expect(result).toEqual(mockProgress);
  });

  it("throws NotFoundError when progress does not exist", async () => {
    jest.mocked(getCardProgress).mockResolvedValue(null);
    await expect(getProgress("user-1", "card-1")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
