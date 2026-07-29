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
import { CreateDeckSchema, UpdateDeckSchema } from "../../utils/deckSchema.ts";

const deckRouter = express.Router();

deckRouter.get("/", authMiddleware, httpListDecks);
deckRouter.get("/:id", authMiddleware, httpGetDeck);
deckRouter.post(
  "/",
  authMiddleware,
  validationMiddleware(CreateDeckSchema),
  httpCreateDeck,
);
deckRouter.put(
  "/:id",
  authMiddleware,
  validationMiddleware(UpdateDeckSchema),
  httpUpdateDeck,
);
deckRouter.delete("/:id", authMiddleware, httpDeleteDeck);

export default deckRouter;
