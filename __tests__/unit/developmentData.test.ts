import { jest } from "@jest/globals";
import {
  DEVELOPMENT_DATA_TABLES,
  assertDevelopmentDataSafety,
  resetDevelopmentDatabase,
} from "../../src/lib/developmentData.ts";

const safeEnv = {
  NODE_ENV: "development",
  DOCS_DATA_TOOLS_ENABLED: "true",
  DATABASE_URL: "postgresql://user:password@localhost:5432/top_vino",
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
