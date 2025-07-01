import prisma from "../lib/prisma";

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

async function deleteUser(email: string) {
  await prisma.user.delete({
    where: { email },
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

export { addUser, getAllUsers, getUserByEmail, updateUser, deleteUser };
