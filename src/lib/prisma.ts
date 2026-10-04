import { PrismaClient } from "../../generated/prisma/client.js";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

export default prisma;
