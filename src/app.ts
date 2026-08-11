import express from "express";
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

export function createApp(applicationLogger = logger) {
  const app = express();

  app.use(
    pinoHttp({
      logger: applicationLogger,
      serializers: {
        req: serializeRequest,
        res: serializeResponse,
      },
    }),
  );
  app.use("/api/auth", authLimiter);
  app.all("/api/auth/{*any}", toNodeHandler(auth));
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
      credentials: true,
    }),
  );
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

  app.get("/ready", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ready" });
    } catch {
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
