import { jest } from "@jest/globals";
import { runResetDevelopmentDatabaseCli } from "../../src/scripts/resetDevelopmentDatabase.ts";

const safeEnv = {
  NODE_ENV: "development",
  DOCS_DATA_TOOLS_ENABLED: "true",
  DATABASE_URL: "postgresql://user:password@localhost:5432/top_vino",
};

const makeDeps = () => {
  const client = {
    $executeRawUnsafe: jest
      .fn<(query: string) => Promise<number>>()
      .mockResolvedValue(0),
  };
  const disconnectPrisma = jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined);
  const loadPrisma = jest
    .fn<
      () => Promise<{
        default: typeof client;
        disconnectPrisma: typeof disconnectPrisma;
      }>
    >()
    .mockResolvedValue({ default: client, disconnectPrisma });
  const log = jest.fn<(message: string) => void>();
  const logError = jest.fn<(message: string) => void>();
  return { client, disconnectPrisma, loadPrisma, log, logError };
};

describe("runResetDevelopmentDatabaseCli", () => {
  it("never loads the Prisma module when a safety check fails", async () => {
    const deps = makeDeps();
    const exitCode = await runResetDevelopmentDatabaseCli({
      env: { ...safeEnv, NODE_ENV: "production" },
      loadPrisma: deps.loadPrisma,
      log: deps.log,
      logError: deps.logError,
    });

    expect(exitCode).toBe(1);
    expect(deps.loadPrisma).not.toHaveBeenCalled();
    expect(deps.disconnectPrisma).not.toHaveBeenCalled();
    expect(deps.log).not.toHaveBeenCalled();
    expect(deps.logError).toHaveBeenCalledWith(
      expect.stringMatching(/Database reset failed:.*NODE_ENV/),
    );
  });

  it("prints success only after a successful reset and disconnect", async () => {
    const deps = makeDeps();
    const exitCode = await runResetDevelopmentDatabaseCli({
      env: safeEnv,
      loadPrisma: deps.loadPrisma,
      log: deps.log,
      logError: deps.logError,
    });

    expect(exitCode).toBe(0);
    expect(deps.loadPrisma).toHaveBeenCalledTimes(1);
    expect(deps.client.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    expect(deps.disconnectPrisma).toHaveBeenCalledTimes(1);
    expect(deps.logError).not.toHaveBeenCalled();
    expect(deps.log).toHaveBeenCalledTimes(1);
    expect(deps.log).toHaveBeenCalledWith(
      expect.stringMatching(/truncated 10 tables/),
    );
    const disconnectOrder = deps.disconnectPrisma.mock.invocationCallOrder[0];
    const logOrder = deps.log.mock.invocationCallOrder[0];
    expect(disconnectOrder).toBeLessThan(logOrder);
  });

  it("still disconnects exactly once when the reset fails", async () => {
    const deps = makeDeps();
    deps.client.$executeRawUnsafe.mockRejectedValue(new Error("boom"));
    const exitCode = await runResetDevelopmentDatabaseCli({
      env: safeEnv,
      loadPrisma: deps.loadPrisma,
      log: deps.log,
      logError: deps.logError,
    });

    expect(exitCode).toBe(1);
    expect(deps.disconnectPrisma).toHaveBeenCalledTimes(1);
    expect(deps.log).not.toHaveBeenCalled();
    expect(deps.logError).toHaveBeenCalledWith(
      expect.stringMatching(/Database reset failed: boom/),
    );
  });

  it("fails without a success line when only the disconnect fails", async () => {
    const deps = makeDeps();
    deps.disconnectPrisma.mockRejectedValue(new Error("disconnect boom"));
    const exitCode = await runResetDevelopmentDatabaseCli({
      env: safeEnv,
      loadPrisma: deps.loadPrisma,
      log: deps.log,
      logError: deps.logError,
    });

    expect(exitCode).toBe(1);
    expect(deps.log).not.toHaveBeenCalled();
    expect(deps.logError).toHaveBeenCalledTimes(1);
    expect(deps.logError).toHaveBeenCalledWith(
      expect.stringMatching(/Database disconnect failed: disconnect boom/),
    );
  });

  it("reports both failures when reset and disconnect both fail", async () => {
    const deps = makeDeps();
    deps.client.$executeRawUnsafe.mockRejectedValue(new Error("reset boom"));
    deps.disconnectPrisma.mockRejectedValue(new Error("disconnect boom"));
    const exitCode = await runResetDevelopmentDatabaseCli({
      env: safeEnv,
      loadPrisma: deps.loadPrisma,
      log: deps.log,
      logError: deps.logError,
    });

    expect(exitCode).toBe(1);
    expect(deps.log).not.toHaveBeenCalled();
    expect(deps.logError).toHaveBeenCalledTimes(2);
    const messages = deps.logError.mock.calls.map(call => call[0]);
    expect(
      messages.some(message => /reset failed: reset boom/.test(message)),
    ).toBe(true);
    expect(
      messages.some(message =>
        /disconnect failed: disconnect boom/.test(message),
      ),
    ).toBe(true);
  });

  it("redacts database URLs from reported errors", async () => {
    const deps = makeDeps();
    deps.client.$executeRawUnsafe.mockRejectedValue(
      new Error(
        "authentication failed for postgresql://user:hunter2@localhost:5432/top_vino",
      ),
    );
    const exitCode = await runResetDevelopmentDatabaseCli({
      env: safeEnv,
      loadPrisma: deps.loadPrisma,
      log: deps.log,
      logError: deps.logError,
    });

    expect(exitCode).toBe(1);
    const output = deps.logError.mock.calls.map(call => call[0]).join("\n");
    expect(output).not.toContain("hunter2");
    expect(output).not.toContain("postgresql://");
    expect(output).toMatch(/Database reset failed:/);
  });
});
