/**
 * Unit tests: review.service
 */
import { jest } from "@jest/globals";
import type {
  Card,
  UserCardProgress,
  UserCardReview,
  Prisma,
} from "../../generated/prisma/client.js";

jest.unstable_mockModule("../../src/services/deckAccess.service.ts", () => ({
  loadCard: jest.fn(),
  visibleDeckScope: jest.fn(),
}));

jest.unstable_mockModule("../../src/model/reviewModel.ts", () => ({
  createReview: jest.fn(),
  getDueCards: jest.fn(),
  getCardProgress: jest.fn(),
  upsertCardProgress: jest.fn(),
}));

const { loadCard, visibleDeckScope } = await import(
  "../../src/services/deckAccess.service.ts"
);
const { createReview, getDueCards, getCardProgress, upsertCardProgress } =
  await import("../../src/model/reviewModel.ts");

const { submitReview, listDueCards, getProgress } = await import(
  "../../src/services/review.service.ts"
);

import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from "../../src/utils/appError.ts";

const mockCard: Card = {
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

const mockProgress: UserCardProgress = {
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

const mockReview: UserCardReview = {
  id: "review-1",
  userId: "user-1",
  cardId: "card-1",
  quality: 4,
  easeFactor: 2.5,
  interval: 1,
  reviewedAt: new Date(),
  a: null,
  b: null,
  c: null,
};

const mockScope: Prisma.DeckWhereInput = { isPublic: true };

beforeEach(() => jest.clearAllMocks());

// ─── submitReview ─────────────────────────────────────────────────────────────

describe("submitReview", () => {
  it("creates a review and updates progress", async () => {
    jest.mocked(loadCard).mockResolvedValue(mockCard);
    jest.mocked(getCardProgress).mockResolvedValue(mockProgress);
    jest.mocked(createReview).mockResolvedValue(mockReview);
    jest
      .mocked(upsertCardProgress)
      .mockResolvedValue({ ...mockProgress, reviewCount: 1 });

    const result = await submitReview(
      { id: "user-1" },
      {
        cardId: "card-1",
        quality: 4,
      },
    );
    expect(result.review).toBeDefined();
    expect(result.progress).toBeDefined();
    expect(loadCard).toHaveBeenCalledWith({ id: "user-1" }, "card-1", "read");
    expect(getCardProgress).toHaveBeenCalledWith("user-1", "card-1");
    expect(createReview).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        cardId: "card-1",
        quality: 4,
        easeFactor: 2.5,
        interval: 1,
      }),
    );
    expect(upsertCardProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        cardId: "card-1",
        easeFactor: 2.5,
        reviewCount: 1,
        correctStreak: 1,
        currentInterval: 1,
      }),
    );
  });

  it("Case A - bootstrap first success sets interval to 1", async () => {
    const progress: UserCardProgress = {
      ...mockProgress,
      reviewCount: 0,
      currentInterval: 1,
      correctStreak: 0,
      easeFactor: 2.5,
    };
    jest.mocked(loadCard).mockResolvedValue(mockCard);
    jest.mocked(getCardProgress).mockResolvedValue(progress);
    jest.mocked(createReview).mockResolvedValue(mockReview);
    jest
      .mocked(upsertCardProgress)
      .mockResolvedValue({ ...progress, reviewCount: 1, correctStreak: 1 });

    await submitReview(
      { id: "user-1" },
      {
        cardId: "card-1",
        quality: 4,
      },
    );

    expect(upsertCardProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        reviewCount: 1,
        currentInterval: 1,
        correctStreak: 1,
        easeFactor: 2.5,
      }),
    );
  });

  it("Case B - bootstrap second success sets interval to 6", async () => {
    const progress: UserCardProgress = {
      ...mockProgress,
      reviewCount: 1,
      currentInterval: 1,
      correctStreak: 1,
      easeFactor: 2.5,
    };
    jest.mocked(loadCard).mockResolvedValue(mockCard);
    jest.mocked(getCardProgress).mockResolvedValue(progress);
    jest.mocked(createReview).mockResolvedValue(mockReview);
    jest
      .mocked(upsertCardProgress)
      .mockResolvedValue({ ...progress, reviewCount: 2, correctStreak: 2 });

    await submitReview(
      { id: "user-1" },
      {
        cardId: "card-1",
        quality: 4,
      },
    );

    expect(upsertCardProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        reviewCount: 2,
        currentInterval: 6,
        correctStreak: 2,
        easeFactor: 2.5,
      }),
    );
  });

  it("Case C - steady-state fourth review uses previous interval", async () => {
    const progress: UserCardProgress = {
      ...mockProgress,
      reviewCount: 3,
      currentInterval: 15,
      correctStreak: 3,
      easeFactor: 2.5,
    };
    jest.mocked(loadCard).mockResolvedValue(mockCard);
    jest.mocked(getCardProgress).mockResolvedValue(progress);
    jest.mocked(createReview).mockResolvedValue(mockReview);
    jest
      .mocked(upsertCardProgress)
      .mockResolvedValue({ ...progress, reviewCount: 4, correctStreak: 4 });

    await submitReview(
      { id: "user-1" },
      {
        cardId: "card-1",
        quality: 4,
      },
    );

    expect(upsertCardProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        reviewCount: 4,
        currentInterval: 38,
        correctStreak: 4,
        easeFactor: 2.5,
      }),
    );
  });

  it("Case D - failure resets reviewCount and currentInterval", async () => {
    const progress: UserCardProgress = {
      ...mockProgress,
      reviewCount: 3,
      currentInterval: 15,
      correctStreak: 3,
      easeFactor: 2.5,
    };
    jest.mocked(loadCard).mockResolvedValue(mockCard);
    jest.mocked(getCardProgress).mockResolvedValue(progress);
    jest.mocked(createReview).mockResolvedValue(mockReview);
    jest.mocked(upsertCardProgress).mockResolvedValue({
      ...progress,
      reviewCount: 0,
      correctStreak: 0,
      currentInterval: 1,
      easeFactor: 2.18,
    });

    await submitReview(
      { id: "user-1" },
      {
        cardId: "card-1",
        quality: 2,
      },
    );

    expect(upsertCardProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        reviewCount: 0,
        currentInterval: 1,
        correctStreak: 0,
        easeFactor: expect.closeTo(2.18, 5),
      }),
    );
  });

  it("Case E - EF floor clamps to 1.3", async () => {
    const progress: UserCardProgress = {
      ...mockProgress,
      reviewCount: 0,
      currentInterval: 1,
      correctStreak: 0,
      easeFactor: 1.5,
    };
    jest.mocked(loadCard).mockResolvedValue(mockCard);
    jest.mocked(getCardProgress).mockResolvedValue(progress);
    jest.mocked(createReview).mockResolvedValue(mockReview);
    jest.mocked(upsertCardProgress).mockResolvedValue({
      ...progress,
      easeFactor: 1.3,
    });

    await submitReview(
      { id: "user-1" },
      {
        cardId: "card-1",
        quality: 0,
      },
    );

    expect(upsertCardProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        easeFactor: 1.3,
      }),
    );
  });

  it("throws NotFoundError when card does not exist", async () => {
    jest
      .mocked(loadCard)
      .mockRejectedValue(new NotFoundError("Card", "missing"));
    await expect(
      submitReview({ id: "user-1" }, { cardId: "missing", quality: 4 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ForbiddenError for inaccessible card", async () => {
    jest
      .mocked(loadCard)
      .mockRejectedValue(new ForbiddenError("Access denied"));
    await expect(
      submitReview({ id: "user-1" }, { cardId: "inaccessible", quality: 4 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws BadRequestError when quality is out of range", async () => {
    await expect(
      submitReview({ id: "user-1" }, { cardId: "card-1", quality: 6 }),
    ).rejects.toBeInstanceOf(BadRequestError);
    await expect(
      submitReview({ id: "user-1" }, { cardId: "card-1", quality: -1 }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});

// ─── listDueCards ─────────────────────────────────────────────────────────────

describe("listDueCards", () => {
  it("returns due cards using visible scope", async () => {
    jest.mocked(visibleDeckScope).mockReturnValue(mockScope);
    jest.mocked(getDueCards).mockResolvedValue([mockCard]);
    const result = await listDueCards({ id: "user-1" });
    expect(result).toEqual([mockCard]);
    expect(visibleDeckScope).toHaveBeenCalledWith({ id: "user-1" });
    expect(getDueCards).toHaveBeenCalledWith("user-1", mockScope);
  });
});

// ─── getProgress ─────────────────────────────────────────────────────────────

describe("getProgress", () => {
  it("returns progress when accessible", async () => {
    jest.mocked(loadCard).mockResolvedValue(mockCard);
    jest.mocked(getCardProgress).mockResolvedValue(mockProgress);
    const result = await getProgress({ id: "user-1" }, "card-1");
    expect(result).toEqual(mockProgress);
    expect(loadCard).toHaveBeenCalledWith({ id: "user-1" }, "card-1", "read");
    expect(getCardProgress).toHaveBeenCalledWith("user-1", "card-1");
  });

  it("throws ForbiddenError when card inaccessible", async () => {
    jest
      .mocked(loadCard)
      .mockRejectedValue(new ForbiddenError("Access denied"));
    await expect(
      getProgress({ id: "user-1" }, "card-1"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws NotFoundError when card does not exist", async () => {
    jest
      .mocked(loadCard)
      .mockRejectedValue(new NotFoundError("Card", "missing"));
    await expect(
      getProgress({ id: "user-1" }, "missing"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError when progress does not exist", async () => {
    jest.mocked(loadCard).mockResolvedValue(mockCard);
    jest.mocked(getCardProgress).mockResolvedValue(null);
    await expect(
      getProgress({ id: "user-1" }, "card-1"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
