import { PrismaClient } from "../../generated/prisma/client.js";

const database = new URL(process.env.DATABASE_URL!);
for (const [key, value] of Object.entries({
  connection_limit: "5",
  connect_timeout: "15",
  pool_timeout: "10",
})) {
  if (!database.searchParams.has(key)) database.searchParams.set(key, value);
}

const prisma = new PrismaClient({
  datasourceUrl: database.href,
});

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

export default prisma;
