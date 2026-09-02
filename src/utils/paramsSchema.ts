import * as z from "zod/v4";

export const IdParamsSchema = z
  .object({
    id: z.uuid(),
  })
  .meta({ id: "IdParams" });

export const DeckIdParamsSchema = z
  .object({
    deckId: z.uuid(),
  })
  .meta({ id: "DeckIdParams" });

export const CardIdParamsSchema = z
  .object({
    cardId: z.uuid(),
  })
  .meta({ id: "CardIdParams" });

export const DeckCardParamsSchema = DeckIdParamsSchema.extend({
  id: z.uuid(),
}).meta({ id: "DeckCardParams" });

export type IdParams = z.infer<typeof IdParamsSchema>;
export type DeckIdParams = z.infer<typeof DeckIdParamsSchema>;
export type CardIdParams = z.infer<typeof CardIdParamsSchema>;
export type DeckCardParams = z.infer<typeof DeckCardParamsSchema>;
