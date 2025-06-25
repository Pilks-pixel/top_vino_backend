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
// Types
export type User = {
  email: string;
  name: string;
};

export { addUser, getAllUsers };
