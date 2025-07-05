import {
  postUser,
  getAllUsers,
  getUserByEmail,
  putUserByEmail,
  deleteUserByEmail,
} from "../model/usersModel";
import type { User } from "../model/usersModel";

async function readUsers() {
  const users = await getAllUsers();
  if (!users || users.length === 0) {
    throw new Error("No users found");
  }
  return users;
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

async function updateUser(email: string, data: Partial<User>) {
  const user = await putUserByEmail(email, data);
  if (!user) {
    throw new Error("User not found");
  }
  return user;
}

async function deleteUser(email: string) {
  const user = await getUserByEmail(email);
  if (!user) {
    throw new Error("User not found");
  }
  await deleteUserByEmail(email);
  return { message: "User deleted successfully" };
}

export { readUsers, readUser, createUser, updateUser, deleteUser };
