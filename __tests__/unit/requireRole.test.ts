import { jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

const prismaMock = {
  deck: { findUnique: jest.fn<() => Promise<unknown>>() },
  deckCollaborator: { findUnique: jest.fn<() => Promise<unknown>>() },
};

jest.unstable_mockModule("../../src/lib/prisma.js", () => ({
  default: prismaMock,
  prisma: prismaMock,
}));

jest.unstable_mockModule("../../generated/prisma/index.js", () => ({
  CollaboratorRole: { EDITOR: "EDITOR", VIEWER: "VIEWER" },
}));

const { requireRole } = await import("../../src/middlewares/requireRole.ts");
const { CollaboratorRole } = await import("../../generated/prisma/index.js");
import { ForbiddenError, UnauthorizedError } from "../../src/utils/appError.js";

const flushAsync = () => new Promise<void>(resolve => setImmediate(resolve));

describe("requireRole", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows owner for both VIEWER and EDITOR minimum roles", async () => {
    prismaMock.deck.findUnique.mockResolvedValue({
      id: "deck-1",
      userId: "owner-1",
    });

    const req = {
      user: { id: "owner-1" },
      params: { deckId: "deck-1" },
    } as unknown as Request;
    const res = {} as unknown as Response;

    const nextViewer = jest.fn();
    requireRole(r => r.params.deckId, CollaboratorRole.VIEWER)(
      req,
      res,
      nextViewer as NextFunction,
    );
    await flushAsync();
    expect(nextViewer).toHaveBeenCalledWith();

    const nextEditor = jest.fn();
    requireRole(r => r.params.deckId, CollaboratorRole.EDITOR)(
      req,
      res,
      nextEditor as NextFunction,
    );
    await flushAsync();
    expect(nextEditor).toHaveBeenCalledWith();
  });

  it("calls next when deck does not exist to defer 404 to route handler", async () => {
    prismaMock.deck.findUnique.mockResolvedValue(null);

    const req = {
      user: { id: "user-1" },
      params: { deckId: "missing" },
    } as unknown as Request;
    const res = {} as unknown as Response;
    const next = jest.fn();

    requireRole(r => r.params.deckId, CollaboratorRole.EDITOR)(
      req,
      res,
      next as NextFunction,
    );
    await flushAsync();

    expect(next).toHaveBeenCalledWith();
  });

  it("allows EDITOR collaborator when minimum role is VIEWER", async () => {
    prismaMock.deck.findUnique.mockResolvedValue({
      id: "deck-1",
      userId: "owner-1",
    });
    prismaMock.deckCollaborator.findUnique.mockResolvedValue({
      role: "EDITOR",
    });

    const req = {
      user: { id: "user-2" },
      params: { deckId: "deck-1" },
    } as unknown as Request;
    const res = {} as unknown as Response;
    const next = jest.fn();

    requireRole(r => r.params.deckId, CollaboratorRole.VIEWER)(
      req,
      res,
      next as NextFunction,
    );
    await flushAsync();

    expect(next).toHaveBeenCalledWith();
  });

  it("allows EDITOR collaborator when minimum role is EDITOR", async () => {
    prismaMock.deck.findUnique.mockResolvedValue({
      id: "deck-1",
      userId: "owner-1",
    });
    prismaMock.deckCollaborator.findUnique.mockResolvedValue({
      role: "EDITOR",
    });

    const req = {
      user: { id: "user-2" },
      params: { deckId: "deck-1" },
    } as unknown as Request;
    const res = {} as unknown as Response;
    const next = jest.fn();

    requireRole(r => r.params.deckId, CollaboratorRole.EDITOR)(
      req,
      res,
      next as NextFunction,
    );
    await flushAsync();

    expect(next).toHaveBeenCalledWith();
  });

  it("allows VIEWER collaborator when minimum role is VIEWER", async () => {
    prismaMock.deck.findUnique.mockResolvedValue({
      id: "deck-1",
      userId: "owner-1",
    });
    prismaMock.deckCollaborator.findUnique.mockResolvedValue({
      role: "VIEWER",
    });

    const req = {
      user: { id: "user-2" },
      params: { deckId: "deck-1" },
    } as unknown as Request;
    const res = {} as unknown as Response;
    const next = jest.fn();

    requireRole(r => r.params.deckId, CollaboratorRole.VIEWER)(
      req,
      res,
      next as NextFunction,
    );
    await flushAsync();

    expect(next).toHaveBeenCalledWith();
  });

  it("forwards ForbiddenError when VIEWER collaborator requests EDITOR access", async () => {
    prismaMock.deck.findUnique.mockResolvedValue({
      id: "deck-1",
      userId: "owner-1",
    });
    prismaMock.deckCollaborator.findUnique.mockResolvedValue({
      role: "VIEWER",
    });

    const req = {
      user: { id: "user-2" },
      params: { deckId: "deck-1" },
    } as unknown as Request;
    const res = {} as unknown as Response;
    const next = jest.fn();

    requireRole(r => r.params.deckId, CollaboratorRole.EDITOR)(
      req,
      res,
      next as NextFunction,
    );
    await flushAsync();

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ForbiddenError);
    expect((err as ForbiddenError).message).toBe("Editor access required");
  });

  it("forwards ForbiddenError when no collaborator record exists", async () => {
    prismaMock.deck.findUnique.mockResolvedValue({
      id: "deck-1",
      userId: "owner-1",
    });
    prismaMock.deckCollaborator.findUnique.mockResolvedValue(null);

    const req = {
      user: { id: "user-2" },
      params: { deckId: "deck-1" },
    } as unknown as Request;
    const res = {} as unknown as Response;
    const next = jest.fn();

    requireRole(r => r.params.deckId, CollaboratorRole.VIEWER)(
      req,
      res,
      next as NextFunction,
    );
    await flushAsync();

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ForbiddenError);
    expect((err as ForbiddenError).message).toBe("Access denied");
  });

  it("forwards UnauthorizedError when req.user is missing", async () => {
    const req = { params: { deckId: "deck-1" } } as unknown as Request;
    const res = {} as unknown as Response;
    const next = jest.fn();

    requireRole(r => r.params.deckId, CollaboratorRole.VIEWER)(
      req,
      res,
      next as NextFunction,
    );
    await flushAsync();

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
  });
});
