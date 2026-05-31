import express from "express";
import {
  httpListDecks,
  httpGetDeck,
  httpCreateDeck,
  httpUpdateDeck,
  httpDeleteDeck,
} from "./deck.controller.ts";
import validationMiddleware from "../../middlewares/validationMiddleware.ts";
import { CreateDeckSchema, UpdateDeckSchema } from "../../utils/deckSchema.ts";

const deckRouter = express.Router();

deckRouter.get("/", httpListDecks);
deckRouter.get("/:id", httpGetDeck);
deckRouter.post("/", validationMiddleware(CreateDeckSchema), httpCreateDeck);
deckRouter.put("/:id", validationMiddleware(UpdateDeckSchema), httpUpdateDeck);
deckRouter.delete("/:id", httpDeleteDeck);

export default deckRouter;
