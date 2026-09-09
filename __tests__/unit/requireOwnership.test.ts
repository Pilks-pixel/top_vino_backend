import { jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

import { requireOwnership } from "../../src/middlewares/requireOwnership.ts";
import { ForbiddenError, UnauthorizedError } from "../../src/utils/appError.ts";

describe("requireOwnership", () => {
  it("throws UnauthorizedError when req.user is missing", () => {
    const middleware = requireOwnership(req => req.params.ownerId);
    const req = { params: { ownerId: "user-1" } } as unknown as Request;
    const res = {} as unknown as Response;
    const next = jest.fn();

    expect(() => middleware(req, res, next as NextFunction)).toThrow(
      UnauthorizedError,
    );
  });
  it("calls next when extractor returns req.user.id", () => {
    const middleware = requireOwnership(req => req.params.ownerId);
    const req = {
      user: { id: "user-1" },
      params: { ownerId: "user-1" },
    } as unknown as Request;
    const res = {} as unknown as Response;
    const next = jest.fn();

    middleware(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it("throws ForbiddenError when extractor returns different owner id", () => {
    const middleware = requireOwnership(req => req.params.ownerId);
    const req = {
      user: { id: "user-1" },
      params: { ownerId: "user-2" },
    } as unknown as Request;
    const res = {} as unknown as Response;
    const next = jest.fn();

    expect(() => middleware(req, res, next as NextFunction)).toThrow(
      ForbiddenError,
    );
    expect(() => middleware(req, res, next as NextFunction)).toThrow(
      "You do not own this resource",
    );
  });

  it("throws ForbiddenError when extractor returns null or undefined", () => {
    const nullMiddleware = requireOwnership(() => null);
    const undefinedMiddleware = requireOwnership(() => undefined);

    const req = { user: { id: "user-1" } } as unknown as Request;
    const res = {} as unknown as Response;
    const next = jest.fn();

    expect(() => nullMiddleware(req, res, next as NextFunction)).toThrow(
      ForbiddenError,
    );
    expect(() => undefinedMiddleware(req, res, next as NextFunction)).toThrow(
      ForbiddenError,
    );
  });
});
