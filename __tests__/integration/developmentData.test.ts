import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

import { UserIdParamsSchema } from "../../src/utils/paramsSchema.ts";
import {
  CardListResponse,
  DeckResponse,
  UserProfileResponse,
} from "../../src/utils/responseSchema.ts";

const { testPrisma, cleanDb, disconnectDb } = await import(
  "../setup/testDb.ts"
);
const {
  createTestUser,
  createTestDeck,
  createTestCard,
  createTestProgress,
  createTestDeckCollaborator,
} = await import("../setup/factories.ts");
const {
  resetDevelopmentDatabase,
  seedDocsData,
  DEVELOPMENT_DATA_TABLES,
  DOCS_SEED_FIXTURE,
} = await import("../../src/lib/developmentData.ts");
const { auth } = await import("../../src/lib/auth.ts");
const { disconnectPrisma } = await import("../../src/lib/prisma.ts");

const commandEnv = {
  NODE_ENV: "development",
  DOCS_DATA_TOOLS_ENABLED: "true",
  DATABASE_URL: process.env.DATABASE_URL,
};

const seedOptions = { env: commandEnv, prisma: testPrisma, auth };

beforeEach(async () => cleanDb());
afterEach(async () => cleanDb());
afterAll(async () => {
  await disconnectDb();
  // auth.ts uses the app Prisma client, which also holds test-database connections
  await disconnectPrisma();
});

