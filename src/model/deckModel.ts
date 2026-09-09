import type { Prisma } from "../../generated/prisma/client.js";
import prisma from "../lib/prisma.ts";
import type { CreateDeckData } from "../types/deck.ts";
import type { UpdateDeckInput } from "../utils/deckSchema.ts";

/**
 * Get decks by scope for a specific user.
 * @param targetUserId - The ID of the user whose decks to retrieve.
 * @param scope - The Prisma.DeckWhereInput scope to filter decks.
 * @returns A promise that resolves to an array of decks.
 */
async function getDecksByScope(
  targetUserId: string,
  scope: Prisma.DeckWhereInput,
) {
  return prisma.deck.findMany({
    where: { AND: [{ userId: targetUserId }, scope] },
    orderBy: { createdAt: "desc" },
  });
}

async function createDeck(data: CreateDeckData) {
  return prisma.deck.create({ data });
}

async function updateDeckByID(id: string, data: UpdateDeckInput) {
  return prisma.deck.update({ where: { id }, data });
}

async function deleteDeckByID(id: string) {
  await prisma.deck.delete({ where: { id } });
}

export { getDecksByScope, createDeck, updateDeckByID, deleteDeckByID };
