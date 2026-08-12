import { jest } from "@jest/globals";

const users = [
  {
    id: "user-123",
    email: "user@example.com",
    passwordHash: "password-hash-secret",
  },
];
const findMany = jest.fn(() => Promise.resolve(users));
const debug = jest.fn();

jest.unstable_mockModule("../../src/lib/prisma.js", () => ({
  default: { user: { findMany } },
}));
jest.unstable_mockModule("../../src/lib/logger.js", () => ({
  logger: { debug },
}));

const { getAllUsers } = await import("../../src/model/usersModel.js");

describe("getAllUsers", () => {
  it("does not log complete user records", async () => {
    await expect(getAllUsers()).resolves.toEqual(users);

    expect(debug).toHaveBeenCalledWith(
      { event: "users_fetched", count: users.length },
      "Fetched users",
    );
    expect(JSON.stringify(debug.mock.calls)).not.toContain(
      "password-hash-secret",
    );
  });
});
