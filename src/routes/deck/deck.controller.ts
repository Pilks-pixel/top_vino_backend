import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { BadRequestError } from "../../utils/appError.ts";
import {
  listDecksForUser,
  getDeck,
  createDeck,
  updateDeck,
  deleteDeck,
} from "../../services/deck.service.ts";

export const httpListDecks = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.query;
  if (!userId || typeof userId !== "string") {
    throw new BadRequestError("userId query parameter is required");
  }
  const decks = await listDecksForUser(userId);
  res.status(200).json({ success: true, data: decks });
});

export const httpGetDeck = catchAsync(async (req: Request, res: Response) => {
  const deck = await getDeck(req.params.id);
  res.status(200).json({ success: true, data: deck });
});

export const httpCreateDeck = catchAsync(
  async (req: Request, res: Response) => {
    /**
     * @todo: This will change when we implement authentication.
     * We will get the userId from the authenticated session instead of the request body. e.g., const userId = req.user.id;
     */

    const deck = await createDeck(req.body);
    res.status(201).json({ success: true, data: deck });
  },
);

export const httpUpdateDeck = catchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.query;
    if (!userId || typeof userId !== "string") {
      throw new BadRequestError("userId query parameter is required");
    }
    const deck = await updateDeck(req.params.id, userId, req.body);
    res.status(200).json({ success: true, data: deck });
  },
);

export const httpDeleteDeck = catchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.query;
    if (!userId || typeof userId !== "string") {
      throw new BadRequestError("userId query parameter is required");
    }
    const result = await deleteDeck(req.params.id, userId);
    res.status(200).json({ success: true, ...result });
  },
);
