import { NotFoundError, BadRequestError } from "../utils/appError.ts";
import { getCardByID } from "../model/cardModel.ts";
import {
  createReview,
  getDueCards,
  getCardProgress,
  upsertCardProgress,
} from "../model/reviewModel.ts";
import type { SubmitReviewInput } from "../utils/reviewSchema.ts";

/**
 * SM-2 algorithm: computes next interval and ease factor from current state.
 * quality: 0-2 = forgot/hard, 3-5 = recalled
 * after each review, the ef is adjusted based on the recall quality using this formula:
 * ef = ef + (0.1 - (5 - q) × (0.08 + (5 - q) × 0.02))
 */
function sm2(
  easeFactor: number,
  reviewCount: number,
  correctStreak: number,
  previousInterval: number,
  quality: number,
): {
  newEaseFactor: number;
  newInterval: number;
  newStreak: number;
  newReviewCount: number;
} {
  const recalled = quality >= 3;

  let newEaseFactor =
    easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  if (newEaseFactor < 1.3) newEaseFactor = 1.3;

  let newInterval: number;
  let newStreak: number;
  let newReviewCount: number;

  if (!recalled) {
    newInterval = 1;
    newStreak = 0;
    newReviewCount = 0;
  } else if (reviewCount === 0) {
    newInterval = 1;
    newStreak = 1;
    newReviewCount = reviewCount + 1;
  } else if (reviewCount === 1) {
    newInterval = 6;
    newStreak = correctStreak + 1;
    newReviewCount = reviewCount + 1;
  } else {
    newInterval = Math.round(previousInterval * newEaseFactor);
    newStreak = correctStreak + 1;
    newReviewCount = reviewCount + 1;
  }

  return { newEaseFactor, newInterval, newStreak, newReviewCount };
}

export async function submitReview(input: SubmitReviewInput) {
  // validate input quality - is this necessary? zod should handle it
  if (input.quality < 0 || input.quality > 5) {
    throw new BadRequestError("quality must be between 0 and 5");
  }

  const card = await getCardByID(input.cardId);
  if (!card) throw new NotFoundError("Card", input.cardId);

  const existing = await getCardProgress(input.userId, input.cardId);
  const easeFactor = existing?.easeFactor ?? 2.5;
  const reviewCount = existing?.reviewCount ?? 0;
  const correctStreak = existing?.correctStreak ?? 0;
  const currentInterval = existing?.currentInterval ?? 1;

  const { newEaseFactor, newInterval, newStreak, newReviewCount } = sm2(
    easeFactor,
    reviewCount,
    correctStreak,
    currentInterval,
    input.quality,
  );

  const now = new Date();
  const nextReviewAt = new Date(
    now.getTime() + newInterval * 24 * 60 * 60 * 1000,
  );

  const review = await createReview({
    userId: input.userId,
    cardId: input.cardId,
    quality: input.quality,
    easeFactor: newEaseFactor,
    interval: newInterval,
  });

  const progress = await upsertCardProgress({
    userId: input.userId,
    cardId: input.cardId,
    easeFactor: newEaseFactor,
    reviewCount: newReviewCount,
    correctStreak: newStreak,
    currentInterval: newInterval,
    lastReviewedAt: now,
    nextReviewAt,
  });

  return { review, progress };
}

export async function listDueCards(userId: string) {
  return getDueCards(userId);
}

export async function getProgress(userId: string, cardId: string) {
  const progress = await getCardProgress(userId, cardId);
  if (!progress) throw new NotFoundError("Progress", `${userId}/${cardId}`);
  return progress;
}
