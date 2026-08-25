import { createServer } from "node:http";
import dotenv from "dotenv";
dotenv.config();

import { validateEnv } from "./utils/env.ts";
import { logger } from "./lib/logger.ts";
import prisma from "./lib/prisma.ts";
import app from "./app.ts";

validateEnv();

const port = process.env.PORT || 8000;
const server = createServer(app);

function shutdown(signal: string): void {
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  // Hard-exit fallback after 10 seconds
  const hardExit = setTimeout(() => {
    logger.error("Graceful shutdown timed out. Forcing exit.");
    process.exit(1);
  }, 10_000);
  hardExit.unref();

  server.close(async () => {
    logger.info("HTTP server closed. Disconnecting database...");
    try {
      await prisma.$disconnect();
      logger.info("Database disconnected. Exiting.");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error disconnecting database.");
      process.exit(1);
    }
  });
}

function startServer(): void {
  server.listen(port, () => {
    logger.info(`Server is running on port ${port}`);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startServer();
