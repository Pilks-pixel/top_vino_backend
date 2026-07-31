import * as z from "zod/v4";

export const CreateDeckSchema = z.strictObject({
  name: z.string().min(1, "name is required").max(200),
  topic: z.string().max(200).optional(),
  isPublic: z.boolean().optional().default(false),
});

export const UpdateDeckSchema = z.strictObject({
  name: z.string().min(1).max(200).optional(),
  topic: z.string().max(200).nullable().optional(),
  isPublic: z.boolean().optional(),
});

export type CreateDeckInput = z.infer<typeof CreateDeckSchema>;
export type UpdateDeckInput = z.infer<typeof UpdateDeckSchema>;
