import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import {
  assertDevelopmentDataSafety,
  createDocsSeedAuth,
  createDocsSeedPrismaClient,
  seedDocsData,
  type DevelopmentDataEnvironment,
  type DocsSeedAuth,
  type DocsSeedPrismaClient,
  type DocsSeedResult,
} from "../lib/developmentData.ts";

type SeedCliModules = {
  prismaModule: {
    default: DocsSeedPrismaClient;
    disconnectPrisma(): Promise<void>;
  };
  authModule: { auth: DocsSeedAuth };
};

export type SeedDocsDataCliDeps = {
  env?: DevelopmentDataEnvironment;
  loadModules?: () => Promise<SeedCliModules>;
  log?: (message: string) => void;
  logError?: (message: string) => void;
};

// ponytail: keep raw connection strings out of CLI stderr
function sanitizeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/postgres(?:ql)?:\/\/\S+/gi, "<redacted-database-url>");
}

function formatSeedResult(result: DocsSeedResult): string {
  const user = result.userCreated
    ? "created fixture user"
    : "verified existing fixture user";
  const deck = result.deckCreated ? "created deck" : "kept existing deck";
  const cards = `${result.cardsCreated} card(s) created, ${result.cardsExisting} existing`;
  return `${user}, ${deck}, ${cards}.`;
}

export async function runSeedDocsDataCli(
  deps: SeedDocsDataCliDeps = {},
): Promise<number> {
  const env = deps.env ?? process.env;
  const log = deps.log ?? console.log;
  const logError = deps.logError ?? console.error;
  const loadModules: () => Promise<SeedCliModules> =
    deps.loadModules ??
    // ponytail: Prisma and Auth are imported only after every safeguard has
    // passed; the real clients are bridged through compile-checked adapters
    (async () => {
      const [prismaModule, authModule] = await Promise.all([
        import("../lib/prisma.ts"),
        import("../lib/auth.ts"),
      ]);
      return {
        prismaModule: {
          default: createDocsSeedPrismaClient(prismaModule.default),
          disconnectPrisma: prismaModule.disconnectPrisma,
        },
        authModule: { auth: createDocsSeedAuth(authModule.auth) },
      };
    });

  let modules: SeedCliModules | undefined;
  let seedError: unknown;
  let seedResult: DocsSeedResult | undefined;

  try {
    assertDevelopmentDataSafety(env);
    modules = await loadModules();
    seedResult = await seedDocsData({
      env,
      prisma: modules.prismaModule.default,
      auth: modules.authModule.auth,
    });
  } catch (error) {
    seedError = error;
  }

  let disconnectError: unknown;
  if (modules) {
    try {
      await modules.prismaModule.disconnectPrisma();
    } catch (error) {
      disconnectError = error;
    }
  }

  if (
    seedError === undefined &&
    disconnectError === undefined &&
    seedResult !== undefined
  ) {
    log(`Docs seed complete: ${formatSeedResult(seedResult)}`);
    return 0;
  }

  if (seedError !== undefined) {
    logError(`Docs seed failed: ${sanitizeErrorMessage(seedError)}`);
  }
  if (disconnectError !== undefined) {
    logError(
      `Database disconnect failed: ${sanitizeErrorMessage(disconnectError)}`,
    );
  }
  return 1;
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectRun) {
  // ponytail: the CLI loads .env itself so safeguards validate documented
  // values before the Prisma/Auth modules are imported; dotenv never
  // overrides explicit shell environment values.
  dotenv.config();
  process.exitCode = await runSeedDocsDataCli();
}
