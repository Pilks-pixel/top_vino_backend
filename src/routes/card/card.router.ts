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
import {
  DeckCardParamsSchema,
  DeckIdParamsSchema,
} from "../../utils/paramsSchema.ts";

// Mounted at /deck/:deckId/cards
const cardRouter = express.Router({ mergeParams: true });

cardRouter.use(authMiddleware);
cardRouter.use(validationMiddleware(DeckIdParamsSchema, "params"));

cardRouter.get("/", httpListCards);
cardRouter.get(
  "/:id",
  validationMiddleware(DeckCardParamsSchema, "params"),
  httpGetCard,
);
cardRouter.post("/", validationMiddleware(CreateCardSchema), httpCreateCard);
cardRouter.put(
  "/:id",
  validationMiddleware(DeckCardParamsSchema, "params"),
  validationMiddleware(UpdateCardSchema),
  httpUpdateCard,
);
cardRouter.delete(
  "/:id",
  validationMiddleware(DeckCardParamsSchema, "params"),
  httpDeleteCard,
);

export default cardRouter;
