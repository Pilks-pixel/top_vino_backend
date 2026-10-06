import express from "express";
import { randomBytes, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import cors from "cors";
import { pinoHttp } from "pino-http";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import { renderApiReference } from "@scalar/client-side-rendering";

import { auth } from "./lib/auth.ts";
import { logger, serializeRequest, serializeResponse } from "./lib/logger.ts";
import { safeRequestPath } from "./lib/loggerCore.ts";
import prisma from "./lib/prisma.ts";
import userRouter from "./routes/user/user.router.ts";
import deckRouter from "./routes/deck/deck.router.ts";
import cardRouter from "./routes/card/card.router.ts";
import reviewRouter from "./routes/review/review.router.ts";
import { createErrorHandler } from "./middlewares/errorHandler.ts";
import { createRateLimiters } from "./config/rateLimits.ts";
import {
  AUTH_CLIENT_IP_HEADER,
  reviewedBrowserOrigins,
  reviewedProxyTrust,
} from "./config/browserBoundary.ts";
import { isSandboxAuthCapability } from "./config/authCapabilities.ts";
import { openApiDocument } from "./openapi.ts";
import {
  authCapabilityWarning,
  rootPage,
  sandboxNotice,
  sandboxWarning,
} from "./config/publicDocumentation.ts";

const REQUEST_ID_HEADER = "x-request-id";
const MAX_REQUEST_ID_LENGTH = 128;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._~:/-]+$/;

/**
 * Validates a client-supplied X-Request-Id.
 *
 * A client-supplied X-Request-Id is trusted only when it is within max
 * length and made of printable token characters; anything else is replaced with a UUID.
 */
function isValidRequestId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_REQUEST_ID_LENGTH &&
    REQUEST_ID_PATTERN.test(value)
  );
}

/**
 * Resolves the correlation ID for a request: keeps a valid inbound
 * X-Request-Id, generates a UUID otherwise, and always echoes the result
 * back on the response so clients and logs share the same ID.
 */
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
  app.set("trust proxy", reviewedProxyTrust());
  const sandbox = process.env.NODE_ENV === "production";
  const { authLimiter, generalLimiter, documentationLimiter } =
    createRateLimiters();

  // Automatic request logging: every response is logged through pino-http
  // with the serialized safe request metadata. Log level follows the status
  // code — 5xx and errors log at error, 4xx at warn, the rest at info.
  app.use(
    pinoHttp({
      logger: applicationLogger,
      genReqId: generateRequestId,
      customLogLevel: (_req, res, err) => {
        if (res.statusCode >= 500 || err) {
          return "error";
        }
        if (res.statusCode >= 400) {
          return "warn";
        }
        return "info";
      },
      serializers: {
        req: serializeRequest,
        res: serializeResponse,
        err: error => ({ type: error.type }),
      },
    }),
  );
  app.use(helmet());
  app.use((req, _res, next) => {
    // Overwrite even a client-supplied value. Both auth layers must use the
    // socket/proxy decision made by Express, never independent raw headers.
    req.headers[AUTH_CLIENT_IP_HEADER] = req.ip;
    next();
  });
  const origins = reviewedBrowserOrigins();
  app.use((_req, res, next) => {
    res.vary("Origin");
    next();
  });
  app.use(
    cors({
      origin: (origin, callback) => {
        callback(null, Boolean(origin && origins.includes(origin)));
      },
      credentials: true,
    }),
  );
  app.use((_req, res, next) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    next();
  });
  app.use("/api/auth", (req, res, next) => {
    res.once("finish", () => {
      if (res.statusCode < 400) return;

      const failureMetadata = {
        event: "authentication_failure",
        route: safeRequestPath(req.originalUrl),
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
  app.use(
    [
      "/docs",
      "/openapi.json",
      "/api/auth/open-api/generate-schema",
      "/robots.txt",
    ],
    documentationLimiter,
  );
  app.get(
    "/docs",
    (req, res, next) => {
      res.locals.cspNonce = randomBytes(16).toString("base64");
      helmet.contentSecurityPolicy({
        directives: {
          scriptSrc: [
            "'self'",
            `'nonce-${res.locals.cspNonce}'`,
            "https://cdn.jsdelivr.net",
          ],
          connectSrc: ["'self'"],
        },
      })(req, res, next);
    },
    (_req, res) => {
      const html = renderApiReference({
        pageTitle: "Top Vino API Reference",
        nonce: res.locals.cspNonce as string,
        config: {
          sources: [
            {
              title: "Top Vino API",
              slug: "top-vino",
              url: "/openapi.json",
              default: true,
            },
            {
              title: "Authentication capabilities",
              slug: "authentication",
              url: "/api/auth/open-api/generate-schema",
            },
          ],
          persistAuth: false,
          telemetry: false,
          proxyUrl: "",
          customFetch: (input, init) =>
            window.fetch(input, { ...init, credentials: "include" }),
        },
      });
      res.type("html").send(html.replace("<body>", `<body>${sandboxNotice}`));
    },
  );
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
          route: safeRequestPath(req.originalUrl),
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

  app.get("/api/auth/open-api/generate-schema", async (_req, res) => {
    const schema = await auth.api.generateOpenAPISchema();
    res.json({
      ...schema,
      info: {
        ...schema.info,
        title: "Better Auth capability reference",
        description: `${authCapabilityWarning} ${sandboxWarning}`,
      },
    });
  });

  app.get("/robots.txt", (_req, res) => {
    res.type("text").send("User-agent: *\nDisallow: /\n");
  });

  app.get("/openapi.json", (_req, res) => {
    res.json(openApiDocument);
  });
  app.use("/api/auth", authLimiter);
  app.use("/api/auth", (req, res, next) => {
    if (sandbox && !isSandboxAuthCapability(req.method, req.path)) {
      res.status(404).json({
        success: false,
        status: "error",
        statusCode: 404,
        message: "Authentication capability unavailable",
      });
      return;
    }
    next();
  });
  // Bound the decoded stream before Better Auth reads it. Keeping the raw
  // text lets its handler retain JSON/form parsing and CSRF behavior.
  app.use("/api/auth", express.text({ type: () => true, limit: "10kb" }));
  app.all(
    "/api/auth/{*any}",
    toNodeHandler(async request => {
      const response = await auth.handler(request);
      // The locked Better Auth release emits X-Retry-After. Keep its sensitive
      // route rules and expose the standard header used by clients/operators.
      if (response.status === 429) {
        const headers = new Headers(response.headers);
        headers.set("Retry-After", headers.get("X-Retry-After") ?? "10");
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      }
      return response;
    }),
  );
  app.use(generalLimiter);
  app.use(express.json({ limit: "10kb" }));
  app.use(express.text({ type: () => true, limit: "10kb" }));

  app.get("/", async (_req, res) => {
    res.type("html").send(rootPage);
  });

  app.use("/user", userRouter);
  app.use("/deck", deckRouter);
  app.use("/deck/:deckId/cards", cardRouter);
  app.use("/review", reviewRouter);
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      status: "error",
      statusCode: 404,
      message: "Route unavailable",
    });
  });
  app.use(createErrorHandler(applicationLogger));

  return app;
}

const app = createApp();
export default app;
