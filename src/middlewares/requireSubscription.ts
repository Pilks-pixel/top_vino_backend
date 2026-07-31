import type { Request, Response, NextFunction } from "express";
import type { SubscriptionType } from "../../generated/prisma/index.js";

import { ForbiddenError, UnauthorizedError } from "../utils/appError.ts";

export function requireSubscription(tier: SubscriptionType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");
    if (req.user.subscriptionType !== tier) {
      throw new ForbiddenError(`This feature requires a ${tier} subscription`);
    }

    next();
  };
}
