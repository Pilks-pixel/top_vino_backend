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
