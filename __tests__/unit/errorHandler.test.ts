import type { Request, Response } from "express";
import { jest } from "@jest/globals";
import * as z from "zod/v4";
import { createLogger } from "../../src/lib/logger.ts";
import { createErrorHandler } from "../../src/middlewares/errorHandler.ts";
import { errorResponseSchema } from "../../src/middlewares/errorHandler.ts";
import { ValidationError } from "../../src/utils/appError.ts";

const requestId = "application-failure-request-123";
const output: string[] = [];
const testLogger = createLogger({
  environment: "production",
  logLevel: "info",
  destination: {
    write(message: string): void {
      output.push(message);
    },
  },
});

describe("errorHandler logging", () => {
  beforeEach(() => {
    output.length = 0;
  });

  it("logs unexpected application failures as safe errors", () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const request = {
      id: requestId,
      originalUrl: "/unexpected?secret-query",
      log: testLogger,
    } as unknown as Request;

    createErrorHandler(testLogger)(
      new Error("application-password-secret"),
      request,
      response as unknown as Response,
      jest.fn(),
    );

    const errorLog = JSON.parse(output[0]) as Record<string, unknown>;
    expect(errorLog).toMatchObject({
      level: 50,
      event: "application_failure",
      route: "/unexpected",
      statusCode: 500,
      requestId,
    });
    expect(output.join("")).not.toContain("application-password-secret");
  });
});

describe("error response envelope schema", () => {
  function runHandler(err: Error): Record<string, unknown> {
    const json = jest.fn();
    const response = {
      status: jest.fn().mockReturnThis(),
      json,
    };
    const request = {
      id: requestId,
      originalUrl: "/validation-failure",
      log: testLogger,
    } as unknown as Request;

    createErrorHandler(testLogger)(
      err,
      request,
      response as unknown as Response,
      jest.fn(),
    );
    return json.mock.calls[0][0] as Record<string, unknown>;
  }

  it("parses a real validation failure response against the schema", () => {
    const schema = z.object({
      name: z.string().min(5),
      address: z.object({ city: z.string().min(2) }),
      tags: z.array(z.string().min(3)),
    });
    const result = schema.safeParse({
      name: "ab",
      address: { city: "x" },
      tags: ["ok", "no"],
    });
    if (result.success) throw new Error("expected validation to fail");

    const payload = runHandler(
      new ValidationError("Validation failed", z.treeifyError(result.error)),
    );
    const parsed = errorResponseSchema.parse(payload);

    expect(parsed.statusCode).toBe(400);
    expect(parsed.details?.properties?.name?.errors).toContain(
      "Too small: expected string to have >=5 characters",
    );
    expect(parsed.details?.properties?.tags?.items?.[1]?.errors).toContain(
      "Too small: expected string to have >=3 characters",
    );
  });

  it("rejects a malformed envelope", () => {
    expect(() =>
      errorResponseSchema.parse({
        success: true,
        status: "error",
        statusCode: 400,
        message: "Validation failed",
      }),
    ).toThrow();
  });
});
