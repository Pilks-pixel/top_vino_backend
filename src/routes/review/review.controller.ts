import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { BadRequestError } from "../../utils/appError.ts";
import {
  submitReview,
  listDueCards,
  getProgress,
} from "../../services/review.service.ts";

export const httpSubmitReview = catchAsync(
  async (req: Request, res: Response) => {
    const result = await submitReview(req.body);
    res.status(201).json({ success: true, data: result });
  },
);

export const httpGetDueCards = catchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.query;
    if (!userId || typeof userId !== "string") {
      throw new BadRequestError("userId query parameter is required");
    }
    const cards = await listDueCards(userId);
    res.status(200).json({ success: true, data: cards });
  },
);

export const httpGetProgress = catchAsync(
  async (req: Request, res: Response) => {
    const { userId, cardId } = req.params;
    const progress = await getProgress(userId, cardId);
    res.status(200).json({ success: true, data: progress });
  },
);
