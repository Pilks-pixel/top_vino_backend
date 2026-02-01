import type { Request, Response, NextFunction } from "express";

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

/**
 * Wraps async route handlers to automatically catch errors
 * and forward them to Express error handling middleware.
 *
 * Eliminates the need for try-catch blocks in every controller.
 *
 * @example
 * const getUser = catchAsync(async (req, res) => {
 *   const user = await userService.findById(req.params.id);
 *   res.json(user);
 * });
 */
export function catchAsync(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
