import prisma from "../lib/prisma.ts";
import { logger } from "../lib/logger.ts";
import type { User } from "../utils/userSchema.ts";

export async function getAllUsers() {
  const allUsers = await prisma.user.findMany();
  logger.debug(
    { event: "users_fetched", count: allUsers.length },
    "Fetched users",
  );
  return allUsers;
}

export async function getUserByID(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
  });
  return user;
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
