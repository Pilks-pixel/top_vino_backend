import prisma from "../lib/prisma.ts";

import User from "../utils/userSchema.ts";

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

async function getUserByID(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
  });
  return user;
}

async function postUser(user: User) {
  const result = await prisma.user.create({
    data: user,
  });
  return result;
}

async function putUserByID(id: string, data: Partial<User>) {
  const user = await prisma.user.update({
    where: { id },
    data,
  });
  return user;
}

async function deleteUserByID(id: string) {
  await prisma.user.delete({
    where: { id },
  });
}

export {
  postUser,
  getAllUsers,
  getUserByEmail,
  getUserByID,
  putUserByID,
  deleteUserByID,
};
