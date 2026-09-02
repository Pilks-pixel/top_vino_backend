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
    type: CardType.optional().describe(
      "Omit to leave the card type unchanged.",
    ),
    question: z
      .string()
      .min(1)
      .optional()
      .describe("Omit to leave unchanged. Cannot be sent as an empty string."),
    correctAnswer: z
      .string()
      .nullable()
      .optional()
      .describe(
        "Omit to leave unchanged. Send null or an empty string to clear it.",
      ),
    incorrectAnswers: z
      .array(z.string())
      .optional()
      .describe("Omit to leave unchanged. Replaces the entire list when sent."),
    referenceAnswer: z
      .string()
      .nullable()
      .optional()
      .describe(
        "Omit to leave unchanged. Send null or an empty string to clear it.",
      ),
    topic: z
      .string()
      .nullable()
      .optional()
      .describe(
        "Omit to leave unchanged. Send null or an empty string to clear it.",
      ),
    subtopic: z
      .string()
      .nullable()
      .optional()
      .describe(
        "Omit to leave unchanged. Send null or an empty string to clear it.",
      ),
    sourceType: z
      .string()
      .nullable()
      .optional()
      .describe(
        "Omit to leave unchanged. Send null or an empty string to clear it.",
      ),
  })
  .meta({ id: "UpdateCard" });

export type CreateCardInput = z.infer<typeof CreateCardSchema>;
export type UpdateCardInput = z.infer<typeof UpdateCardSchema>;
