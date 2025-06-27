import { PrismaClient } from "../../generated/prisma/client.js";
import { withAccelerate } from "@prisma/extension-accelerate";

const prisma = new PrismaClient().$extends(withAccelerate());

export default prisma;
