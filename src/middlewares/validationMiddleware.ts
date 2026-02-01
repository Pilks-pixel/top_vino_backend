import * as z from "zod/v4";

import type { Request, Response, NextFunction } from "express";
import { ValidationError } from "../utils/appError.ts";

/**
 * Creates a validation middleware for the given Zod schema
 * Throws ValidationError if validation fails, which is caught by errorHandler
 *
 * @param schema - Zod schema to validate request body against
 */
function validationMiddleware(schema: z.ZodType) {
  return function (req: Request, _res: Response, next: NextFunction) {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      throw new ValidationError("Validation failed", result.error.format());
    }

    // Attach validated data to request body (replaces with parsed/transformed data)
    req.body = result.data;
    next();
  };
}

export default validationMiddleware;
