import * as z from "zod/v4";

export const IdParamsSchema = z.object({
  id: z.uuid(),
});

export const DeckIdParamsSchema = z.object({
  deckId: z.uuid(),
});

export const CardIdParamsSchema = z.object({
  cardId: z.uuid(),
});

export const DeckCardParamsSchema = DeckIdParamsSchema.extend({
  id: z.uuid(),
});

export type IdParams = z.infer<typeof IdParamsSchema>;
export type DeckIdParams = z.infer<typeof DeckIdParamsSchema>;
export type CardIdParams = z.infer<typeof CardIdParamsSchema>;
export type DeckCardParams = z.infer<typeof DeckCardParamsSchema>;
