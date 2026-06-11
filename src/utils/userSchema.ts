import * as z from "zod/v4";

export const User = z.strictObject({
  email: z.email(),
  name: z.string().min(2).max(100),
  subscription_type: z.enum(["FREE", "PRO"]),
});

export type User = z.infer<typeof User>;
