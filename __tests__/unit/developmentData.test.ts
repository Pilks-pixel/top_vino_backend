import { jest } from "@jest/globals";
import {
  DEVELOPMENT_DATA_TABLES,
  DOCS_SEED_FIXTURE,
  assertDevelopmentDataSafety,
  resetDevelopmentDatabase,
  seedDocsData,
  type DocsSeedAuth,
  type DocsSeedPrismaClient,
  type DocsSeedTransactionClient,
} from "../../src/lib/developmentData.ts";
import { CreateCardSchema } from "../../src/utils/cardSchema.ts";
import { CreateDeckSchema } from "../../src/utils/deckSchema.ts";
import {
  CardIdParamsSchema,
  DeckIdParamsSchema,
  IdParamsSchema,
} from "../../src/utils/paramsSchema.ts";

const safeEnv = {
  NODE_ENV: "development",
  DOCS_DATA_TOOLS_ENABLED: "true",
  DATABASE_URL: "postgresql://user:password@localhost:5432/top_vino",
};

const seedUser = {
  id: "user-1",
  email: DOCS_SEED_FIXTURE.user.email,
  subscriptionType: "FREE",
};

// happy-path world: the fixture user/deck/cards all exist with correct
// ownership, so a successful sign-in verification creates nothing.
const makeSeedWorld = () => {
  const prisma = {
    user: {
      findUnique: jest
        .fn<DocsSeedPrismaClient["user"]["findUnique"]>()
        .mockResolvedValue(seedUser),
    },
    deck: {
      findUnique: jest
        .fn<DocsSeedPrismaClient["deck"]["findUnique"]>()
        .mockResolvedValue({
          id: DOCS_SEED_FIXTURE.deck.id,
          userId: seedUser.id,
        }),
    },
    card: {
      findUnique: jest
        .fn<DocsSeedPrismaClient["card"]["findUnique"]>()
        .mockImplementation(({ where: { id } }) =>
          Promise.resolve({ id, deckId: DOCS_SEED_FIXTURE.deck.id }),
        ),
    },
    session: {
      deleteMany: jest
        .fn<DocsSeedPrismaClient["session"]["deleteMany"]>()
        .mockResolvedValue({}),
    },
    $transaction: <R>(
      run: (tx: DocsSeedTransactionClient) => Promise<R>,
    ): Promise<R> =>
      run({
        deck: { create: () => Promise.resolve({}) },
        card: { create: () => Promise.resolve({}) },
      }),
  };
  const auth = {
    api: {
      signUpEmail: jest.fn<DocsSeedAuth["api"]["signUpEmail"]>(),
      signInEmail: jest
        .fn<DocsSeedAuth["api"]["signInEmail"]>()
        .mockResolvedValue({
          token: "session-token",
          user: { id: seedUser.id },
        }),
    },
  };
  return { prisma, auth };
};

