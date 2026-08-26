import type { SubscriptionTier } from "../utils/userSchema.ts";

declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        email: string;
        subscriptionType: SubscriptionTier;
      };
    }
  }
}

export {};
