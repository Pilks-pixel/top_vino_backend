import { rateLimit } from "express-rate-limit";

export function createRateLimiters() {
  const headers = {
    standardHeaders: "draft-6",
    legacyHeaders: false,
    // Ignoring untrusted forwarded headers is intentional, including when
    // attackers send them directly. The reviewed Express trust rule owns IPs.
    validate: { xForwardedForHeader: false },
  } as const;

  return {
    generalLimiter: rateLimit({
      ...headers,
      windowMs: 15 * 60 * 1000,
      limit: 100,
    }),
    authLimiter: rateLimit({
      ...headers,
      windowMs: 15 * 60 * 1000,
      limit: 20,
      message: "Too many authentication attempts, please try again later",
    }),
    documentationLimiter: rateLimit({
      ...headers,
      windowMs: 60 * 1000,
      limit: 60,
      message: {
        success: false,
        status: "error",
        statusCode: 429,
        message: "Too many documentation requests, please try again later",
      },
    }),
  };
}
