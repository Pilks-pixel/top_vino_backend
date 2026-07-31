import { NotFoundError, ForbiddenError } from "../utils/appError.ts";
import {
  getAllDecksForUser,
  getDeckByID,
  createDeck as createDeckModel,
  updateDeckByID,
  deleteDeckByID,
} from "../model/deckModel.ts";
import type { CreateDeckInput, UpdateDeckInput } from "../utils/deckSchema.ts";

type CreateDeckData = CreateDeckInput & { userId: string };

export async function listDecksForUser(userId: string, isPublic?: boolean) {
  return getAllDecksForUser(userId, isPublic);
}

export async function getDeck(id: string) {
  const deck = await getDeckByID(id);
  if (!deck) throw new NotFoundError("Deck", id);
  return deck;
}

export async function createDeck(data: CreateDeckData) {
  return createDeckModel(data);
}

export async function updateDeck(
  id: string,
  requestorId: string,
  data: UpdateDeckInput,
) {
  const deck = await getDeckByID(id);
  if (!deck) throw new NotFoundError("Deck", id);
  if (deck.userId !== requestorId)
    throw new ForbiddenError("You do not own this deck");
  return updateDeckByID(id, data);
}

export async function deleteDeck(id: string, requestorId: string) {
  const deck = await getDeckByID(id);
  if (!deck) throw new NotFoundError("Deck", id);
  if (deck.userId !== requestorId)
    throw new ForbiddenError("You do not own this deck");
  await deleteDeckByID(id);
  return { message: "Deck deleted successfully" };
}
