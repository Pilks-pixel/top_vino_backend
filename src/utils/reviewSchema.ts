import * as z from "zod/v4";

export const ReviewCreateSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  cardId: z.string().min(1, "cardId is required"),
  quality: z.number().int().min(0).max(5),
  easeFactor: z.number().min(0),
  interval: z.number().min(0),
});

export const ProgressUpsertSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  cardId: z.string().min(1, "cardId is required"),
  easeFactor: z.number().min(0),
  reviewCount: z.number().min(0),
  correctStreak: z.number().min(0),
  currentInterval: z.number().int().min(1),
  lastReviewedAt: z.date(),
  nextReviewAt: z.date(),
});

// used for validating review submission input, not the actual review record
export const SubmitReviewSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  cardId: z.string().min(1, "cardId is required"),
  quality: z.number().int().min(0).max(5),
});

export type ReviewCreateInput = z.infer<typeof ReviewCreateSchema>;
export type ProgressUpsertInput = z.infer<typeof ProgressUpsertSchema>;
export type SubmitReviewInput = z.infer<typeof SubmitReviewSchema>;
