import { NotFoundError } from "../utils/appError.ts";
import {
  getAllUsers,
  getUserByID,
  putUserByID,
  deleteUserByID,
} from "../model/usersModel.ts";
import type { User } from "../utils/userSchema.ts";

export async function readUsers() {
  const users = await getAllUsers();
  if (!users || users.length === 0) {
    throw new NotFoundError("Users");
  }
  return users;
}

export async function readUserByID(id: string) {
  const user = await getUserByID(id);
  if (!user) {
    throw new NotFoundError("User", id);
  }
  return user;
}

export async function updateUser(id: string, data: Partial<User>) {
  // First check if user exists
  const existingUser = await getUserByID(id);
  if (!existingUser) {
    throw new NotFoundError("User", id);
  }

  const user = await putUserByID(id, data);
  return user;
}

export async function deleteUser(id: string) {
  const user = await getUserByID(id);
  if (!user) {
    throw new NotFoundError("User", id);
  }
  await deleteUserByID(id);
  return { message: "User deleted successfully" };
}
