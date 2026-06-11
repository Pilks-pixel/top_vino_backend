import prisma from "../lib/prisma.ts";
import type { CreateDeckInput, UpdateDeckInput } from "../utils/deckSchema.ts";

async function getAllDecksForUser(userId: string) {
  return prisma.deck.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

async function getDeckByID(id: string) {
  return prisma.deck.findUnique({ where: { id } });
}

async function createDeck(data: CreateDeckInput) {
  return prisma.deck.create({ data });
}

async function updateDeckByID(id: string, data: UpdateDeckInput) {
  return prisma.deck.update({ where: { id }, data });
}

async function deleteDeckByID(id: string) {
  await prisma.deck.delete({ where: { id } });
}

export {
  getAllDecksForUser,
  getDeckByID,
  createDeck,
  updateDeckByID,
  deleteDeckByID,
};
