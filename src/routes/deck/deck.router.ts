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

deckRouter.use(authMiddleware);

deckRouter.get(
  "/",
  validationMiddleware(ListDecksQuerySchema, "query"),
  httpListDecks,
);
deckRouter.get(
  "/:id",
  validationMiddleware(IdParamsSchema, "params"),
  httpGetDeck,
);
deckRouter.post("/", validationMiddleware(CreateDeckSchema), httpCreateDeck);
deckRouter.put(
  "/:id",
  validationMiddleware(IdParamsSchema, "params"),
  validationMiddleware(UpdateDeckSchema),
  httpUpdateDeck,
);
deckRouter.delete(
  "/:id",
  validationMiddleware(IdParamsSchema, "params"),
  httpDeleteDeck,
);

export default deckRouter;
