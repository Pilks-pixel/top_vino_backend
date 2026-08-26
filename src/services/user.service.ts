import { NotFoundError } from "../utils/appError.ts";
import {
  getUserByID,
  putUserByID,
  deleteUserByID,
} from "../model/usersModel.ts";
import type { UserUpdate } from "../utils/userSchema.ts";

export async function readUserByID(id: string) {
  const user = await getUserByID(id);
  if (!user) {
    throw new NotFoundError("User", id);
  }
  return user;
}

export async function updateUser(id: string, data: UserUpdate) {
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
