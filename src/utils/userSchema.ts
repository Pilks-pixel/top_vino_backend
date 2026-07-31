import * as z from "zod/v4";

export const User = z.strictObject({
  email: z.email(),
  name: z.string().optional(),
  subscriptionType: z.enum(["FREE", "PRO"]),
});

export type User = z.infer<typeof User>;
