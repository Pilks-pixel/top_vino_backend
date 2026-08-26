import * as z from "zod/v4";

/**
 * The single definition of subscription tier. Every FREE/PRO union in the
 * codebase derives from this enum via z.infer — never restate the literals.
 */
export const SubscriptionTier = z.enum(["FREE", "PRO"]);

export type SubscriptionTier = z.infer<typeof SubscriptionTier>;

export const User = z.strictObject({
  email: z.email(),
  name: z.string().optional(),
  subscriptionType: SubscriptionTier,
});

export type User = z.infer<typeof User>;
