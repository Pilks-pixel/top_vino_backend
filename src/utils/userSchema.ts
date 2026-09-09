import * as z from "zod/v4";

// Better Auth owns user identifiers and generates opaque strings by default.
// They are not guaranteed to be UUIDs like application-owned resource IDs.
export const UserIdSchema = z
  .string()
  .min(1, "userId is required")
  .describe("Opaque Better Auth user identifier");

/**
 * The single definition of subscription tier. Every FREE/PRO union in the
 * codebase derives from this enum via z.infer — never restate the literals.
 */
export const SubscriptionTierSchema = z
  .enum(["FREE", "PRO"])
  .meta({ id: "SubscriptionTier" });

export type SubscriptionTier = z.infer<typeof SubscriptionTierSchema>;

export const UserProfileSchema = z
  .strictObject({
    id: UserIdSchema,
    email: z.email(),
    name: z.string().nullable(),
    subscriptionType: SubscriptionTierSchema,
  })
  .meta({ id: "UserProfile" });

export type UserProfile = z.infer<typeof UserProfileSchema>;

export const UserUpdateSchema = z
  .strictObject({
    name: z.string(),
  })
  .meta({ id: "UserUpdate" });

export type UserUpdate = z.infer<typeof UserUpdateSchema>;
