import express from "express";
import {
  httpListCards,
  httpGetCard,
  httpCreateCard,
  httpUpdateCard,
  httpDeleteCard,
} from "./card.controller.ts";
import validationMiddleware from "../../middlewares/validationMiddleware.ts";
import { authMiddleware } from "../../middlewares/authMiddleware.ts";
import { CreateCardSchema, UpdateCardSchema } from "../../utils/cardSchema.ts";

// Mounted at /deck/:deckId/cards
const cardRouter = express.Router({ mergeParams: true });

cardRouter.get("/", authMiddleware, httpListCards);
cardRouter.get("/:id", authMiddleware, httpGetCard);
cardRouter.post(
  "/",
  authMiddleware,
  validationMiddleware(CreateCardSchema),
  httpCreateCard,
);
cardRouter.put(
  "/:id",
  authMiddleware,
  validationMiddleware(UpdateCardSchema),
  httpUpdateCard,
);
cardRouter.delete("/:id", authMiddleware, httpDeleteCard);

export default cardRouter;
