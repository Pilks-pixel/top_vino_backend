import { jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

import { requireSubscription } from "../../src/middlewares/requireSubscription.ts";
import { ForbiddenError, UnauthorizedError } from "../../src/utils/appError.ts";

describe("requireSubscription", () => {
  it("throws UnauthorizedError when req.user is missing", () => {
    const middleware = requireSubscription("PRO");
    const req = {} as unknown as Request;
    const res = {} as unknown as Response;
    const next = jest.fn();

    expect(() => middleware(req, res, next as NextFunction)).toThrow(
      UnauthorizedError,
    );
  });
  it("calls next when user subscription matches required tier", () => {
    const middleware = requireSubscription("PRO");
    const req = { user: { subscriptionType: "PRO" } } as unknown as Request;
    const res = {} as unknown as Response;
    const next = jest.fn();

    middleware(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it("throws ForbiddenError with tier in message when tier does not match", () => {
    const middleware = requireSubscription("PRO");
    const req = { user: { subscriptionType: "FREE" } } as unknown as Request;
    const res = {} as unknown as Response;
    const next = jest.fn();

    expect(() => middleware(req, res, next as NextFunction)).toThrow(
      ForbiddenError,
    );
    expect(() => middleware(req, res, next as NextFunction)).toThrow(
      "This feature requires a PRO subscription",
    );
  });

  it("blocks a FREE user when PRO is required", () => {
    const middleware = requireSubscription("PRO");
    const req = { user: { subscriptionType: "FREE" } } as unknown as Request;
    const res = {} as unknown as Response;
    const next = jest.fn();

    expect(() => middleware(req, res, next as NextFunction)).toThrow(
      ForbiddenError,
    );
  });

  it("allows a FREE user when FREE is required", () => {
    const middleware = requireSubscription("FREE");
    const req = { user: { subscriptionType: "FREE" } } as unknown as Request;
    const res = {} as unknown as Response;
    const next = jest.fn();

    middleware(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });
});
