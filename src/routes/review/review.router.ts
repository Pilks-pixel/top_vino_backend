import express from "express";
import {
  httpSubmitReview,
  httpGetDueCards,
  httpGetProgress,
} from "./review.controller.ts";
import validationMiddleware from "../../middlewares/validationMiddleware.ts";
import { authMiddleware } from "../../middlewares/authMiddleware.ts";
import { SubmitReviewSchema } from "../../utils/reviewSchema.ts";

const reviewRouter = express.Router();

reviewRouter.post(
  "/",
  authMiddleware,
  validationMiddleware(SubmitReviewSchema),
  httpSubmitReview,
);
reviewRouter.get("/due", authMiddleware, httpGetDueCards);
reviewRouter.get("/progress/:cardId", authMiddleware, httpGetProgress);

export default reviewRouter;
