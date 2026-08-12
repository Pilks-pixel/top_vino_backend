import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger.ts";
import { AppError, ValidationError } from "../utils/appError.ts";
import {
  getPrismaErrorLogMetadata,
  handlePrismaError,
  isPrismaError,
  isExpectedPrismaError,
  isPrismaValidationError,
} from "../utils/prismaErrorHandler.ts";

interface ErrorResponse {
  success: false;
  status: "error";
  statusCode: number;
  message: string;
  details?: unknown;
  stack?: string;
}

/**
 * Determines if we're in development environment
 */
const isDevelopment = process.env.NODE_ENV !== "production";

function safeStack(error: Error): string | undefined {
  if (!error.stack) return undefined;

  const stackLines = error.stack.split("\n").slice(1);
  return stackLines.length > 0 ? stackLines.join("\n") : undefined;
}

function logError(
  err: Error,
  isOperational: boolean,
  requestLogger: typeof logger,
  req: Request,
  originalError: Error,
): void {
  const error = err as AppError;
  const isPersistenceFailure =
    isPrismaError(originalError) || isPrismaValidationError(originalError);
  const metadata = {
    event: isPersistenceFailure
      ? "persistence_failure"
      : error instanceof ValidationError
        ? "validation_failure"
        : isOperational
          ? "request_failure"
          : "application_failure",
    route: req.originalUrl.split("?", 1)[0],
    statusCode: error.status,
    requestId: req.id,
    errorType: originalError.constructor.name,
    ...(isPrismaError(originalError)
      ? getPrismaErrorLogMetadata(originalError)
      : isPrismaValidationError(originalError)
        ? { errorCode: "VALIDATION" }
        : {}),
  };

  if (isPersistenceFailure) {
    if (isPrismaError(originalError) && isExpectedPrismaError(originalError)) {
      requestLogger.warn(metadata, "Persistence request failed");
    } else {
      requestLogger.error(metadata, "Persistence failure");
    }
    return;
  }

  if (error instanceof ValidationError) {
    requestLogger.warn(metadata, "Request validation failed");
    return;
  }

  if (isOperational) {
    requestLogger.warn(metadata, error.message);
  } else {
    const stack = safeStack(error);
    requestLogger.error(
      stack ? { ...metadata, stack } : metadata,
      "Unhandled error",
    );
  }
}

/**
 * Creates a consistent error response object
 */
function createErrorResponse(
  err: AppError,
  includeStack: boolean,
): ErrorResponse {
  const response: ErrorResponse = {
    success: false,
    status: "error",
    statusCode: err.status,
    message: err.message,
  };

  // Include validation details if present
  if (err instanceof ValidationError && err.details) {
    response.details = err.details;
  }

  // Include stack trace in development only
  if (includeStack && err.stack) {
    response.stack = err.stack;
  }

  return response;
}

/**
 * Global error handling middleware
 *
 * Handles:
 * - AppError instances (operational errors)
 * - Prisma database errors
 * - Zod validation errors (via ValidationError)
 * - Unknown errors (500 Internal Server Error)
 *
 * Differentiates between development and production environments:
 * - Development: includes stack traces
 * - Production: sanitizes error messages
 */
function handleError(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
  applicationLogger: typeof logger,
): void {
  let error: AppError;

  // Handle Prisma errors
  if (isPrismaError(err)) {
    error = handlePrismaError(err);
  }
  // Handle Prisma validation errors
  else if (isPrismaValidationError(err)) {
    error = new AppError("Invalid database query", 400);
    error.isOperational = false;
  }
  // Handle existing AppError instances
  else if (err instanceof AppError) {
    error = err;
  }
  // Handle unknown errors
  else {
    error = new AppError(
      isDevelopment ? err.message : "Internal server error",
      500,
    );
    error.isOperational = false;
    error.stack = err.stack;
  }

  // Log the error
  logError(error, error.isOperational, req.log ?? applicationLogger, req, err);

  // Send response
  const response = createErrorResponse(error, isDevelopment);
  res.status(response.statusCode).json(response);
}

export function createErrorHandler(applicationLogger = logger) {
  return function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    handleError(err, req, res, next, applicationLogger);
  };
}

export const errorHandler = createErrorHandler();
