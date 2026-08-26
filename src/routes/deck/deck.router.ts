import express from "express";
import {
  httpListDecks,
  httpGetDeck,
  httpCreateDeck,
  httpUpdateDeck,
  httpDeleteDeck,
} from "./deck.controller.ts";
import validationMiddleware from "../../middlewares/validationMiddleware.ts";
import { authMiddleware } from "../../middlewares/authMiddleware.ts";
import {
  CreateDeckSchema,
  UpdateDeckSchema,
  ListDecksQuerySchema,
} from "../../utils/deckSchema.ts";
import { IdParamsSchema } from "../../utils/paramsSchema.ts";

const deckRouter = express.Router();

deckRouter.get(
  "/",
  authMiddleware,
  validationMiddleware(ListDecksQuerySchema, "query"),
  httpListDecks,
);
deckRouter.get(
  "/:id",
  authMiddleware,
  validationMiddleware(IdParamsSchema, "params"),
  httpGetDeck,
);
deckRouter.post(
  "/",
  authMiddleware,
  validationMiddleware(CreateDeckSchema),
  httpCreateDeck,
);
deckRouter.put(
  "/:id",
  authMiddleware,
  validationMiddleware(IdParamsSchema, "params"),
  validationMiddleware(UpdateDeckSchema),
  httpUpdateDeck,
);
deckRouter.delete(
  "/:id",
  authMiddleware,
  validationMiddleware(IdParamsSchema, "params"),
  httpDeleteDeck,
);

export default deckRouter;
