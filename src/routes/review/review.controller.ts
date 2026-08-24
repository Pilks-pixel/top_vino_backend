import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import {
  submitReview,
  listDueCards,
  getProgress,
} from "../../services/review.service.ts";

export const httpSubmitReview = catchAsync(
  async (req: Request, res: Response) => {
    const result = await submitReview(req.user, req.body);
    res.status(201).json({ success: true, data: result });
  },
);

export const httpGetDueCards = catchAsync(
  async (req: Request, res: Response) => {
    const cards = await listDueCards(req.user);
    res.status(200).json({ success: true, data: cards });
  },
);

export const httpGetProgress = catchAsync(
  async (req: Request, res: Response) => {
    const { cardId } = req.params;
    const progress = await getProgress(req.user, cardId);
    res.status(200).json({ success: true, data: progress });
  },
);