describe("assertDevelopmentDataSafety", () => {
  it.each(["production", "test", "Development", ""])(
    "rejects NODE_ENV=%j",
    nodeEnv => {
      expect(() =>
        assertDevelopmentDataSafety({ ...safeEnv, NODE_ENV: nodeEnv }),
      ).toThrow(/NODE_ENV/);
    },
  );

  it("rejects a missing NODE_ENV", () => {
    const env = { ...safeEnv, NODE_ENV: undefined };
    expect(() => assertDevelopmentDataSafety(env)).toThrow(/NODE_ENV/);
  });

  it.each([undefined, "false", "True", "TRUE", "1", "yes"])(
    "rejects DOCS_DATA_TOOLS_ENABLED=%j",
    value => {
      expect(() =>
        assertDevelopmentDataSafety({
          ...safeEnv,
          DOCS_DATA_TOOLS_ENABLED: value,
        }),
      ).toThrow(/DOCS_DATA_TOOLS_ENABLED/);
    },
  );

  it("rejects a missing DATABASE_URL", () => {
    const env = { ...safeEnv, DATABASE_URL: undefined };
    expect(() => assertDevelopmentDataSafety(env)).toThrow(/DATABASE_URL/);
  });

  it.each(["not-a-url", "postgresql://", ""])(
    "rejects malformed DATABASE_URL=%j",
    url => {
      expect(() =>
        assertDevelopmentDataSafety({ ...safeEnv, DATABASE_URL: url }),
      ).toThrow(/DATABASE_URL/);
    },
  );

  it.each(["http://localhost:5432/top_vino", "mysql://localhost/top_vino"])(
    "rejects non-PostgreSQL DATABASE_URL=%j",
    url => {
      expect(() =>
        assertDevelopmentDataSafety({ ...safeEnv, DATABASE_URL: url }),
      ).toThrow(/PostgreSQL/);
    },
  );

  it.each([
    "db.example.com",
    "localhost.example.com",
    "127.0.0.2",
    "[::1]",
    "0.0.0.0",
  ])("rejects non-local host %j", host => {
    expect(() =>
      assertDevelopmentDataSafety({
        ...safeEnv,
        DATABASE_URL: `postgresql://user:password@${host}:5432/top_vino`,
      }),
    ).toThrow(/local host/);
  });

  it.each([
    "postgresql://user:password@localhost:5432/top_vino",
    "postgres://user:password@127.0.0.1:5432/top_vino",
    "postgresql://user:password@postgres:5432/top_vino",
  ])("accepts the full safeguard set for %j", url => {
    expect(() =>
      assertDevelopmentDataSafety({ ...safeEnv, DATABASE_URL: url }),
    ).not.toThrow();
  });
});

describe("DEVELOPMENT_DATA_TABLES", () => {
  it("lists exactly the ten application and auth tables", () => {
    expect([...DEVELOPMENT_DATA_TABLES].sort()).toEqual(
      [
        "account",
        "session",
        "verification",
        "UserCardReview",
        "UserResponse",
        "UserCardProgress",
        "Card",
        "DeckCollaborator",
        "Deck",
        "user",
      ].sort(),
    );
  });

  it("is frozen so consumer mutation cannot change the reset SQL", async () => {
    expect(Object.isFrozen(DEVELOPMENT_DATA_TABLES)).toBe(true);
    expect(() => {
      (DEVELOPMENT_DATA_TABLES as unknown as string[]).push("evil");
    }).toThrow(TypeError);
    expect(() => {
      (DEVELOPMENT_DATA_TABLES as unknown as string[])[0] = "evil";
    }).toThrow(TypeError);

    const client = {
      $executeRawUnsafe: jest
        .fn<(query: string) => Promise<number>>()
        .mockResolvedValue(0),
    };
    await resetDevelopmentDatabase({ env: safeEnv, prisma: client });
    const sql = client.$executeRawUnsafe.mock.calls[0][0] as string;
    expect(sql).not.toContain("evil");
    expect(sql).toContain('"account"');
  });
});

describe("DOCS_SEED_FIXTURE validation compatibility", () => {
  it("uses payloads and identifiers accepted by the public schemas", () => {
    const { id: deckId, ...deckInput } = DOCS_SEED_FIXTURE.deck;

    expect(() => CreateDeckSchema.parse(deckInput)).not.toThrow();
    expect(() => IdParamsSchema.parse({ id: deckId })).not.toThrow();
    expect(() => DeckIdParamsSchema.parse({ deckId })).not.toThrow();

    for (const card of DOCS_SEED_FIXTURE.cards) {
      const { id: cardId, ...cardInput } = card;

      expect(() => CreateCardSchema.parse(cardInput)).not.toThrow();
      expect(() => CardIdParamsSchema.parse({ cardId })).not.toThrow();
    }
  });
});

