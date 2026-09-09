import { jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

const mockGetSession = jest.fn<() => Promise<unknown>>();
const mockFromNodeHeaders = jest.fn(headers => headers);

jest.unstable_mockModule("../../src/lib/auth.ts", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

jest.unstable_mockModule("better-auth/node", () => ({
  fromNodeHeaders: mockFromNodeHeaders,
}));

const { authMiddleware } = await import(
  "../../src/middlewares/authMiddleware.ts"
);
import { UnauthorizedError } from "../../src/utils/appError.ts";

const flushAsync = () => new Promise<void>(resolve => setImmediate(resolve));

describe("authMiddleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sets req.user and calls next when session exists", async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
        subscriptionType: "PRO",
      },
    });

    const req = {
      headers: { authorization: "Bearer token" },
    } as unknown as Request;
    const res = {} as unknown as Response;
    const next = jest.fn();

    authMiddleware(req, res, next as NextFunction);
    await flushAsync();

    expect(mockFromNodeHeaders).toHaveBeenCalledWith(req.headers);
    expect(mockGetSession).toHaveBeenCalledWith({ headers: req.headers });
    expect(req.user).toEqual({
      id: "user-1",
      email: "user@example.com",
      subscriptionType: "PRO",
    });
    expect(next).toHaveBeenCalledWith();
  });

  it("forwards UnauthorizedError when no session exists", async () => {
    mockGetSession.mockResolvedValue(null);

    const req = { headers: {} } as unknown as Request;
    const res = {} as unknown as Response;
    const next = jest.fn();

    authMiddleware(req, res, next as NextFunction);
    await flushAsync();

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(UnauthorizedError);
    expect((err as UnauthorizedError).message).toBe("Not authenticated");
  });

  it("maps user shape with id, email, and subscriptionType", async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: "user-2",
        email: "shape@example.com",
        subscriptionType: "FREE",
      },
    });

    const req = { headers: {} } as unknown as Request;
    const res = {} as unknown as Response;
    const next = jest.fn();

    authMiddleware(req, res, next as NextFunction);
    await flushAsync();

    expect(req.user).toEqual({
      id: "user-2",
      email: "shape@example.com",
      subscriptionType: "FREE",
    });
  });
});
