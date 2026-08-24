import type { Prisma } from "../../generated/prisma/client.js";
import { CollaboratorRole } from "../../generated/prisma/index.js";
import prisma from "../lib/prisma.ts";
import { ForbiddenError, NotFoundError } from "../utils/appError.ts";

export type Requestor = { id: string };
export type Action = "read" | "edit" | "delete";

/**
 * Returns a Prisma where input that filters decks visible to the requestor.
 * @param requestor - The user making the request, containing their ID.
 * @returns A Prisma.DeckWhereInput object for filtering visible decks.
 */
export function visibleDeckScope(requestor: Requestor): Prisma.DeckWhereInput {
  return {
    OR: [
      { userId: requestor.id },
      { isPublic: true },
      { collaborators: { some: { userId: requestor.id } } },
    ],
  };
}

/**
 * Loads a deck by its ID and checks if the requestor has the required access.
 * @param requestor - The user making the request, containing their ID.
 * @param deckId - The ID of the deck to be loaded.
 * @param action - The action being performed on the deck (read, edit, delete).
 * @returns The loaded deck if access is granted.
 * @throws NotFoundError if the deck does not exist.
 * @throws ForbiddenError if the requestor does not have access to the deck.
 */
export async function loadDeck(
  requestor: Requestor,
  deckId: string,
  action: Action,
) {
  const deck = await prisma.deck.findUnique({ where: { id: deckId } });
  if (!deck) throw new NotFoundError("Deck", deckId);

  if (deck.userId === requestor.id) return deck;

  if (deck.isPublic && action === "read") return deck;

  const collaborator = await prisma.deckCollaborator.findUnique({
    where: { deckId_userId: { deckId, userId: requestor.id } },
  });

  if (!collaborator) throw new ForbiddenError("Access denied");
  if (action === "delete") throw new ForbiddenError("Access denied");
  if (action === "edit" && collaborator.role !== CollaboratorRole.EDITOR) {
    throw new ForbiddenError("Access denied");
  }

  return deck;
}

/**
 * Loads a card by its ID and checks if the requestor has the required access to the card's deck.
 * @param requestor - The user making the request, containing their ID.
 * @param cardId - The ID of the card to be loaded.
 * @param action - The action being performed on the card (read, edit, delete).
 * @returns The loaded card if access is granted.
 * @throws NotFoundError if the card does not exist.
 * @throws ForbiddenError if the requestor does not have access to the card's deck.
 */
export async function loadCard(
  requestor: Requestor,
  cardId: string,
  action: Action,
) {
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) throw new NotFoundError("Card", cardId);
  await loadDeck(requestor, card.deckId, action);
  return card;
}
