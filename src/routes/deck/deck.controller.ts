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
  const rawUserId = req.query.userId;
  if (rawUserId !== undefined && typeof rawUserId !== "string") {
    throw new BadRequestError("Invalid userId query parameter");
  }
  const requestedUserId = rawUserId;

  let targetUserId: string;
  let isPublicFilter: boolean | undefined;

  if (!requestedUserId || requestedUserId === req.user.id) {
    targetUserId = req.user.id;
    isPublicFilter = undefined;
  } else {
    targetUserId = requestedUserId;
    isPublicFilter = true;
  }

  const decks = await listDecksForUser(targetUserId, isPublicFilter);
  res.status(200).json({ success: true, data: decks });
});

export const httpGetDeck = catchAsync(async (req: Request, res: Response) => {
  const deck = await getDeck(req.params.id);
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
    const deck = await updateDeck(req.params.id, req.user.id, req.body);
    res.status(200).json({ success: true, data: deck });
  },
);

export const httpDeleteDeck = catchAsync(
  async (req: Request, res: Response) => {
    const result = await deleteDeck(req.params.id, req.user.id);
    res.status(200).json({ success: true, ...result });
  },
);
