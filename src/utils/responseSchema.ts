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
  lastReviewedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const Card = z.strictObject({
  id: z.uuid(),
  deckId: z.uuid(),
  type: z.union([
    z.literal("basic").describe("Prompt with one correct answer"),
    z
      .literal("multiple_choice")
      .describe("Prompt with one correct answer and incorrect options"),
    z.literal("cloze").describe("Prompt with an answer omitted from its text"),
    z
      .literal("open_ended")
      .describe("Prompt graded against a reference answer"),
  ]),
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
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const Review = z.strictObject({
  id: z.uuid(),
  userId: z.uuid(),
  cardId: z.uuid(),
  reviewedAt: z.iso.datetime(),
  quality: z
    .int()
    .min(0)
    .max(5)
    .describe("SM-2 recall quality: 0-2 forgot or hard, 3-5 recalled"),
  easeFactor: z.number().nullable(),
  interval: z.number().nullable(),
  a: z.number().nullable().describe("FSRS parameter a, when recorded"),
  b: z.number().nullable().describe("FSRS parameter b, when recorded"),
  c: z.number().nullable().describe("FSRS parameter c, when recorded"),
});

export const Progress = z.strictObject({
  userId: z.uuid(),
  cardId: z.uuid(),
  lastReviewedAt: z.iso.datetime().nullable(),
  nextReviewAt: z.iso.datetime().nullable(),
  easeFactor: z.number(),
  reviewCount: z.int().nonnegative(),
  correctStreak: z.int().nonnegative(),
  currentInterval: z.int().positive(),
  isMarkedForReview: z.boolean(),
});

export const ReviewSubmit = z.strictObject({
  review: Review,
  progress: Progress,
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
export const ProgressResponse = SuccessEnvelope(Progress);

export const UserProfileResponse = SuccessEnvelope(UserProfile);
export const UserDeleteResponse = SuccessMessageResponse;

export type DeckListResponseData = z.infer<typeof DeckListResponse>;
export type DeckResponseData = z.infer<typeof DeckResponse>;
export type DeckCreateResponseData = z.infer<typeof DeckCreateResponse>;
export type DeckUpdateResponseData = z.infer<typeof DeckUpdateResponse>;
export type DeckDeleteResponseData = z.infer<typeof DeckDeleteResponse>;
export type CardListResponseData = z.infer<typeof CardListResponse>;
export type CardResponseData = z.infer<typeof CardResponse>;
export type CardCreateResponseData = z.infer<typeof CardCreateResponse>;
export type CardUpdateResponseData = z.infer<typeof CardUpdateResponse>;
export type CardDeleteResponseData = z.infer<typeof CardDeleteResponse>;
export type ReviewSubmitResponseData = z.infer<typeof ReviewSubmitResponse>;
export type DueCardsResponseData = z.infer<typeof DueCardsResponse>;
export type ProgressResponseData = z.infer<typeof ProgressResponse>;
export type UserProfileResponseData = z.infer<typeof UserProfileResponse>;
export type UserDeleteResponseData = z.infer<typeof UserDeleteResponse>;
export type SuccessMessageResponseData = z.infer<typeof SuccessMessageResponse>;
export type DeckData = z.infer<typeof Deck>;
export type CardData = z.infer<typeof Card>;
export type ReviewData = z.infer<typeof Review>;
export type ProgressData = z.infer<typeof Progress>;
export type ReviewSubmitData = z.infer<typeof ReviewSubmit>;
