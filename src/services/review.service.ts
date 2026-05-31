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
 */
function sm2(
  easeFactor: number,
  reviewCount: number,
  correctStreak: number,
  quality: number,
): { newEaseFactor: number; newInterval: number; newStreak: number } {
  const recalled = quality >= 3;

  let newEaseFactor =
    easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  if (newEaseFactor < 1.3) newEaseFactor = 1.3;

  let newInterval: number;
  let newStreak: number;

  if (!recalled) {
    newInterval = 1;
    newStreak = 0;
  } else if (reviewCount === 0) {
    newInterval = 1;
    newStreak = 1;
  } else if (reviewCount === 1) {
    newInterval = 6;
    newStreak = correctStreak + 1;
  } else {
    newInterval = Math.round(
      (reviewCount === 2 ? 6 : reviewCount - 1) * newEaseFactor,
    );
    newStreak = correctStreak + 1;
  }

  return { newEaseFactor, newInterval, newStreak };
}

export async function submitReview(input: SubmitReviewInput) {
  if (input.quality < 0 || input.quality > 5) {
    throw new BadRequestError("quality must be between 0 and 5");
  }

  const card = await getCardByID(input.cardId);
  if (!card) throw new NotFoundError("Card", input.cardId);

  const existing = await getCardProgress(input.userId, input.cardId);
  const easeFactor = existing?.easeFactor ?? 2.5;
  const reviewCount = existing?.reviewCount ?? 0;
  const correctStreak = existing?.correctStreak ?? 0;

  const { newEaseFactor, newInterval, newStreak } = sm2(
    easeFactor,
    reviewCount,
    correctStreak,
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
    reviewCount: reviewCount + 1,
    correctStreak: newStreak,
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
