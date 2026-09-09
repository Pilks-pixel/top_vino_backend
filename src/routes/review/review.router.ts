import express from "express";
import {
  httpSubmitReview,
  httpGetDueCards,
  httpGetProgress,
} from "./review.controller.ts";
import validationMiddleware from "../../middlewares/validationMiddleware.ts";
import { authMiddleware } from "../../middlewares/authMiddleware.ts";
import { SubmitReviewSchema } from "../../utils/reviewSchema.ts";
import { CardIdParamsSchema } from "../../utils/paramsSchema.ts";

const reviewRouter = express.Router();

reviewRouter.use(authMiddleware);

reviewRouter.post(
  "/",
  validationMiddleware(SubmitReviewSchema),
  httpSubmitReview,
);
reviewRouter.get("/due", httpGetDueCards);
reviewRouter.get(
  "/progress/:cardId",
  validationMiddleware(CardIdParamsSchema, "params"),
  httpGetProgress,
);

export default reviewRouter;
