import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

import { jest } from "@jest/globals";

jest.unstable_mockModule("../../src/lib/auth.ts", () => ({
  auth: {
    api: {
      getSession: jest.fn(() =>
        Promise.resolve({
          user: {
            id: "user-123",
            email: "requestor@example.com",
            subscriptionType: "FREE",
          },
          session: {},
        }),
      ),
    },
    handler: jest.fn(),
  },
}));

const request = (await import("supertest")).default;
const { createApp } = await import("../../src/app.ts");
const { createLogger } = await import("../../src/lib/logger.ts");
const { default: prisma, disconnectPrisma } = await import(
  "../../src/lib/prisma.ts"
);

const output: string[] = [];
const app = createApp(
  createLogger({
    environment: "production",
    logLevel: "info",
    destination: {
      write(message: string): void {
        output.push(message);
      },
    },
  }),
);

type LogRecord = {
  level?: number;
  event?: string;
  route?: string;
  statusCode?: number;
  requestId?: string;
  errorCode?: string;
  req?: { id?: string };
};

afterAll(async () => disconnectPrisma());

function loggedRecords(): LogRecord[] {
  return output.map(line => JSON.parse(line) as LogRecord);
}

describe("operational failure logging", () => {
  beforeEach(() => {
    output.length = 0;
  });

  it("logs validation failures with safe request metadata", async () => {
    const requestId = "validation-failure-request-123";

    const response = await request(app)
      .put("/user/user-123")
      .set("X-Request-Id", requestId)
      .send({
        email: "validation-email-secret",
        password: "validation-password-secret",
        subscriptionType: "INVALID",
      });

    expect(response.status).toBe(400);

    expect(loggedRecords()).toContainEqual(
      expect.objectContaining({
        event: "validation_failure",
        route: "/user/user-123",
        statusCode: 400,
        requestId,
        req: expect.objectContaining({ id: requestId }),
      }),
    );
    expect(output.join("")).not.toContain("validation-email-secret");
    expect(output.join("")).not.toContain("validation-password-secret");
  });

  it("logs expected persistence failures as safe warnings", async () => {
    const requestId = "persistence-failure-request-123";

    const response = await request(app)
      .post("/deck")
      .set("X-Request-Id", requestId)
      .send({
        name: "database-deck-secret",
        topic: "database-topic-secret",
      });

    expect(response.status).toBe(400);

    expect(loggedRecords()).toContainEqual(
      expect.objectContaining({
        level: 40,
        event: "persistence_failure",
        route: "/deck",
        statusCode: 400,
        requestId,
        errorCode: "P2003",
        req: expect.objectContaining({ id: requestId }),
      }),
    );
    expect(output.join("")).not.toContain("database-deck-secret");
    expect(output.join("")).not.toContain("database-topic-secret");
  });

  it("logs readiness dependency failures as warnings", async () => {
    const requestId = "readiness-failure-request-123";
    const queryRaw = jest
      .spyOn(prisma, "$queryRaw")
      .mockRejectedValueOnce(new Error("database-password-secret"));

    try {
      const response = await request(app)
        .get("/ready")
        .set("X-Request-Id", requestId);

      expect(response.status).toBe(503);
      expect(loggedRecords()).toContainEqual(
        expect.objectContaining({
          level: 40,
          event: "readiness_check_failure",
          route: "/ready",
          statusCode: 503,
          requestId,
          req: expect.objectContaining({ id: requestId }),
        }),
      );
      expect(output.join("")).not.toContain("database-password-secret");
    } finally {
      queryRaw.mockRestore();
    }
  });
});
