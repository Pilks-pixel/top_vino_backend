import * as z from "zod/v4";

export const CreateDeckSchema = z
  .strictObject({
    name: z.string().min(1, "name is required").max(200),
    topic: z.string().max(200).optional(),
    isPublic: z.boolean().optional().default(false),
  })
  .meta({ id: "CreateDeck" });

export const UpdateDeckSchema = z
  .strictObject({
    name: z.string().min(1).max(200).optional(),
    topic: z.string().max(200).nullable().optional(),
    isPublic: z.boolean().optional(),
  })
  .meta({ id: "UpdateDeck" });

export const ListDecksQuerySchema = z
  .object({
    userId: z.uuid().optional(),
  })
  .meta({ id: "ListDecksQuery" });

export type CreateDeckInput = z.infer<typeof CreateDeckSchema>;
export type UpdateDeckInput = z.infer<typeof UpdateDeckSchema>;
export type ListDecksQuery = z.infer<typeof ListDecksQuerySchema>;