describe("resetDevelopmentDatabase", () => {
  const fakeClient = () => ({
    $executeRawUnsafe: jest
      .fn<(query: string) => Promise<number>>()
      .mockResolvedValue(0),
  });

  it("fails every safeguard before touching the database", async () => {
    const client = fakeClient();
    await expect(
      resetDevelopmentDatabase({
        env: { ...safeEnv, NODE_ENV: "production" },
        prisma: client,
      }),
    ).rejects.toThrow(/NODE_ENV/);
    expect(client.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("truncates all ten quoted tables and reports the count", async () => {
    const client = fakeClient();
    const result = await resetDevelopmentDatabase({
      env: safeEnv,
      prisma: client,
    });

    expect(client.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    const sql = client.$executeRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toMatch(/^TRUNCATE TABLE /);
    expect(sql).toMatch(/RESTART IDENTITY CASCADE$/);
    for (const table of DEVELOPMENT_DATA_TABLES) {
      expect(sql).toContain(`"${table}"`);
    }
    expect(result).toEqual({ truncatedTables: 10 });
  });
});

describe("seedDocsData safety", () => {
  it("rejects an unsafe environment before any Prisma or Auth call", async () => {
    const { prisma, auth } = makeSeedWorld();

    await expect(
      seedDocsData({
        env: { ...safeEnv, DOCS_DATA_TOOLS_ENABLED: "false" },
        prisma,
        auth,
      }),
    ).rejects.toThrow(/DOCS_DATA_TOOLS_ENABLED/);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    expect(auth.api.signUpEmail).not.toHaveBeenCalled();
    expect(auth.api.signInEmail).not.toHaveBeenCalled();
  });
});

describe("seedDocsData credential verification", () => {
  it("converts a confirmed INVALID_EMAIL_OR_PASSWORD API error into recovery instructions", async () => {
    const world = makeSeedWorld();
    world.auth.api.signInEmail.mockRejectedValue(
      Object.assign(new Error("Invalid email or password"), {
        body: { code: "INVALID_EMAIL_OR_PASSWORD" },
      }),
    );

    const error = await seedDocsData({
      env: safeEnv,
      prisma: world.prisma,
      auth: world.auth,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect(String(error)).toMatch(/npm run docs:reset[\s\S]*npm run docs:seed/);
    expect(String(error)).not.toContain("INVALID_EMAIL_OR_PASSWORD");
    expect(world.prisma.deck.findUnique).not.toHaveBeenCalled();
    expect(world.prisma.card.findUnique).not.toHaveBeenCalled();
    // no token was collected, so there is nothing to clean up
    expect(world.prisma.session.deleteMany).not.toHaveBeenCalled();
  });

  it("propagates operational sign-in failures unchanged", async () => {
    const world = makeSeedWorld();
    const operational = new Error("connection reset by peer");
    world.auth.api.signInEmail.mockRejectedValue(operational);

    await expect(
      seedDocsData({ env: safeEnv, prisma: world.prisma, auth: world.auth }),
    ).rejects.toBe(operational);

    expect(world.prisma.deck.findUnique).not.toHaveBeenCalled();
    expect(world.prisma.session.deleteMany).not.toHaveBeenCalled();
  });

  it("preserves the seed failure when temporary session cleanup also fails", async () => {
    const world = makeSeedWorld();
    const seedError = new Error("application reconciliation failed");
    const cleanupError = new Error("session cleanup failed");
    world.prisma.deck.findUnique.mockRejectedValue(seedError);
    world.prisma.session.deleteMany.mockRejectedValue(cleanupError);

    const error = await seedDocsData({
      env: safeEnv,
      prisma: world.prisma,
      auth: world.auth,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toEqual([seedError, cleanupError]);
    expect((error as Error).cause).toBe(seedError);
    expect(String(error)).toContain(seedError.message);
    expect(String(error)).toContain(cleanupError.message);
    expect(world.prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ["session-token"] } },
    });
  });
});

describe("seedDocsData user provisioning", () => {
  it("fails when sign-up succeeds but does not persist the fixture user", async () => {
    const world = makeSeedWorld();
    world.prisma.user.findUnique.mockResolvedValue(null);
    world.auth.api.signUpEmail.mockResolvedValue({
      token: null,
      user: { id: seedUser.id },
    });

    await expect(
      seedDocsData({ env: safeEnv, prisma: world.prisma, auth: world.auth }),
    ).rejects.toThrow(/did not persist/);

    expect(world.auth.api.signInEmail).not.toHaveBeenCalled();
    expect(world.prisma.deck.findUnique).not.toHaveBeenCalled();
  });
});
