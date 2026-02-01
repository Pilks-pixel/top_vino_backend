import { NotFoundError } from "../utils/appError.ts";
import {
  postUser,
  getAllUsers,
  getUserByEmail,
  getUserByID,
  putUserByID,
  deleteUserByID,
} from "../model/usersModel.ts";
import type User from "../utils/userSchema.ts";

async function readUsers() {
  const users = await getAllUsers();
  if (!users || users.length === 0) {
    throw new NotFoundError("Users");
  }
  return users;
}

async function readUserByID(id: string) {
  const user = await getUserByID(id);
  if (!user) {
    throw new NotFoundError("User", id);
  }
  return user;
}

async function readUser(email: string) {
  const user = await getUserByEmail(email);
  if (!user) {
    throw new NotFoundError("User", email);
  }
  return user;
}

async function createUser(user: User) {
  // Validation done with Zod in middleware
  const newUser = await postUser(user);
  return newUser;
}

async function updateUser(id: string, data: Partial<User>) {
  // First check if user exists
  const existingUser = await getUserByID(id);
  if (!existingUser) {
    throw new NotFoundError("User", id);
  }

  const user = await putUserByID(id, data);
  return user;
}

async function deleteUser(id: string) {
  const user = await getUserByID(id);
  if (!user) {
    throw new NotFoundError("User", id);
  }
  await deleteUserByID(id);
  return { message: "User deleted successfully" };
}

export {
  readUsers,
  readUserByID,
  readUser,
  createUser,
  updateUser,
  deleteUser,
};
