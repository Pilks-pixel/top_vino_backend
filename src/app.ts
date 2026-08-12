import express from "express";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import cors from "cors";
import { pinoHttp } from "pino-http";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";

import { auth } from "./lib/auth.ts";
import { logger, serializeRequest, serializeResponse } from "./lib/logger.ts";
import prisma from "./lib/prisma.ts";
import userRouter from "./routes/user/user.router.ts";
import deckRouter from "./routes/deck/deck.router.ts";
import cardRouter from "./routes/card/card.router.ts";
import reviewRouter from "./routes/review/review.router.ts";
import { createErrorHandler } from "./middlewares/errorHandler.ts";
import { authLimiter, generalLimiter } from "./config/rateLimits.ts";

const REQUEST_ID_HEADER = "x-request-id";
const MAX_REQUEST_ID_LENGTH = 128;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._~:/-]+$/;

function isValidRequestId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_REQUEST_ID_LENGTH &&
    REQUEST_ID_PATTERN.test(value)
  );
}

function generateRequestId(req: IncomingMessage, res: ServerResponse): string {
  const inboundRequestId = req.headers[REQUEST_ID_HEADER];
  const requestId = isValidRequestId(inboundRequestId)
    ? inboundRequestId
    : randomUUID();

  res.setHeader("X-Request-Id", requestId);
  return requestId;
}

export function createApp(applicationLogger = logger) {
  const app = express();

  app.use(
    pinoHttp({
      logger: applicationLogger,
      genReqId: generateRequestId,
      serializers: {
        req: serializeRequest,
        res: serializeResponse,
      },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
      credentials: true,
    }),
  );
  app.use("/api/auth", (req, res, next) => {
    res.once("finish", () => {
      if (res.statusCode < 400) return;

      const failureMetadata = {
        event: "authentication_failure",
        route: req.originalUrl.split("?", 1)[0],
        statusCode: res.statusCode,
        requestId: req.id,
      };
      const requestLogger = req.log ?? applicationLogger;

      if (res.statusCode >= 500) {
        requestLogger.error(failureMetadata, "Authentication request failed");
      } else {
        requestLogger.warn(failureMetadata, "Authentication request failed");
      }
    });

    next();
  });
  app.use("/api/auth", authLimiter);
  app.all("/api/auth/{*any}", toNodeHandler(auth));
  app.use(express.json({ limit: "10kb" }));
  app.use(generalLimiter);

  app.get("/", async (_req, res) => {
    res.send("Hello World!");
  });

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/ready", async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ready" });
    } catch (error) {
      const requestLogger = req.log ?? applicationLogger;
      requestLogger.warn(
        {
          event: "readiness_check_failure",
          dependency: "database",
          route: req.originalUrl.split("?", 1)[0],
          statusCode: 503,
          requestId: req.id,
          errorType:
            error instanceof Error ? error.constructor.name : "UnknownError",
        },
        "Readiness check failed",
      );
      res.status(503).json({ status: "unavailable" });
    }
  });

  app.use("/user", userRouter);
  app.use("/deck", deckRouter);
  app.use("/deck/:deckId/cards", cardRouter);
  app.use("/review", reviewRouter);
  app.use(createErrorHandler(applicationLogger));

  return app;
}

const app = createApp();
export default app;
