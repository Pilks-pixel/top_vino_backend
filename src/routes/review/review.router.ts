import express from "express";
import {
  httpSubmitReview,
  httpGetDueCards,
  httpGetProgress,
} from "./review.controller.ts";
import validationMiddleware from "../../middlewares/validationMiddleware.ts";
import { SubmitReviewSchema } from "../../utils/reviewSchema.ts";

const reviewRouter = express.Router();

reviewRouter.post(
  "/",
  validationMiddleware(SubmitReviewSchema),
  httpSubmitReview,
);
reviewRouter.get("/due", httpGetDueCards);
reviewRouter.get("/progress/:userId/:cardId", httpGetProgress);

export default reviewRouter;
