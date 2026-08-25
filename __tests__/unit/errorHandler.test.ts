import type { Request, Response } from "express";
import { jest } from "@jest/globals";
import { createLogger } from "../../src/lib/logger.ts";
import { createErrorHandler } from "../../src/middlewares/errorHandler.ts";

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
