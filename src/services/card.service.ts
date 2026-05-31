import { NotFoundError } from "../utils/appError.ts";
import {
  getCardsForDeck,
  getCardByID,
  createCard as createCardModel,
  updateCardByID,
  deleteCardByID,
} from "../model/cardModel.ts";
import { getDeckByID } from "../model/deckModel.ts";
import type { CreateCardInput, UpdateCardInput } from "../utils/cardSchema.ts";

export async function listCardsForDeck(deckId: string) {
  const deck = await getDeckByID(deckId);
  if (!deck) throw new NotFoundError("Deck", deckId);
  return getCardsForDeck(deckId);
}

export async function getCard(id: string) {
  const card = await getCardByID(id);
  if (!card) throw new NotFoundError("Card", id);
  return card;
}

export async function createCard(data: CreateCardInput & { deckId: string }) {
  const deck = await getDeckByID(data.deckId);
  if (!deck) throw new NotFoundError("Deck", data.deckId);
  const { deckId, ...cardData } = data;
  return createCardModel(deckId, cardData);
}

export async function updateCard(id: string, data: UpdateCardInput) {
  const card = await getCardByID(id);
  if (!card) throw new NotFoundError("Card", id);
  return updateCardByID(id, data);
}

export async function deleteCard(id: string) {
  const card = await getCardByID(id);
  if (!card) throw new NotFoundError("Card", id);
  await deleteCardByID(id);
  return { message: "Card deleted successfully" };
}
