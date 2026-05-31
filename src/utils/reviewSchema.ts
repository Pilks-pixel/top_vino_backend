import * as z from "zod/v4";

export const SubmitReviewSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  cardId: z.string().min(1, "cardId is required"),
  quality: z.number().int().min(0).max(5),
});

export type SubmitReviewInput = z.infer<typeof SubmitReviewSchema>;
