import { AppError } from "../utils/appError.ts";
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
    throw new AppError("No users found", 404);
  }
  return users;
}

async function readUserByID(id: string) {
  const user = await getUserByID(id);
  if (!user) {
    throw new AppError("User not found", 404);
  }
  return user;
}

async function readUser(email: string) {
  const user = await getUserByEmail(email);
  if (!user) {
    throw new AppError("User not found", 404);
  }
  return user;
}

async function createUser(user: User) {
  // Validation done with Zod in middleware
  // if (!user.email || !user.name || !user.subscription_type) {
  //   throw new Error("Missing required user data");
  // }

  const newUser = await postUser(user);
  return newUser;
}

async function updateUser(id: string, data: Partial<User>) {
  const user = await putUserByID(id, data);
  if (!user) {
    throw new AppError("No User found to update", 404);
  }
  return user;
}

async function deleteUser(id: string) {
  const user = await getUserByID(id);
  if (!user) {
    throw new AppError("No User found to delete", 404);
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
