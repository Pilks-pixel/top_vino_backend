/**
 * Unit tests: user.service
 *
 * Mocks the model layer to test service business logic in isolation.
 * No database required.
 */
import { jest } from "@jest/globals";

// Mock before importing the module under test
jest.unstable_mockModule("../../src/model/usersModel.js", () => ({
  getAllUsers: jest.fn(),
  getUserByID: jest.fn(),
  putUserByID: jest.fn(),
  deleteUserByID: jest.fn(),
}));

const { getAllUsers, getUserByID, putUserByID, deleteUserByID } = await import(
  "../../src/model/usersModel.js"
);

const { readUsers, readUserByID, updateUser, deleteUser } = await import(
  "../../src/services/user.service.js"
);

import { NotFoundError } from "../../src/utils/appError.js";

const mockUser = {
  id: "user-1",
  name: "Alice",
  email: "alice@test.com",
  subscriptionType: "FREE" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  emailVerified: false,
  image: null,
};

beforeEach(() => jest.clearAllMocks());

// ─── readUsers ───────────────────────────────────────────────────────────────

describe("readUsers", () => {
  it("returns all users when records exist", async () => {
    jest.mocked(getAllUsers).mockResolvedValue([mockUser]);
    const result = await readUsers();
    expect(result).toEqual([mockUser]);
  });

  it("throws NotFoundError when no users exist", async () => {
    jest.mocked(getAllUsers).mockResolvedValue([]);
    await expect(readUsers()).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ─── readUserByID ────────────────────────────────────────────────────────────

describe("readUserByID", () => {
  it("returns user when found", async () => {
    jest.mocked(getUserByID).mockResolvedValue(mockUser);
    const result = await readUserByID("user-1");
    expect(result).toEqual(mockUser);
    expect(getUserByID).toHaveBeenCalledWith("user-1");
  });

  it("throws NotFoundError when user does not exist", async () => {
    jest.mocked(getUserByID).mockResolvedValue(null);
    await expect(readUserByID("missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("includes the identifier in the error message", async () => {
    jest.mocked(getUserByID).mockResolvedValue(null);
    const err = await readUserByID("missing").catch(e => e);
    expect(err.message).toContain("missing");
  });
});

// ─── updateUser ──────────────────────────────────────────────────────────────

describe("updateUser", () => {
  it("returns updated user when found", async () => {
    const updated = { ...mockUser, name: "Alice Updated" };
    jest.mocked(getUserByID).mockResolvedValue(mockUser);
    jest.mocked(putUserByID).mockResolvedValue(updated);
    const result = await updateUser("user-1", { name: "Alice Updated" });
    expect(result).toEqual(updated);
  });

  it("throws NotFoundError when user does not exist", async () => {
    jest.mocked(getUserByID).mockResolvedValue(null);
    await expect(updateUser("missing", { name: "X" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("includes the identifier in the error message", async () => {
    jest.mocked(getUserByID).mockResolvedValue(null);
    const err = await updateUser("missing", { name: "X" }).catch(e => e);
    expect(err.message).toContain("missing");
  });
});

// ─── deleteUser ──────────────────────────────────────────────────────────────

describe("deleteUser", () => {
  it("deletes user and returns success message", async () => {
    jest.mocked(getUserByID).mockResolvedValue(mockUser);
    jest.mocked(deleteUserByID).mockResolvedValue(undefined);
    const result = await deleteUser("user-1");
    expect(result).toEqual({ message: "User deleted successfully" });
    expect(deleteUserByID).toHaveBeenCalledWith("user-1");
  });

  it("throws NotFoundError when user does not exist", async () => {
    jest.mocked(getUserByID).mockResolvedValue(null);
    await expect(deleteUser("missing")).rejects.toBeInstanceOf(NotFoundError);
  });
});
