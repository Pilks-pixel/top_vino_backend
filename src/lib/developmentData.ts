export type DevelopmentDataEnvironment = {
  NODE_ENV?: string;
  DOCS_DATA_TOOLS_ENABLED?: string;
  DATABASE_URL?: string;
  [key: string]: string | undefined;
};

const LOCAL_DATABASE_HOSTS = ["localhost", "127.0.0.1", "postgres"];

// ponytail: frozen at runtime so no consumer mutation can alter the SQL
// identifiers used by resetDevelopmentDatabase
export const DEVELOPMENT_DATA_TABLES = Object.freeze([
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
] as const);

export type DevelopmentDataResetResult = {
  truncatedTables: number;
};

export type RawSqlClient = {
  $executeRawUnsafe(query: string): Promise<unknown>;
};

export function assertDevelopmentDataSafety(
  env: DevelopmentDataEnvironment = process.env,
): void {
  if (env.NODE_ENV !== "development") {
    throw new Error(
      `Safety check failed: NODE_ENV must be exactly "development"`,
    );
  }
  if (env.DOCS_DATA_TOOLS_ENABLED !== "true") {
    throw new Error(
      `Safety check failed: DOCS_DATA_TOOLS_ENABLED must be exactly "true"`,
    );
  }

  if (!env.DATABASE_URL) {
    throw new Error(`Safety check failed: DATABASE_URL must be set`);
  }
  let url: URL;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    throw new Error(`Safety check failed: DATABASE_URL is not a valid URL`);
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error(
      `Safety check failed: DATABASE_URL must use a PostgreSQL protocol`,
    );
  }
  if (!LOCAL_DATABASE_HOSTS.includes(url.hostname)) {
    throw new Error(
      `Safety check failed: DATABASE_URL must target a local host (${LOCAL_DATABASE_HOSTS.join(", ")})`,
    );
  }
}

