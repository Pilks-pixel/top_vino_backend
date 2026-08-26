import * as z from "zod/v4";

import type { Request, Response, NextFunction } from "express";
import { ValidationError } from "../utils/appError.ts";

type RequestLocation = "body" | "query" | "params";

/**
 * Creates a validation middleware for the given Zod schema
 * Throws ValidationError if validation fails, which is caught by errorHandler
 *
 * @param schema - Zod schema to validate against
 * @param location - Request location to validate (defaults to body)
 */
function validationMiddleware(
  schema: z.ZodType,
  location: RequestLocation = "body",
) {
  return function (req: Request, _res: Response, next: NextFunction) {
    const result = schema.safeParse(req[location]);

    if (!result.success) {
      const formattedErrors = z.treeifyError(result.error);
      throw new ValidationError("Validation failed", formattedErrors);
    }

    // Body is replaced with parsed/transformed data. Params and query are
    // assigned so sibling keys (e.g. mergeParams) are preserved.
    if (location === "body") {
      req.body = result.data;
    } else {
      Object.assign(req[location], result.data);
    }
    next();
  };
}

export default validationMiddleware;
