import prisma from "../lib/prisma.ts";
import type { CreateDeckInput, UpdateDeckInput } from "../utils/deckSchema.ts";

export async function getAllDecksForUser(userId: string) {
  return prisma.deck.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDeckByID(id: string) {
  return prisma.deck.findUnique({ where: { id } });
}

export async function createDeck(data: CreateDeckInput) {
  return prisma.deck.create({ data });
}

export async function updateDeckByID(id: string, data: UpdateDeckInput) {
  return prisma.deck.update({ where: { id }, data });
}

export async function deleteDeckByID(id: string) {
  await prisma.deck.delete({ where: { id } });
}
