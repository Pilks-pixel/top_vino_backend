import type { Request, Response, NextFunction } from "express";

import { ForbiddenError, UnauthorizedError } from "../utils/appError.ts";

type OwnerIdExtractor = (req: Request) => string | undefined | null;

export function requireOwnership(getOwnerId: OwnerIdExtractor) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");
    const ownerId = getOwnerId(req);

    if (!ownerId || ownerId !== req.user.id) {
      throw new ForbiddenError("You do not own this resource");
    }

    next();
  };
}
