import { createServer } from "node:http";
import dotenv from "dotenv";
dotenv.config();

import { validateEnv } from "./utils/env.ts";
import { logger } from "./lib/logger.ts";
import prisma from "./lib/prisma.ts";
import app from "./app.ts";

try {
  validateEnv();
} catch (error) {
  logger.error(
    {
      event: "startup_failure",
      reason: "environment_validation",
      errorType:
        error instanceof Error ? error.constructor.name : "UnknownError",
    },
    "Startup environment validation failed",
  );
  throw error;
}

const port = process.env.PORT || 8000;
const server = createServer(app);
let shutdownStarted = false;

function shutdown(signal: string): void {
  if (shutdownStarted) {
    logger.warn(
      { event: "shutdown_already_started", signal },
      "Shutdown already in progress",
    );
    return;
  }

  shutdownStarted = true;
  logger.info({ event: "shutdown_started", signal }, "Shutdown started");

  // Hard-exit fallback after 10 seconds
  const hardExit = setTimeout(() => {
    logger.error(
      { event: "shutdown_timeout", signal },
      "Graceful shutdown timed out",
    );
    process.exit(1);
  }, 10_000);
  hardExit.unref();

  server.close(async closeError => {
    if (closeError) {
      logger.error(
        {
          event: "http_server_close_failure",
          signal,
          errorType: closeError.constructor.name,
        },
        "HTTP server close failed",
      );
      process.exit(1);
      return;
    }

    logger.info({ event: "http_server_closed", signal }, "HTTP server closed");
    try {
      await prisma.$disconnect();
      logger.info(
        { event: "database_disconnected", signal },
        "Database disconnected",
      );
      process.exit(0);
    } catch (err) {
      logger.error(
        {
          event: "database_disconnect_failure",
          signal,
          errorType:
            err instanceof Error ? err.constructor.name : "UnknownError",
        },
        "Database disconnect failed",
      );
      process.exit(1);
    }
  });
}

function startServer(): void {
  server.on("error", error => {
    logger.error(
      {
        event: "startup_failure",
        reason: "http_server",
        errorType: error.constructor.name,
      },
      "HTTP server failed to start",
    );
    process.exit(1);
  });

  server.listen(port, () => {
    logger.info({ event: "server_started", port }, "Server started");
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startServer();
