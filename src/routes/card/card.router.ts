import express from "express";
import {
  httpListCards,
  httpGetCard,
  httpCreateCard,
  httpUpdateCard,
  httpDeleteCard,
} from "./card.controller.ts";
import validationMiddleware from "../../middlewares/validationMiddleware.ts";
import { CreateCardSchema, UpdateCardSchema } from "../../utils/cardSchema.ts";

// Mounted at /deck/:deckId/cards
const cardRouter = express.Router({ mergeParams: true });

cardRouter.get("/", httpListCards);
cardRouter.get("/:id", httpGetCard);
cardRouter.post("/", validationMiddleware(CreateCardSchema), httpCreateCard);
cardRouter.put("/:id", validationMiddleware(UpdateCardSchema), httpUpdateCard);
cardRouter.delete("/:id", httpDeleteCard);

export default cardRouter;
