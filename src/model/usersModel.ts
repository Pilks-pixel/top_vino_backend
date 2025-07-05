import prisma from "../lib/prisma";

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

// Types
// Available subscription types for a user.
// - FREE: User has a free subscription.
// - PRO: User has a pro (paid) subscription.
enum SubscriptionType {
  FREE = "FREE",
  PRO = "PRO",
}

export type User = {
  email: string;
  name: string;
  subscription_type: SubscriptionType;
};

export {
  postUser,
  getAllUsers,
  getUserByEmail,
  getUserByID,
  putUserByID,
  deleteUserByID,
};
