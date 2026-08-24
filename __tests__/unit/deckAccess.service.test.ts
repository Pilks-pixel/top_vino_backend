import { jest } from "@jest/globals";

const prismaMock = {
  deck: { findUnique: jest.fn<() => Promise<unknown>>() },
  deckCollaborator: { findUnique: jest.fn<() => Promise<unknown>>() },
  card: { findUnique: jest.fn<() => Promise<unknown>>() },
};

jest.unstable_mockModule("../../src/lib/prisma.js", () => ({
  default: prismaMock,
}));

jest.unstable_mockModule("../../generated/prisma/index.js", () => ({
  CollaboratorRole: { EDITOR: "EDITOR", VIEWER: "VIEWER" },
}));

const { loadDeck, loadCard, visibleDeckScope } = await import(
  "../../src/services/deckAccess.service.js"
);

import { ForbiddenError, NotFoundError } from "../../src/utils/appError.js";

const ownerRequestor = { id: "owner-1" };
const editorRequestor = { id: "editor-1" };
const viewerRequestor = { id: "viewer-1" };
const strangerRequestor = { id: "stranger-1" };

const mockPrivateDeck = {
  id: "deck-1",
  userId: "owner-1",
  name: "Private Deck",
  isPublic: false,
  topic: null,
  lastReviewedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPublicDeck = {
  id: "deck-pub",
  userId: "owner-1",
  name: "Public Deck",
  isPublic: true,
  topic: null,
  lastReviewedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCard = {
  id: "card-1",
  deckId: "deck-1",
  type: "basic",
  question: "Q?",
  correctAnswer: null,
  incorrectAnswers: [],
  referenceAnswer: null,
  topic: null,
  subtopic: null,
  sourceType: null,
  sourceMetadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

// ─── loadDeck ─────────────────────────────────────────────────────────────────

describe("loadDeck", () => {
  it("returns deck for owner for every action", async () => {
    prismaMock.deck.findUnique.mockResolvedValue(mockPrivateDeck);
    for (const action of ["read", "edit", "delete"] as const) {
      const deck = await loadDeck(ownerRequestor, "deck-1", action);
      expect(deck.id).toBe("deck-1");
    }
    expect(prismaMock.deckCollaborator.findUnique).not.toHaveBeenCalled();
  });

  it("permits EDITOR read and edit but rejects delete", async () => {
    prismaMock.deck.findUnique.mockResolvedValue(mockPrivateDeck);
    prismaMock.deckCollaborator.findUnique.mockResolvedValue({
      role: "EDITOR",
    });

    await expect(
      loadDeck(editorRequestor, "deck-1", "read"),
    ).resolves.toBeDefined();
    await expect(
      loadDeck(editorRequestor, "deck-1", "edit"),
    ).resolves.toBeDefined();
    await expect(
      loadDeck(editorRequestor, "deck-1", "delete"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("permits VIEWER read but rejects edit and delete", async () => {
    prismaMock.deck.findUnique.mockResolvedValue(mockPrivateDeck);
    prismaMock.deckCollaborator.findUnique.mockResolvedValue({
      role: "VIEWER",
    });

    await expect(
      loadDeck(viewerRequestor, "deck-1", "read"),
    ).resolves.toBeDefined();
    await expect(
      loadDeck(viewerRequestor, "deck-1", "edit"),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      loadDeck(viewerRequestor, "deck-1", "delete"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("permits read of a Public Deck but rejects edit and delete for stranger", async () => {
    prismaMock.deck.findUnique.mockResolvedValue(mockPublicDeck);
    prismaMock.deckCollaborator.findUnique.mockResolvedValue(null);

    await expect(
      loadDeck(strangerRequestor, "deck-pub", "read"),
    ).resolves.toBeDefined();
    await expect(
      loadDeck(strangerRequestor, "deck-pub", "edit"),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      loadDeck(strangerRequestor, "deck-pub", "delete"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("returns 403 for an existing private unshared deck", async () => {
    prismaMock.deck.findUnique.mockResolvedValue(mockPrivateDeck);
    prismaMock.deckCollaborator.findUnique.mockResolvedValue(null);

    await expect(
      loadDeck(strangerRequestor, "deck-1", "read"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("returns 404 for an absent deck", async () => {
    prismaMock.deck.findUnique.mockResolvedValue(null);

    await expect(
      loadDeck(strangerRequestor, "missing", "read"),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(prismaMock.deckCollaborator.findUnique).not.toHaveBeenCalled();
  });
});

// ─── loadCard ─────────────────────────────────────────────────────────────────

describe("loadCard", () => {
  it("returns card when authorized through its deck", async () => {
    prismaMock.card.findUnique.mockResolvedValue(mockCard);
    prismaMock.deck.findUnique.mockResolvedValue(mockPrivateDeck);

    const card = await loadCard(ownerRequestor, "card-1", "read");
    expect(card.id).toBe("card-1");
  });

  it("returns 404 for absent card without querying the deck", async () => {
    prismaMock.card.findUnique.mockResolvedValue(null);

    await expect(
      loadCard(ownerRequestor, "missing", "read"),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(prismaMock.deck.findUnique).not.toHaveBeenCalled();
  });

  it("returns 403 when the card's deck is forbidden, not 404", async () => {
    prismaMock.card.findUnique.mockResolvedValue(mockCard);
    prismaMock.deck.findUnique.mockResolvedValue(mockPrivateDeck);
    prismaMock.deckCollaborator.findUnique.mockResolvedValue(null);

    await expect(
      loadCard(strangerRequestor, "card-1", "read"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ─── visibleDeckScope ─────────────────────────────────────────────────────────

describe("visibleDeckScope", () => {
  it("includes owner, Public Deck, and Collaborator predicates for the Requestor", () => {
    const scope = visibleDeckScope({ id: "user-x" });
    expect(scope).toMatchObject({
      OR: expect.arrayContaining([
        { userId: "user-x" },
        { isPublic: true },
        { collaborators: { some: { userId: "user-x" } } },
      ]),
    });
  });
});
