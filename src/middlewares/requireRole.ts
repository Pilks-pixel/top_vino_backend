import type { Request, Response, NextFunction } from "express";
import { CollaboratorRole } from "../../generated/prisma/index.js";

import prisma from "../lib/prisma.ts";
import { ForbiddenError, UnauthorizedError } from "../utils/appError.ts";
import { catchAsync } from "../utils/catchAsync.ts";

type DeckIdExtractor = (req: Request) => string;

export function requireRole(
  getDeckId: DeckIdExtractor,
  minimumRole: CollaboratorRole,
) {
  return catchAsync(
    async (req: Request, _res: Response, next: NextFunction) => {
      if (!req.user) throw new UnauthorizedError("Not authenticated");
      const deckId = getDeckId(req);

      const deck = await prisma.deck.findUnique({ where: { id: deckId } });
      if (!deck) {
        return next();
      }

      if (deck.userId === req.user.id) {
        return next();
      }

      const collaborator = await prisma.deckCollaborator.findUnique({
        where: { deckId_userId: { deckId, userId: req.user.id } },
      });

      if (!collaborator) {
        throw new ForbiddenError("Access denied");
      }

      if (
        minimumRole === CollaboratorRole.EDITOR &&
        collaborator.role !== CollaboratorRole.EDITOR
      ) {
        throw new ForbiddenError("Editor access required");
      }

      next();
    },
  );
}
