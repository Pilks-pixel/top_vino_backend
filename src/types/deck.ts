import type { CreateDeckInput } from "../utils/deckSchema.ts";

export type CreateDeckData = CreateDeckInput & { userId: string };
