import { addUser, getAllUsers } from "../model/usersModel";
import type { User } from "../model/usersModel";

async function getUsers() {
  const users = await getAllUsers();
  return users;
}

async function createUser(user: User) {
  if (!user.email || !user.name || !user.subscription_type) {
    throw new Error("Missing required user data");
  }

  const newUser = await addUser(user);
  return newUser;
}

export { getUsers, createUser };
