/**
 * Unit tests: error classes
 *
 * Validates that each error class sets the correct status, message,
 * isOperational flag, and prototype chain.
 */
import {
  AppError,
  BadRequestError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "../../src/utils/appError.js";

describe("AppError", () => {
  it("sets status and message", () => {
    const err = new AppError("Something broke", 503);
    expect(err.status).toBe(503);
    expect(err.message).toBe("Something broke");
    expect(err.isOperational).toBe(true);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("BadRequestError", () => {
  it("has status 400 and default message", () => {
    const err = new BadRequestError();
    expect(err.status).toBe(400);
    expect(err.message).toBe("Bad request");
  });

  it("accepts custom message", () => {
    const err = new BadRequestError("Custom bad request");
    expect(err.message).toBe("Custom bad request");
  });
});

describe("ValidationError", () => {
  it("has status 400 and stores details", () => {
    const details = { email: { _errors: ["Invalid email"] } };
    const err = new ValidationError("Validation failed", details);
    expect(err.status).toBe(400);
    expect(err.details).toEqual(details);
  });

  it("is instanceof BadRequestError and AppError", () => {
    const err = new ValidationError();
    expect(err).toBeInstanceOf(BadRequestError);
    expect(err).toBeInstanceOf(AppError);
  });
});

describe("UnauthorizedError", () => {
  it("has status 401", () => {
    const err = new UnauthorizedError();
    expect(err.status).toBe(401);
    expect(err.message).toBe("Authentication required");
  });
});

describe("ForbiddenError", () => {
  it("has status 403", () => {
    const err = new ForbiddenError();
    expect(err.status).toBe(403);
  });
});

describe("NotFoundError", () => {
  it("formats message with resource name only", () => {
    const err = new NotFoundError("Deck");
    expect(err.status).toBe(404);
    expect(err.message).toBe("Deck not found");
  });

  it("formats message with resource and identifier", () => {
    const err = new NotFoundError("User", "abc123");
    expect(err.message).toBe("User with identifier 'abc123' not found");
  });
});

describe("ConflictError", () => {
  it("has status 409", () => {
    const err = new ConflictError("email already exists");
    expect(err.status).toBe(409);
    expect(err.message).toBe("email already exists");
  });
});
