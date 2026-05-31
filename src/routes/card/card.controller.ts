import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import {
  listCardsForDeck,
  getCard,
  createCard,
  updateCard,
  deleteCard,
} from "../../services/card.service.ts";

export const httpListCards = catchAsync(async (req: Request, res: Response) => {
  const cards = await listCardsForDeck(req.params.deckId);
  res.status(200).json({ success: true, data: cards });
});

export const httpGetCard = catchAsync(async (req: Request, res: Response) => {
  const card = await getCard(req.params.id);
  res.status(200).json({ success: true, data: card });
});

export const httpCreateCard = catchAsync(
  async (req: Request, res: Response) => {
    const card = await createCard({ ...req.body, deckId: req.params.deckId });
    res.status(201).json({ success: true, data: card });
  },
);

export const httpUpdateCard = catchAsync(
  async (req: Request, res: Response) => {
    const card = await updateCard(req.params.id, req.body);
    res.status(200).json({ success: true, data: card });
  },
);

export const httpDeleteCard = catchAsync(
  async (req: Request, res: Response) => {
    const result = await deleteCard(req.params.id);
    res.status(200).json({ success: true, ...result });
  },
);
