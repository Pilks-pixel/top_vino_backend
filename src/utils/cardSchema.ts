import * as z from "zod/v4";

const CardType = z.enum(["basic", "multiple_choice", "cloze", "open_ended"]);

export const CreateCardSchema = z
  .object({
    type: CardType.default("basic"),
    question: z.string().min(1, "question is required"),
    correctAnswer: z.string().optional(),
    incorrectAnswers: z.array(z.string()).optional().default([]),
    referenceAnswer: z.string().optional(),
    topic: z.string().optional(),
    subtopic: z.string().optional(),
    sourceType: z.string().optional(),
  })
  .meta({ id: "CreateCard" });

export const UpdateCardSchema = z
  .object({
    type: CardType.optional(),
    question: z.string().min(1).optional(),
    correctAnswer: z.string().nullable().optional(),
    incorrectAnswers: z.array(z.string()).optional(),
    referenceAnswer: z.string().nullable().optional(),
    topic: z.string().nullable().optional(),
    subtopic: z.string().nullable().optional(),
    sourceType: z.string().nullable().optional(),
  })
  .meta({ id: "UpdateCard" });

export type CreateCardInput = z.infer<typeof CreateCardSchema>;
export type UpdateCardInput = z.infer<typeof UpdateCardSchema>;
