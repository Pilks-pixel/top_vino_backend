import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

const { testPrisma, cleanDb, disconnectDb } = await import(
  "../setup/testDb.js"
);
const {
  createTestUser,
  createTestDeck,
  createTestCard,
  createTestProgress,
  createTestDeckCollaborator,
} = await import("../setup/factories.js");
const { resetDevelopmentDatabase, DEVELOPMENT_DATA_TABLES } = await import(
  "../../src/lib/developmentData.ts"
);

const commandEnv = {
  NODE_ENV: "development",
  DOCS_DATA_TOOLS_ENABLED: "true",
  DATABASE_URL: process.env.DATABASE_URL,
};

beforeEach(async () => cleanDb());
afterEach(async () => cleanDb());
afterAll(async () => disconnectDb());

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
