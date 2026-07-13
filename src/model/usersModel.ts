import prisma from "../lib/prisma.ts";
import type { User } from "../utils/userSchema.ts";

export async function getAllUsers() {
  const allUsers = await prisma.user.findMany();
  console.log(allUsers);
  return allUsers;
}

export async function getUserByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });
  return user;
}

export async function getUserByID(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
  });
  return user;
}

export async function postUser(user: User) {
  const result = await prisma.user.create({
    data: user,
  });
  return result;
}

export async function putUserByID(id: string, data: Partial<User>) {
  const user = await prisma.user.update({
    where: { id },
    data,
  });
  return user;
}

export async function deleteUserByID(id: string) {
  await prisma.user.delete({
    where: { id },
  });
}
