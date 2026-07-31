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

  it("Case A - bootstrap first success sets interval to 1", async () => {
    const progress = {
      ...mockProgress,
      reviewCount: 0,
      currentInterval: 1,
      correctStreak: 0,
      easeFactor: 2.5,
    };
    jest.mocked(getCardByID).mockResolvedValue(mockCard);
    jest.mocked(getCardProgress).mockResolvedValue(progress);
    jest.mocked(createReview).mockResolvedValue(mockReview);
    jest
      .mocked(upsertCardProgress)
      .mockResolvedValue({ ...progress, reviewCount: 1, correctStreak: 1 });

    await submitReview({
      userId: "user-1",
      cardId: "card-1",
      quality: 4,
    });

    expect(upsertCardProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewCount: 1,
        currentInterval: 1,
        correctStreak: 1,
        easeFactor: 2.5,
      }),
    );
  });

  it("Case B - bootstrap second success sets interval to 6", async () => {
    const progress = {
      ...mockProgress,
      reviewCount: 1,
      currentInterval: 1,
      correctStreak: 1,
      easeFactor: 2.5,
    };
    jest.mocked(getCardByID).mockResolvedValue(mockCard);
    jest.mocked(getCardProgress).mockResolvedValue(progress);
    jest.mocked(createReview).mockResolvedValue(mockReview);
    jest
      .mocked(upsertCardProgress)
      .mockResolvedValue({ ...progress, reviewCount: 2, correctStreak: 2 });

    await submitReview({
      userId: "user-1",
      cardId: "card-1",
      quality: 4,
    });

    expect(upsertCardProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewCount: 2,
        currentInterval: 6,
        correctStreak: 2,
        easeFactor: 2.5,
      }),
    );
  });

  it("Case C - steady-state fourth review uses previous interval", async () => {
    const progress = {
      ...mockProgress,
      reviewCount: 3,
      currentInterval: 15,
      correctStreak: 3,
      easeFactor: 2.5,
    };
    jest.mocked(getCardByID).mockResolvedValue(mockCard);
    jest.mocked(getCardProgress).mockResolvedValue(progress);
    jest.mocked(createReview).mockResolvedValue(mockReview);
    jest
      .mocked(upsertCardProgress)
      .mockResolvedValue({ ...progress, reviewCount: 4, correctStreak: 4 });

    await submitReview({
      userId: "user-1",
      cardId: "card-1",
      quality: 4,
    });

    expect(upsertCardProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewCount: 4,
        currentInterval: 38,
        correctStreak: 4,
        easeFactor: 2.5,
      }),
    );
  });

  it("Case D - failure resets reviewCount and currentInterval", async () => {
    const progress = {
      ...mockProgress,
      reviewCount: 3,
      currentInterval: 15,
      correctStreak: 3,
      easeFactor: 2.5,
    };
    jest.mocked(getCardByID).mockResolvedValue(mockCard);
    jest.mocked(getCardProgress).mockResolvedValue(progress);
    jest.mocked(createReview).mockResolvedValue(mockReview);
    jest.mocked(upsertCardProgress).mockResolvedValue({
      ...progress,
      reviewCount: 0,
      correctStreak: 0,
      currentInterval: 1,
      easeFactor: 2.18,
    });

    await submitReview({
      userId: "user-1",
      cardId: "card-1",
      quality: 2,
    });

    expect(upsertCardProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewCount: 0,
        currentInterval: 1,
        correctStreak: 0,
        easeFactor: expect.closeTo(2.18, 5),
      }),
    );
  });

  it("Case E - EF floor clamps to 1.3", async () => {
    const progress = {
      ...mockProgress,
      reviewCount: 0,
      currentInterval: 1,
      correctStreak: 0,
      easeFactor: 1.5,
    };
    jest.mocked(getCardByID).mockResolvedValue(mockCard);
    jest.mocked(getCardProgress).mockResolvedValue(progress);
    jest.mocked(createReview).mockResolvedValue(mockReview);
    jest.mocked(upsertCardProgress).mockResolvedValue({
      ...progress,
      easeFactor: 1.3,
    });

    await submitReview({
      userId: "user-1",
      cardId: "card-1",
      quality: 0,
    });

    expect(upsertCardProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        easeFactor: 1.3,
      }),
    );
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
