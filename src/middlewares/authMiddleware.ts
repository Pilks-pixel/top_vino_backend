import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.ts";
import { catchAsync } from "../utils/catchAsync.ts";
import { UnauthorizedError } from "../utils/appError.ts";
import type { SubscriptionTier } from "../utils/userSchema.ts";

type SessionUser = {
  id: string;
  email: string;
  subscriptionType?: SubscriptionTier;
};

export const authMiddleware = catchAsync(async (req, _res, next) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    throw new UnauthorizedError("Not authenticated");
  }

  const sessionUser = session.user as SessionUser;

  req.user = {
    id: sessionUser.id,
    email: sessionUser.email,
    subscriptionType: sessionUser.subscriptionType ?? "FREE",
  };

  next();
});
