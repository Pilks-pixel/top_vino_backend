import * as z from "zod/v4";

import type { Request, Response, NextFunction } from "express";

function validationMiddleware(schema: z.ZodType) {
  return function (req: Request, res: Response, next: NextFunction) {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "Invalid input",
        details: result.error,
      });
      return;
    }
    console.log(result.data);
    next();
  };
}

export default validationMiddleware;