export async function resetDevelopmentDatabase(
  options: {
    env?: DevelopmentDataEnvironment;
    prisma?: RawSqlClient;
  } = {},
): Promise<DevelopmentDataResetResult> {
  assertDevelopmentDataSafety(options.env ?? process.env);
  // ponytail: lazy default keeps unit tests and module import from touching .env
  const client = options.prisma ?? (await import("./prisma.ts")).default;
  const tables = DEVELOPMENT_DATA_TABLES.map(table => `"${table}"`).join(", ");
  await client.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`,
  );
  return { truncatedTables: DEVELOPMENT_DATA_TABLES.length };
}

// ponytail: `as const` is sufficient immutability for this module-local
// fixture; fixed UUIDs keep the fixture deterministic and API-compatible
export const DOCS_SEED_FIXTURE = {
  user: {
    name: "Scalar Docs User",
    email: "scalar@example.test",
    password: "TopVinoDocs1!",
  },
  deck: {
    id: "7f8f6f1a-5db0-4b7e-9c0e-3f3b9d2c4a11",
    name: "Wine Fundamentals",
    topic: "wine",
    isPublic: false,
  },
  cards: [
    {
      id: "b1a2c3d4-5e6f-4789-a012-3456789abcde",
      type: "basic",
      question: "What are tannins in wine?",
      correctAnswer:
        "Natural polyphenols from grape skins, seeds, and stems that give red wine its drying, astringent grip.",
      incorrectAnswers: [],
    },
    {
      id: "c2b3d4e5-6f70-489a-b123-456789abcdef",
      type: "multiple_choice",
      question: "Which grape variety is used to make Barolo?",
      correctAnswer: "Nebbiolo",
      incorrectAnswers: ["Sangiovese", "Barbera", "Dolcetto"],
    },
    {
      id: "d3c4e5f6-7081-49ab-a234-56789abcdef0",
      type: "open_ended",
      question: "Describe how malolactic fermentation changes a wine.",
      referenceAnswer:
        "It converts sharp malic acid into softer lactic acid, lowering perceived acidity and often adding buttery, creamy notes.",
      incorrectAnswers: [],
    },
  ],
} as const;

export type DocsSeedResult = {
  userCreated: boolean;
  deckCreated: boolean;
  cardsCreated: number;
  cardsExisting: number;
};

// ponytail: the smallest transaction capability the seed needs — only the
// preflighted deck/card creations, so a mid-reconciliation failure rolls back
// every staged write
export type DocsSeedTransactionClient = {
  deck: {
    create(args: {
      data: {
        id: string;
        userId: string;
        name: string;
        topic: string;
        isPublic: boolean;
      };
    }): Promise<unknown>;
  };
  card: {
    create(args: {
      data: {
        id: string;
        deckId: string;
        type: string;
        question: string;
        correctAnswer?: string;
        incorrectAnswers: string[];
        referenceAnswer?: string;
      };
    }): Promise<unknown>;
  };
};

export type DocsSeedPrismaClient = {
  user: {
    findUnique(args: { where: { email: string } }): Promise<{
      id: string;
      email: string;
      subscriptionType: string;
    } | null>;
  };
  deck: {
    findUnique(args: { where: { id: string } }): Promise<{
      id: string;
      userId: string;
    } | null>;
  };
  card: {
    findUnique(args: { where: { id: string } }): Promise<{
      id: string;
      deckId: string;
    } | null>;
  };
  session: {
    deleteMany(args: { where: { token: { in: string[] } } }): Promise<unknown>;
  };
  $transaction<R>(
    run: (tx: DocsSeedTransactionClient) => Promise<R>,
  ): Promise<R>;
};

// better-auth@1.6.23 contracts: signUpEmail returns `token: string | null`
// (auto sign-in may be skipped); signInEmail returns a session token
export type DocsSeedAuth = {
  api: {
    signUpEmail(args: {
      body: { name: string; email: string; password: string };
    }): Promise<{ token: string | null; user: { id: string } }>;
    signInEmail(args: {
      body: { email: string; password: string };
    }): Promise<{ token: string; user: { id: string } }>;
  };
};

// ponytail: compile-checked adapters — every closure forwards concrete args to
// the real client so TypeScript proves argument/result compatibility; no
// whole-client casts. The Accelerate-extended default client is NOT
// structurally assignable to the minimal surface directly (payload generics
// collapse to {} without call-site inference), which is exactly why the
// closures exist.
export function createDocsSeedPrismaClient(
  client: typeof import("./prisma.ts").default,
): DocsSeedPrismaClient {
  return {
    user: { findUnique: args => client.user.findUnique(args) },
    deck: { findUnique: args => client.deck.findUnique(args) },
    card: { findUnique: args => client.card.findUnique(args) },
    session: { deleteMany: args => client.session.deleteMany(args) },
    $transaction: run =>
      client.$transaction(tx =>
        run({
          deck: { create: args => tx.deck.create(args) },
          card: { create: args => tx.card.create(args) },
        }),
      ),
  };
}

export function createDocsSeedAuth(
  realAuth: typeof import("./auth.ts").auth,
): DocsSeedAuth {
  return {
    api: {
      signUpEmail: async args => {
        const result = await realAuth.api.signUpEmail(args);
        return { token: result.token, user: { id: result.user.id } };
      },
      signInEmail: async args => {
        const result = await realAuth.api.signInEmail(args);
        return { token: result.token, user: { id: result.user.id } };
      },
    },
  };
}

export const DOCS_SEED_CREDENTIAL_RECOVERY =
  "run `npm run docs:reset` then `npm run docs:seed` to recover";

// ponytail: stable recovery instructions only — arbitrary dependency cause
// text could carry credentials or connection strings into logs
function credentialDriftError(): Error {
  return new Error(
    `Seed failed: ${DOCS_SEED_FIXTURE.user.email} already exists but the documented password no longer signs in. ` +
      `Credentials are never changed automatically; ${DOCS_SEED_CREDENTIAL_RECOVERY}.`,
  );
}

// better-auth's APIError carries the failure code only on `body.code`; any
// other failure is operational and must propagate unchanged
function isInvalidCredentialsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { body?: { code?: unknown } }).body?.code ===
      "INVALID_EMAIL_OR_PASSWORD"
  );
}

export async function seedDocsData(
  options: {
    env?: DevelopmentDataEnvironment;
    prisma?: DocsSeedPrismaClient;
    auth?: DocsSeedAuth;
  } = {},
): Promise<DocsSeedResult> {
  const env = options.env ?? process.env;
  assertDevelopmentDataSafety(env);
  // ponytail: lazy defaults keep module import and unit tests from touching
  // .env or opening database connections before the safeguards pass; the real
  // clients go through compile-checked adapters instead of casts
  const prisma: DocsSeedPrismaClient =
    options.prisma ??
    createDocsSeedPrismaClient((await import("./prisma.ts")).default);
  const auth: DocsSeedAuth =
    options.auth ?? createDocsSeedAuth((await import("./auth.ts")).auth);

  // Sessions minted while verifying credentials are seed artifacts: collect
  // the tokens returned by this invocation and delete exactly those sessions
  // on every exit path, leaving pre-existing sessions untouched.
  const seedSessionTokens: string[] = [];
  let seedError: unknown;
  let seedResult: DocsSeedResult | undefined;
  try {
    let user = await prisma.user.findUnique({
      where: { email: DOCS_SEED_FIXTURE.user.email },
    });
    let userCreated = false;
    if (!user) {
      const signUp = await auth.api.signUpEmail({
        body: {
          name: DOCS_SEED_FIXTURE.user.name,
          email: DOCS_SEED_FIXTURE.user.email,
          password: DOCS_SEED_FIXTURE.user.password,
        },
      });
      if (signUp.token !== null) seedSessionTokens.push(signUp.token);
      user = await prisma.user.findUnique({
        where: { email: DOCS_SEED_FIXTURE.user.email },
      });
      if (!user) {
        throw new Error(
          `Seed failed: Better Auth sign-up did not persist the docs fixture user. ${DOCS_SEED_CREDENTIAL_RECOVERY}.`,
        );
      }
      userCreated = true;
    }

    // every resolved user — pre-existing or just created — proves the
    // documented password before any application record is touched; drift
    // never triggers an automatic credential reset
    let signIn: { token: string; user: { id: string } };
    try {
      signIn = await auth.api.signInEmail({
        body: {
          email: DOCS_SEED_FIXTURE.user.email,
          password: DOCS_SEED_FIXTURE.user.password,
        },
      });
    } catch (error) {
      if (isInvalidCredentialsError(error)) throw credentialDriftError();
      throw error;
    }
    seedSessionTokens.push(signIn.token);

    // preflight ownership of the canonical deck and every canonical card
    // before any application write; existing records are never updated
    const deck = await prisma.deck.findUnique({
      where: { id: DOCS_SEED_FIXTURE.deck.id },
    });
    if (deck && deck.userId !== user.id) {
      throw new Error(
        `Seed failed: deterministic deck "${DOCS_SEED_FIXTURE.deck.id}" belongs to another user; refusing to mutate or claim it. ${DOCS_SEED_CREDENTIAL_RECOVERY}.`,
      );
    }

    const missingCards: (typeof DOCS_SEED_FIXTURE.cards)[number][] = [];
    let cardsExisting = 0;
    for (const cardFixture of DOCS_SEED_FIXTURE.cards) {
      const existing = await prisma.card.findUnique({
        where: { id: cardFixture.id },
      });
      if (existing) {
        if (existing.deckId !== DOCS_SEED_FIXTURE.deck.id) {
          throw new Error(
            `Seed failed: deterministic card "${cardFixture.id}" belongs to another deck; refusing to mutate or claim it. ${DOCS_SEED_CREDENTIAL_RECOVERY}.`,
          );
        }
        cardsExisting += 1;
      } else {
        missingCards.push(cardFixture);
      }
    }

    let deckCreated = false;
    if (!deck || missingCards.length > 0) {
      await prisma.$transaction(async tx => {
        if (!deck) {
          await tx.deck.create({
            data: {
              id: DOCS_SEED_FIXTURE.deck.id,
              userId: user.id,
              name: DOCS_SEED_FIXTURE.deck.name,
              topic: DOCS_SEED_FIXTURE.deck.topic,
              isPublic: DOCS_SEED_FIXTURE.deck.isPublic,
            },
          });
        }
        for (const cardFixture of missingCards) {
          await tx.card.create({
            data: {
              id: cardFixture.id,
              deckId: DOCS_SEED_FIXTURE.deck.id,
              type: cardFixture.type,
              question: cardFixture.question,
              ...("correctAnswer" in cardFixture
                ? { correctAnswer: cardFixture.correctAnswer }
                : {}),
              incorrectAnswers: [...cardFixture.incorrectAnswers],
              ...("referenceAnswer" in cardFixture
                ? { referenceAnswer: cardFixture.referenceAnswer }
                : {}),
            },
          });
        }
      });
      deckCreated = !deck;
    }

    seedResult = {
      userCreated,
      deckCreated,
      cardsCreated: missingCards.length,
      cardsExisting,
    };
  } catch (error) {
    seedError = error;
  }

  let cleanupError: unknown;
  if (seedSessionTokens.length > 0) {
    try {
      await prisma.session.deleteMany({
        where: { token: { in: seedSessionTokens } },
      });
    } catch (error) {
      cleanupError = error;
    }
  }

  if (seedError !== undefined && cleanupError !== undefined) {
    const seedMessage =
      seedError instanceof Error ? seedError.message : String(seedError);
    const cleanupMessage =
      cleanupError instanceof Error
        ? cleanupError.message
        : String(cleanupError);
    throw new AggregateError(
      [seedError, cleanupError],
      `${seedMessage}; temporary session cleanup failed: ${cleanupMessage}`,
      { cause: seedError },
    );
  }
  if (seedError !== undefined) throw seedError;
  if (cleanupError !== undefined) throw cleanupError;
  return seedResult!;
}
