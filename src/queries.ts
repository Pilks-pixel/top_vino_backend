// 1
import { PrismaClient } from "../generated/prisma/client.js";

import { withAccelerate } from "@prisma/extension-accelerate";

const prisma = new PrismaClient().$extends(withAccelerate());

async function main() {
  await prisma.user.create({
    data: {
      email: "alice@prisma.io",
      name: "Alice",
    },
  });

  const allUsers = await prisma.user.findMany();
  console.log(allUsers);
}

// main()
//   .then(async () => {
//     await prisma.$disconnect();
//   })
//   .catch(async e => {
//     console.error(e);
//     await prisma.$disconnect();
//     process.exit(1);
//   });

export { main };
