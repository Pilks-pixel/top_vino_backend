import { jest } from "@jest/globals";
import { runSeedDocsDataCli } from "../../src/scripts/seedDocsData.ts";
import {
  DOCS_SEED_FIXTURE,
  type DocsSeedAuth,
  type DocsSeedPrismaClient,
  type DocsSeedTransactionClient,
} from "../../src/lib/developmentData.ts";

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

const makeDeps = () => {
  // happy-path world: fixture user/deck/cards already exist
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
  const disconnectPrisma = jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined);
  const loadModules = jest
    .fn<
      () => Promise<{
        prismaModule: {
          default: typeof prisma;
          disconnectPrisma: typeof disconnectPrisma;
        };
        authModule: { auth: typeof auth };
      }>
    >()
    .mockResolvedValue({
      prismaModule: { default: prisma, disconnectPrisma },
      authModule: { auth },
    });
  const log = jest.fn<(message: string) => void>();
  const logError = jest.fn<(message: string) => void>();
  return { prisma, disconnectPrisma, loadModules, log, logError };
};

describe("runSeedDocsDataCli", () => {
  it("never loads modules when a safety check fails", async () => {
    const deps = makeDeps();
    const exitCode = await runSeedDocsDataCli({
      env: { ...safeEnv, NODE_ENV: "production" },
      loadModules: deps.loadModules,
      log: deps.log,
      logError: deps.logError,
    });

    expect(exitCode).toBe(1);
    expect(deps.loadModules).not.toHaveBeenCalled();
    expect(deps.disconnectPrisma).not.toHaveBeenCalled();
    expect(deps.log).not.toHaveBeenCalled();
    expect(deps.logError).toHaveBeenCalledWith(
      expect.stringMatching(/Docs seed failed:.*NODE_ENV/),
    );
  });

  it("disconnects, logs the summary, and returns 0 on success", async () => {
    const deps = makeDeps();
    const exitCode = await runSeedDocsDataCli({
      env: safeEnv,
      loadModules: deps.loadModules,
      log: deps.log,
      logError: deps.logError,
    });

    expect(exitCode).toBe(0);
    expect(deps.disconnectPrisma).toHaveBeenCalledTimes(1);
    expect(deps.logError).not.toHaveBeenCalled();
    expect(deps.log).toHaveBeenCalledTimes(1);
    expect(deps.log).toHaveBeenCalledWith(
      expect.stringMatching(
        /Docs seed complete: verified existing fixture user, kept existing deck, 0 card\(s\) created, 3 existing\./,
      ),
    );
  });

  it("still disconnects and returns 1 when the seed fails after modules load", async () => {
    const deps = makeDeps();
    deps.prisma.user.findUnique.mockRejectedValue(new Error("db unreachable"));
    const exitCode = await runSeedDocsDataCli({
      env: safeEnv,
      loadModules: deps.loadModules,
      log: deps.log,
      logError: deps.logError,
    });

    expect(exitCode).toBe(1);
    expect(deps.disconnectPrisma).toHaveBeenCalledTimes(1);
    expect(deps.log).not.toHaveBeenCalled();
    expect(deps.logError).toHaveBeenCalledWith(
      expect.stringMatching(/Docs seed failed: db unreachable/),
    );
  });
});
