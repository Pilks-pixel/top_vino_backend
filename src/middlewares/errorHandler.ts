import type { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: Error & { status?: number }, // Extend Error type
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    message: err.message || "Internal Server Error",
  });
}
