import prisma from "../lib/prisma.ts";
import type {
  ReviewCreateInput,
  ProgressUpsertInput,
} from "../utils/reviewSchema.ts";

export async function createReview(data: ReviewCreateInput) {
  return prisma.userCardReview.create({ data });
}

export async function getDueCards(userId: string) {
  const now = new Date();
  return prisma.card.findMany({
    where: {
      userProgress: {
        some: {
          userId,
          nextReviewAt: { lte: now },
        },
      },
    },
  });
}

export async function getCardProgress(userId: string, cardId: string) {
  return prisma.userCardProgress.findUnique({
    where: { userId_cardId: { userId, cardId } },
  });
}

export async function upsertCardProgress(data: ProgressUpsertInput) {
  const { userId, cardId, ...rest } = data;
  return prisma.userCardProgress.upsert({
    where: { userId_cardId: { userId, cardId } },
    update: rest,
    create: { userId, cardId, ...rest },
  });
}
