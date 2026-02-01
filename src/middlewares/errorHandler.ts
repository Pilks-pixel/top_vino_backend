import type { Request, Response, NextFunction } from "express";
import { AppError, ValidationError } from "../utils/appError.ts";
import {
  handlePrismaError,
  isPrismaError,
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

/**
 * Logs error details to console
 * In Phase 5, this will be replaced with Winston/Pino structured logging
 */
function logError(err: Error, isOperational: boolean): void {
  if (isOperational) {
    // Operational errors: brief log
    console.error(`[ERROR] ${err.message}`);
  } else {
    // Programming errors: full stack trace
    console.error("[CRITICAL ERROR]", err);
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
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let error: AppError;

  // Handle Prisma errors
  if (isPrismaError(err)) {
    error = handlePrismaError(err);
  }
  // Handle Prisma validation errors
  else if (isPrismaValidationError(err)) {
    error = new AppError("Invalid database query", 400);
    error.isOperational = true;
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
  logError(error, error.isOperational);

  // Send response
  const response = createErrorResponse(error, isDevelopment);
  res.status(response.statusCode).json(response);
}
