import type { Requestor } from "./deckAccess.service.ts";
import { loadDeck, visibleDeckScope } from "./deckAccess.service.ts";
import {
  getDecksByScope,
  createDeck as createDeckModel,
  updateDeckByID,
  deleteDeckByID,
} from "../model/deckModel.ts";
import type { CreateDeckInput, UpdateDeckInput } from "../utils/deckSchema.ts";

type CreateDeckData = CreateDeckInput & { userId: string };

export async function listDecksForUser(
  requestor: Requestor,
  targetUserId: string,
) {
  return getDecksByScope(targetUserId, visibleDeckScope(requestor));
}

export async function getDeck(requestor: Requestor, id: string) {
  return loadDeck(requestor, id, "read");
}

export async function createDeck(data: CreateDeckData) {
  return createDeckModel(data);
}

export async function updateDeck(
  requestor: Requestor,
  id: string,
  data: UpdateDeckInput,
) {
  await loadDeck(requestor, id, "edit");
  return updateDeckByID(id, data);
}
export async function deleteDeck(requestor: Requestor, id: string) {
  await loadDeck(requestor, id, "delete");
  await deleteDeckByID(id);
  return { message: "Deck deleted successfully" };
}
