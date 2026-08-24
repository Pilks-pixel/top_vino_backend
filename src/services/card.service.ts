import type { Requestor } from "./deckAccess.service.ts";
import { loadCard, loadDeck } from "./deckAccess.service.ts";
import {
  getCardsForDeck,
  createCard as createCardModel,
  updateCardByID,
  deleteCardByID,
} from "../model/cardModel.ts";
import { NotFoundError } from "../utils/appError.ts";
import type { CreateCardInput, UpdateCardInput } from "../utils/cardSchema.ts";

export async function listCardsForDeck(requestor: Requestor, deckId: string) {
  await loadDeck(requestor, deckId, "read");
  return getCardsForDeck(deckId);
}

export async function getCard(
  requestor: Requestor,
  deckId: string,
  cardId: string,
) {
  const card = await loadCard(requestor, cardId, "read");
  if (card.deckId !== deckId) throw new NotFoundError("Card", cardId);
  return card;
}

export async function createCard(
  requestor: Requestor,
  deckId: string,
  data: CreateCardInput,
) {
  await loadDeck(requestor, deckId, "edit");
  return createCardModel(deckId, data);
}

export async function updateCard(
  requestor: Requestor,
  deckId: string,
  cardId: string,
  data: UpdateCardInput,
) {
  const card = await loadCard(requestor, cardId, "edit");
  if (card.deckId !== deckId) throw new NotFoundError("Card", cardId);
  return updateCardByID(cardId, data);
}

export async function deleteCard(
  requestor: Requestor,
  deckId: string,
  cardId: string,
) {
  const card = await loadCard(requestor, cardId, "edit");
  if (card.deckId !== deckId) throw new NotFoundError("Card", cardId);
  await deleteCardByID(cardId);
  return { message: "Card deleted successfully" };
}
