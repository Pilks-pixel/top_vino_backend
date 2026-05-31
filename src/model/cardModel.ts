import prisma from "../lib/prisma.ts";
import type { CreateCardInput, UpdateCardInput } from "../utils/cardSchema.ts";

export async function getCardsForDeck(deckId: string) {
  return prisma.card.findMany({
    where: { deckId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getCardByID(id: string) {
  return prisma.card.findUnique({ where: { id } });
}

export async function createCard(deckId: string, data: CreateCardInput) {
  return prisma.card.create({ data: { ...data, deckId } });
}

export async function updateCardByID(id: string, data: UpdateCardInput) {
  return prisma.card.update({ where: { id }, data });
}

export async function deleteCardByID(id: string) {
  await prisma.card.delete({ where: { id } });
}
