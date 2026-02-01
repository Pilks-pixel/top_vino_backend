import { Prisma } from "../../generated/prisma/client.js";
import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "./appError.ts";

/**
 * Checks if an error is a Prisma known request error
 */
export function isPrismaError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

/**
 * Checks if an error is a Prisma validation error
 */
export function isPrismaValidationError(
  error: unknown,
): error is Prisma.PrismaClientValidationError {
  return error instanceof Prisma.PrismaClientValidationError;
}

/**
 * Transforms Prisma errors into appropriate AppError subclasses
 * @param error - The Prisma error to transform
 * @returns An AppError instance with appropriate status code and message
 */
export function handlePrismaError(
  error: Prisma.PrismaClientKnownRequestError,
): AppError {
  const meta = error.meta as Record<string, unknown> | undefined;

  switch (error.code) {
    // Unique constraint violation
    case "P2002": {
      const target = meta?.target;
      const fields = Array.isArray(target) ? target.join(", ") : target;
      return new ConflictError(
        `A record with this ${fields || "value"} already exists`,
      );
    }

    // Record not found
    case "P2025": {
      const cause = meta?.cause as string | undefined;
      return new NotFoundError(cause || "Record");
    }

    // Foreign key constraint failed
    case "P2003": {
      const fieldName = meta?.field_name as string | undefined;
      return new BadRequestError(
        `Invalid reference: ${fieldName || "related record"} does not exist`,
      );
    }

    // Required relation violation
    case "P2014": {
      const relationName = meta?.relation_name as string | undefined;
      return new BadRequestError(
        `Required relation '${relationName || "relation"}' violation`,
      );
    }

    // Record to update not found
    case "P2001": {
      return new NotFoundError("Record to update");
    }

    // Record to delete not found
    case "P2016": {
      return new NotFoundError("Record to delete");
    }

    // Null constraint violation
    case "P2011": {
      const constraint = meta?.constraint as string | undefined;
      return new BadRequestError(
        `Missing required field: ${constraint || "field"}`,
      );
    }

    // Value too long for column
    case "P2000": {
      const columnName = meta?.column_name as string | undefined;
      return new BadRequestError(
        `Value too long for field: ${columnName || "field"}`,
      );
    }

    // Default: return generic server error
    default: {
      console.error(`Unhandled Prisma error code: ${error.code}`, error);
      return new AppError("Database operation failed", 500);
    }
  }
}
