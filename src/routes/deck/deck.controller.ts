import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import {
  listDecksForUser,
  getDeck,
  createDeck,
  updateDeck,
  deleteDeck,
} from "../../services/deck.service.ts";

export const httpListDecks = catchAsync(async (req: Request, res: Response) => {
  const userId = req.query.userId;
  const targetUserId = typeof userId === "string" ? userId : req.user.id;
  const decks = await listDecksForUser(req.user, targetUserId);
  res.status(200).json({ success: true, data: decks });
});

export const httpGetDeck = catchAsync(async (req: Request, res: Response) => {
  const deck = await getDeck(req.user, req.params.id);
  res.status(200).json({ success: true, data: deck });
});

export const httpCreateDeck = catchAsync(
  async (req: Request, res: Response) => {
    const deck = await createDeck({ ...req.body, userId: req.user.id });
    res.status(201).json({ success: true, data: deck });
  },
);

export const httpUpdateDeck = catchAsync(
  async (req: Request, res: Response) => {
    const deck = await updateDeck(req.user, req.params.id, req.body);
    res.status(200).json({ success: true, data: deck });
  },
);

export const httpDeleteDeck = catchAsync(
  async (req: Request, res: Response) => {
    const result = await deleteDeck(req.user, req.params.id);
    res.status(200).json({ success: true, ...result });
  },
);
