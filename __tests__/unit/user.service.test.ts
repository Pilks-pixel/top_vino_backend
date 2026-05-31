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
  getUserByEmail: jest.fn(),
  getUserByID: jest.fn(),
  postUser: jest.fn(),
  putUserByID: jest.fn(),
  deleteUserByID: jest.fn(),
}));

const {
  getAllUsers,
  getUserByEmail,
  getUserByID,
  postUser,
  putUserByID,
  deleteUserByID,
} = await import("../../src/model/usersModel.js");

const {
  readUsers,
  readUser,
  readUserByID,
  createUser,
  updateUser,
  deleteUser,
} = await import("../../src/services/user.service.js");

import { NotFoundError } from "../../src/utils/appError.js";

const mockUser = {
  id: "user-1",
  name: "Alice",
  email: "alice@test.com",
  subscription_type: "FREE" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
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

// ─── readUser (by email) ─────────────────────────────────────────────────────

describe("readUser", () => {
  it("returns user when found by email", async () => {
    jest.mocked(getUserByEmail).mockResolvedValue(mockUser);
    const result = await readUser("alice@test.com");
    expect(result).toEqual(mockUser);
  });

  it("throws NotFoundError when email does not exist", async () => {
    jest.mocked(getUserByEmail).mockResolvedValue(null);
    await expect(readUser("nope@test.com")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

// ─── createUser ──────────────────────────────────────────────────────────────

describe("createUser", () => {
  it("creates and returns the new user", async () => {
    jest.mocked(postUser).mockResolvedValue(mockUser);
    const input = {
      name: "Alice",
      email: "alice@test.com",
      subscription_type: "FREE" as const,
    };
    const result = await createUser(input);
    expect(result).toEqual(mockUser);
    expect(postUser).toHaveBeenCalledWith(input);
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

// Do we need to Test for update failing - trying to update email to one that already exists? No, that is a validation error and should be tested in the controller test, not the service test.

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
