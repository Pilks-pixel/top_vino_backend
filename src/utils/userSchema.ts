import * as z from "zod/v4";

/**
 * The single definition of subscription tier. Every FREE/PRO union in the
 * codebase derives from this enum via z.infer — never restate the literals.
 */
export const SubscriptionTier = z
  .enum(["FREE", "PRO"])
  .meta({ id: "SubscriptionTier" });

export type SubscriptionTier = z.infer<typeof SubscriptionTier>;

export const UserProfile = z
  .strictObject({
    id: z.string(),
    email: z.email(),
    name: z.string().nullable(),
    subscriptionType: SubscriptionTier,
  })
  .meta({ id: "UserProfile" });

export type UserProfile = z.infer<typeof UserProfile>;

export const UserUpdate = z
  .strictObject({
    name: z.string(),
  })
  .meta({ id: "UserUpdate" });

export type UserUpdate = z.infer<typeof UserUpdate>;