describe("resetDevelopmentDatabase (integration)", () => {
  it("targets only the test database", () => {
    expect(process.env.DATABASE_URL).toContain("top_vino_test");
    expect(DEVELOPMENT_DATA_TABLES).toHaveLength(10);
  });

  it("empties all ten application and auth tables", async () => {
    const user = await createTestUser();
    const deck = await createTestDeck(user.id);
    const card = await createTestCard(deck.id);
    await createTestProgress(user.id, card.id);
    await createTestDeckCollaborator(deck.id, user.id, "EDITOR");
    await testPrisma.userResponse.create({
      data: { userId: user.id, cardId: card.id, userInput: "answer" },
    });
    await testPrisma.userCardReview.create({
      data: { userId: user.id, cardId: card.id, quality: 4 },
    });
    await testPrisma.account.create({
      data: {
        id: "account-1",
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
      },
    });
    await testPrisma.session.create({
      data: {
        id: "session-1",
        token: "token-1",
        expiresAt: new Date(Date.now() + 60_000),
        userId: user.id,
      },
    });
    await testPrisma.verification.create({
      data: {
        id: "verification-1",
        identifier: user.email,
        value: "otp",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const result = await resetDevelopmentDatabase({
      env: commandEnv,
      prisma: testPrisma,
    });

    expect(result).toEqual({ truncatedTables: 10 });
    const counts = await Promise.all([
      testPrisma.user.count(),
      testPrisma.account.count(),
      testPrisma.session.count(),
      testPrisma.verification.count(),
      testPrisma.deck.count(),
      testPrisma.deckCollaborator.count(),
      testPrisma.card.count(),
      testPrisma.userCardProgress.count(),
      testPrisma.userResponse.count(),
      testPrisma.userCardReview.count(),
    ]);
    expect(counts).toEqual(Array(10).fill(0));
  });

  it("succeeds on an already-empty database and leaves the schema usable", async () => {
    const first = await resetDevelopmentDatabase({
      env: commandEnv,
      prisma: testPrisma,
    });
    const second = await resetDevelopmentDatabase({
      env: commandEnv,
      prisma: testPrisma,
    });
    expect(first).toEqual(second);

    const user = await createTestUser();
    expect(await testPrisma.user.count()).toBe(1);
    expect(user.id).toBeTruthy();
  });
});

describe("seedDocsData (integration)", () => {
  it("first seed creates a sign-in-ready FREE fixture user with the canonical private deck and three representative cards", async () => {
    expect(process.env.DATABASE_URL).toContain("top_vino_test");

    const result = await seedDocsData(seedOptions);

    expect(result).toEqual({
      userCreated: true,
      deckCreated: true,
      cardsCreated: 3,
      cardsExisting: 0,
    });

    const user = await testPrisma.user.findUnique({
      where: { email: DOCS_SEED_FIXTURE.user.email },
    });
    expect(user).not.toBeNull();
    expect(user!.subscriptionType).toBe("FREE");

    // the documented credentials must authenticate through real Better Auth
    const signIn = await auth.api.signInEmail({
      body: {
        email: DOCS_SEED_FIXTURE.user.email,
        password: DOCS_SEED_FIXTURE.user.password,
      },
    });
    expect(signIn).toBeTruthy();

    const deck = await testPrisma.deck.findUnique({
      where: { id: DOCS_SEED_FIXTURE.deck.id },
      include: { cards: true },
    });
    expect(deck).not.toBeNull();
    expect(deck!.userId).toBe(user!.id);
    expect(deck!.name).toBe(DOCS_SEED_FIXTURE.deck.name);
    expect(deck!.isPublic).toBe(false);
    expect(deck!.cards).toHaveLength(3);

    expect(() => UserIdParamsSchema.parse({ id: user!.id })).not.toThrow();
    expect(() =>
      UserProfileResponse.parse({
        success: true,
        data: {
          id: user!.id,
          name: user!.name,
          email: user!.email,
          subscriptionType: user!.subscriptionType,
        },
      }),
    ).not.toThrow();
    const { cards, ...deckResponseData } = deck!;
    expect(() =>
      DeckResponse.parse({
        success: true,
        data: JSON.parse(JSON.stringify(deckResponseData)),
      }),
    ).not.toThrow();
    expect(() =>
      CardListResponse.parse({
        success: true,
        data: JSON.parse(JSON.stringify(cards)),
      }),
    ).not.toThrow();

    const cardsById = new Map(deck!.cards.map(card => [card.id, card]));
    const [basic, multipleChoice, openEnded] = DOCS_SEED_FIXTURE.cards;

    const basicCard = cardsById.get(basic.id);
    expect(basicCard?.type).toBe("basic");
    expect(basicCard?.correctAnswer).toBe(basic.correctAnswer);

    const mcCard = cardsById.get(multipleChoice.id);
    expect(mcCard?.type).toBe("multiple_choice");
    expect(mcCard?.correctAnswer).toBe(multipleChoice.correctAnswer);
    expect(mcCard?.incorrectAnswers.length).toBeGreaterThanOrEqual(3);
    expect(mcCard?.incorrectAnswers).not.toContain(mcCard?.correctAnswer);

    const openCard = cardsById.get(openEnded.id);
    expect(openCard?.type).toBe("open_ended");
    expect(openCard?.referenceAnswer).toBe(openEnded.referenceAnswer);
  });

  it("second seed verifies the documented credentials and creates no duplicates or leftover sessions", async () => {
    expect(process.env.DATABASE_URL).toContain("top_vino_test");
    await seedDocsData(seedOptions);

    // one credential account, and every session minted during seeding is gone
    expect(await testPrisma.account.count()).toBe(1);
    expect(await testPrisma.session.count()).toBe(0);

    const result = await seedDocsData(seedOptions);

    expect(result).toEqual({
      userCreated: false,
      deckCreated: false,
      cardsCreated: 0,
      cardsExisting: 3,
    });
    expect(await testPrisma.user.count()).toBe(1);
    expect(await testPrisma.account.count()).toBe(1);
    expect(await testPrisma.session.count()).toBe(0);
    expect(await testPrisma.deck.count()).toBe(1);
    expect(await testPrisma.card.count()).toBe(3);
  });

  it("preserves developer edits to existing canonical records on repeat seeding", async () => {
    expect(process.env.DATABASE_URL).toContain("top_vino_test");
    await seedDocsData(seedOptions);

    await testPrisma.deck.update({
      where: { id: DOCS_SEED_FIXTURE.deck.id },
      data: { name: "My Renamed Deck", topic: "developer experiments" },
    });
    const [basic] = DOCS_SEED_FIXTURE.cards;
    await testPrisma.card.update({
      where: { id: basic.id },
      data: { question: "Edited question", correctAnswer: "Edited answer" },
    });

    const result = await seedDocsData(seedOptions);

    expect(result).toEqual({
      userCreated: false,
      deckCreated: false,
      cardsCreated: 0,
      cardsExisting: 3,
    });
    const deck = await testPrisma.deck.findUnique({
      where: { id: DOCS_SEED_FIXTURE.deck.id },
    });
    expect(deck?.name).toBe("My Renamed Deck");
    expect(deck?.topic).toBe("developer experiments");
    const card = await testPrisma.card.findUnique({ where: { id: basic.id } });
    expect(card?.question).toBe("Edited question");
    expect(card?.correctAnswer).toBe("Edited answer");
  });

  it("recreates a missing canonical card with its initial values", async () => {
    expect(process.env.DATABASE_URL).toContain("top_vino_test");
    await seedDocsData(seedOptions);
    const [, multipleChoice] = DOCS_SEED_FIXTURE.cards;
    await testPrisma.card.delete({ where: { id: multipleChoice.id } });

    const result = await seedDocsData(seedOptions);

    expect(result).toEqual({
      userCreated: false,
      deckCreated: false,
      cardsCreated: 1,
      cardsExisting: 2,
    });
    const recreated = await testPrisma.card.findUnique({
      where: { id: multipleChoice.id },
    });
    expect(recreated?.type).toBe("multiple_choice");
    expect(recreated?.question).toBe(multipleChoice.question);
    expect(recreated?.correctAnswer).toBe(multipleChoice.correctAnswer);
    expect(recreated?.incorrectAnswers).toEqual([
      ...multipleChoice.incorrectAnswers,
    ]);
    expect(await testPrisma.card.count()).toBe(3);
  });

  it("recreates a missing canonical deck together with its absent cards", async () => {
    expect(process.env.DATABASE_URL).toContain("top_vino_test");
    await seedDocsData(seedOptions);
    // delete dependent canonical cards first: Card.deckId has no cascade
    await testPrisma.card.deleteMany({
      where: { deckId: DOCS_SEED_FIXTURE.deck.id },
    });
    await testPrisma.deck.delete({ where: { id: DOCS_SEED_FIXTURE.deck.id } });

    const result = await seedDocsData(seedOptions);

    expect(result).toEqual({
      userCreated: false,
      deckCreated: true,
      cardsCreated: 3,
      cardsExisting: 0,
    });
    const deck = await testPrisma.deck.findUnique({
      where: { id: DOCS_SEED_FIXTURE.deck.id },
      include: { cards: true },
    });
    const user = await testPrisma.user.findUnique({
      where: { email: DOCS_SEED_FIXTURE.user.email },
    });
    expect(deck?.userId).toBe(user?.id);
    expect(deck?.name).toBe(DOCS_SEED_FIXTURE.deck.name);
    expect(deck?.cards).toHaveLength(3);
  });

  it("fails with recovery instructions when the fixture email exists with different credentials and never mutates fixture data", async () => {
    expect(process.env.DATABASE_URL).toContain("top_vino_test");
    // the fixture email was already registered with a different password
    await auth.api.signUpEmail({
      body: {
        name: "Earlier Docs User",
        email: DOCS_SEED_FIXTURE.user.email,
        password: "DifferentPassword1!",
      },
    });
    const decksBefore = await testPrisma.deck.count();
    const cardsBefore = await testPrisma.card.count();

    await expect(seedDocsData(seedOptions)).rejects.toThrow(
      /npm run docs:reset[\s\S]*npm run docs:seed/,
    );

    // no application fixture data was created or changed
    expect(await testPrisma.deck.count()).toBe(decksBefore);
    expect(await testPrisma.card.count()).toBe(cardsBefore);
    // the unknown password was not reset to the documented one
    await expect(
      auth.api.signInEmail({
        body: {
          email: DOCS_SEED_FIXTURE.user.email,
          password: "DifferentPassword1!",
        },
      }),
    ).resolves.toBeTruthy();
  });

  it("fails rather than claiming the canonical deck ID owned by another user", async () => {
    expect(process.env.DATABASE_URL).toContain("top_vino_test");
    const otherUser = await createTestUser();
    await testPrisma.deck.create({
      data: {
        id: DOCS_SEED_FIXTURE.deck.id,
        userId: otherUser.id,
        name: "Someone Else's Deck",
      },
    });

    await expect(seedDocsData(seedOptions)).rejects.toThrow(
      /belongs to another user/,
    );

    const deck = await testPrisma.deck.findUnique({
      where: { id: DOCS_SEED_FIXTURE.deck.id },
    });
    expect(deck?.name).toBe("Someone Else's Deck");
    expect(deck?.userId).toBe(otherUser.id);
    expect(await testPrisma.card.count()).toBe(0);
  });

  it("fails rather than claiming a canonical card ID owned by another deck", async () => {
    expect(process.env.DATABASE_URL).toContain("top_vino_test");
    await seedDocsData(seedOptions);
    const [basic] = DOCS_SEED_FIXTURE.cards;
    await testPrisma.card.delete({ where: { id: basic.id } });
    const otherUser = await createTestUser();
    const otherDeck = await createTestDeck(otherUser.id);
    await testPrisma.card.create({
      data: {
        id: basic.id,
        deckId: otherDeck.id,
        type: "basic",
        question: "Someone else's question",
        incorrectAnswers: [],
      },
    });

    await expect(seedDocsData(seedOptions)).rejects.toThrow(
      /belongs to another deck/,
    );

    const card = await testPrisma.card.findUnique({ where: { id: basic.id } });
    expect(card?.deckId).toBe(otherDeck.id);
    expect(card?.question).toBe("Someone else's question");
    // the failed seed's sign-in session was cleaned up on the way out
    expect(await testPrisma.session.count()).toBe(0);
  });
});
