import { PrismaClient } from "../../generated/prisma/client.js";
import { withAccelerate } from "@prisma/extension-accelerate";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
}).$extends(withAccelerate());

export default prisma;
