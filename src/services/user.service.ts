import {
  postUser,
  getAllUsers,
  getUserByEmail,
  getUserByID,
  putUserByID,
  deleteUserByID,
} from "../model/usersModel";
import type { User } from "../model/usersModel";

async function readUsers() {
  const users = await getAllUsers();
  if (!users || users.length === 0) {
    throw new Error("No users found");
  }
  return users;
}

async function readUserByID(id: string) {
  const user = await getUserByID(id);
  if (!user) {
    throw new Error("User not found");
  }
  return user;
}

async function readUser(email: string) {
  const user = await getUserByEmail(email);
  if (!user) {
    throw new Error("User not found");
  }
  return user;
}

async function createUser(user: User) {
  if (!user.email || !user.name || !user.subscription_type) {
    throw new Error("Missing required user data");
  }

  const newUser = await postUser(user);
  return newUser;
}

async function updateUser(id: string, data: Partial<User>) {
  const user = await putUserByID(id, data);
  if (!user) {
    throw new Error("User not found");
  }
  return user;
}

async function deleteUser(id: string) {
  const user = await getUserByID(id);
  if (!user) {
    throw new Error("User not found");
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
