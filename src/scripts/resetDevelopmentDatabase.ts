import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import {
  assertDevelopmentDataSafety,
  resetDevelopmentDatabase,
  type DevelopmentDataEnvironment,
  type RawSqlClient,
} from "../lib/developmentData.ts";

type PrismaModule = {
  default: RawSqlClient;
  disconnectPrisma(): Promise<void>;
};

export type ResetDevelopmentDatabaseCliDeps = {
  env?: DevelopmentDataEnvironment;
  loadPrisma?: () => Promise<PrismaModule>;
  log?: (message: string) => void;
  logError?: (message: string) => void;
};

// ponytail: keep raw connection strings out of CLI stderr
function sanitizeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/postgres(?:ql)?:\/\/\S+/gi, "<redacted-database-url>");
}

export async function runResetDevelopmentDatabaseCli(
  deps: ResetDevelopmentDatabaseCliDeps = {},
): Promise<number> {
  const env = deps.env ?? process.env;
  const log = deps.log ?? console.log;
  const logError = deps.logError ?? console.error;
  const loadPrisma: () => Promise<PrismaModule> =
    deps.loadPrisma ?? (() => import("../lib/prisma.ts"));

  let prismaModule: PrismaModule | undefined;
  let resetError: unknown;
  let truncatedTables: number | undefined;

  try {
    assertDevelopmentDataSafety(env);
    // ponytail: import Prisma only after every safeguard has passed
    prismaModule = await loadPrisma();
    const result = await resetDevelopmentDatabase({
      env,
      prisma: prismaModule.default,
    });
    truncatedTables = result.truncatedTables;
  } catch (error) {
    resetError = error;
  }

  let disconnectError: unknown;
  if (prismaModule) {
    try {
      await prismaModule.disconnectPrisma();
    } catch (error) {
      disconnectError = error;
    }
  }

  if (
    resetError === undefined &&
    disconnectError === undefined &&
    truncatedTables !== undefined
  ) {
    log(`Development database reset: truncated ${truncatedTables} tables.`);
    return 0;
  }

  if (resetError !== undefined) {
    logError(`Database reset failed: ${sanitizeErrorMessage(resetError)}`);
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
  // values before the Prisma module is imported; dotenv never overrides
  // explicit shell environment values.
  dotenv.config();
  process.exitCode = await runResetDevelopmentDatabaseCli();
}
