import { PrismaClient } from "../../generated/prisma/client.js";
import { withAccelerate } from "@prisma/extension-accelerate";

const prisma = new PrismaClient().$extends(withAccelerate());

async function addUser(user: User) {
  await prisma.user.create({
    data: user,
  });
}

async function getAllUsers() {
  const allUsers = await prisma.user.findMany();
  console.log(allUsers);
  return allUsers;
}

async function getUserByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });
  return user;
}

async function updateUser(email: string, data: Partial<User>) {
  const user = await prisma.user.update({
    where: { email },
    data,
  });
  return user;
}

// Types
export type User = {
  email: string;
  name: string;
  subscription_type: string;
};

export { addUser, getAllUsers, getUserByEmail, updateUser };
