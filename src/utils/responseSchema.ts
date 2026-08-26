import * as z from "zod/v4";
import { UserProfile } from "./userSchema.ts";

export const SuccessEnvelope = <T extends z.ZodType>(data: T) =>
  z.strictObject({
    success: z.literal(true).describe("Always true for success responses"),
    data,
  });

export const SuccessMessageResponse = z.strictObject({
  success: z.literal(true).describe("Always true for success responses"),
  message: z.string(),
});

export const Deck = z.strictObject({
  id: z.uuid(),
  userId: z.uuid(),
  name: z.string(),
  topic: z.string().nullable(),
  isPublic: z
    .boolean()
    .describe(
      "When true, authenticated users may read and study the deck; when false, access is restricted to its owner and collaborators",
    ),
  lastReviewedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const Card = z.strictObject({
  id: z.uuid(),
  deckId: z.uuid(),
  type: z
    .enum(["basic", "multiple_choice", "cloze", "open_ended"])
    .describe("Card presentation and answer mode"),
  question: z.string(),
  correctAnswer: z
    .string()
    .nullable()
    .describe("The answer used for basic and multiple-choice cards"),
  incorrectAnswers: z
    .array(z.string())
    .describe("Additional answer options used for multiple-choice cards"),
  referenceAnswer: z
    .string()
    .nullable()
    .describe("The reference answer used when grading open-ended cards"),
  topic: z.string().nullable(),
  subtopic: z.string().nullable(),
  sourceType: z.string().nullable(),
  sourceMetadata: z.unknown().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const Review = z.strictObject({
  id: z.uuid(),
  userId: z.uuid(),
  cardId: z.uuid(),
  reviewedAt: z.coerce.date(),
  quality: z
    .int()
    .min(0)
    .max(5)
    .describe("SM-2 recall quality: 0-2 forgot or hard, 3-5 recalled"),
  easeFactor: z.number().nullable(),
  interval: z.number().nullable(),
  a: z.number().nullable(),
  b: z.number().nullable(),
  c: z.number().nullable(),
});

export const Progress = z.strictObject({
  userId: z.uuid(),
  cardId: z.uuid(),
  lastReviewedAt: z.coerce.date().nullable(),
  nextReviewAt: z.coerce.date().nullable(),
  easeFactor: z.number(),
  reviewCount: z.int().nonnegative(),
  correctStreak: z.int().nonnegative(),
  currentInterval: z.int().positive(),
  isMarkedForReview: z.boolean(),
});

export const ReviewSubmit = z.strictObject({
  review: Review,
  progress: Progress.nullable(),
});

export const DeckListResponse = SuccessEnvelope(z.array(Deck));
export const DeckResponse = SuccessEnvelope(Deck);
export const DeckCreateResponse = DeckResponse;
export const DeckUpdateResponse = DeckResponse;
export const DeckDeleteResponse = SuccessMessageResponse;

export const CardListResponse = SuccessEnvelope(z.array(Card));
export const CardResponse = SuccessEnvelope(Card);
export const CardCreateResponse = CardResponse;
export const CardUpdateResponse = CardResponse;
export const CardDeleteResponse = SuccessMessageResponse;

export const ReviewSubmitResponse = SuccessEnvelope(ReviewSubmit);
export const DueCardsResponse = SuccessEnvelope(z.array(Card));
export const ProgressResponse = SuccessEnvelope(Progress.nullable());

export const UserProfileResponse = SuccessEnvelope(UserProfile);
export const UserDeleteResponse = SuccessMessageResponse;

export type DeckResponse = z.infer<typeof DeckResponse>;
export type CardResponse = z.infer<typeof CardResponse>;
export type ReviewSubmitResponse = z.infer<typeof ReviewSubmitResponse>;
export type ProgressResponse = z.infer<typeof ProgressResponse>;
