import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

import { jest } from "@jest/globals";

const request = (await import("supertest")).default;
const { createApp } = await import("../../src/app.js");
const { createLogger } = await import("../../src/lib/logger.js");
const { disconnectPrisma } = await import("../../src/lib/prisma.js");

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

type HttpLog = {
  level?: number;
  msg?: string;
  event?: string;
  route?: string;
  statusCode?: number;
  requestId?: string;
  req?: {
    id?: string;
    method?: string;
    url?: string;
    headers?: Record<string, unknown>;
  };
};

afterAll(async () => disconnectPrisma());

function loggedRequests(): HttpLog[] {
  return output.map(line => JSON.parse(line) as HttpLog);
}

describe("automatic HTTP logging", () => {
  beforeEach(() => {
    output.length = 0;
  });

  it("preserves a valid request ID in the response and request log", async () => {
    const response = await request(app)
      .get("/health")
      .set("X-Request-Id", "client-request-123");

    expect(response.headers["x-request-id"]).toBe("client-request-123");

    const requestLog = loggedRequests().find(
      log => log.req?.method === "GET" && log.req.url === "/health",
    );
    expect(requestLog?.req?.id).toBe("client-request-123");
  });

  it("generates a request ID when the client does not provide one", async () => {
    const response = await request(app).get("/health");
    const requestId = response.headers["x-request-id"] as string;

    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    const requestLog = loggedRequests().find(
      log => log.req?.method === "GET" && log.req.url === "/health",
    );
    expect(requestLog?.req?.id).toBe(requestId);
  });

  it("replaces an invalid inbound request ID", async () => {
    const invalidRequestId = "client request id";
    const response = await request(app)
      .get("/health")
      .set("X-Request-Id", invalidRequestId);
    const requestId = response.headers["x-request-id"] as string;

    expect(requestId).not.toBe(invalidRequestId);
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    const requestLog = loggedRequests().find(
      log => log.req?.method === "GET" && log.req.url === "/health",
    );
    expect(requestLog?.req?.id).toBe(requestId);
  });

  it("replaces an oversized inbound request ID", async () => {
    const oversizedRequestId = "a".repeat(129);
    const response = await request(app)
      .get("/health")
      .set("X-Request-Id", oversizedRequestId);
    const requestId = response.headers["x-request-id"] as string;

    expect(requestId).not.toBe(oversizedRequestId);
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    const requestLog = loggedRequests().find(
      log => log.req?.method === "GET" && log.req.url === "/health",
    );
    expect(requestLog?.req?.id).toBe(requestId);
  });

  it("logs safe request metadata without bodies, queries, or credentials", async () => {
    await request(app)
      .post("/")
      .query({ "raw-query": "query-secret" })
      .set("Authorization", "Bearer header-secret")
      .set("Cookie", "session=cookie-secret")
      .send({
        email: "safe@example.com",
        password: "body-password-secret",
        token: "body-token-secret",
      });

    const requestLog = loggedRequests().find(log => log.req?.method === "POST");
    expect(requestLog).toMatchObject({
      req: {
        method: "POST",
        url: "/",
      },
    });
    expect(requestLog?.req?.headers?.host).toBeDefined();
    expect(output.join("")).not.toContain("query-secret");
    expect(output.join("")).not.toContain("header-secret");
    expect(output.join("")).not.toContain("cookie-secret");
    expect(output.join("")).not.toContain("body-password-secret");
    expect(output.join("")).not.toContain("body-token-secret");
    expect(output.join("")).not.toContain("safe@example.com");
  });

  it("includes authentication requests in the protected request log stream", async () => {
    await request(app)
      .get("/api/auth/not-a-real-route")
      .query({ "auth-query": "auth-query-secret" })
      .set("Authorization", "Bearer auth-header-secret")
      .set("Cookie", "session=auth-cookie-secret");

    const requestLog = loggedRequests().find(
      log => log.req?.url === "/api/auth/not-a-real-route",
    );
    expect(requestLog).toMatchObject({
      req: {
        method: "GET",
        url: "/api/auth/not-a-real-route",
      },
    });
    expect(output.join("")).not.toContain("auth-query-secret");
    expect(output.join("")).not.toContain("auth-header-secret");
    expect(output.join("")).not.toContain("auth-cookie-secret");
  });

  it("does not send authentication failures through console logging", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const consoleWarn = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    try {
      const requestId = "auth-failure-request-123";
      const response = await request(app)
        .post("/api/auth/sign-in/email")
        .set("X-Request-Id", requestId)
        .send({
          email: "missing@example.com",
          password: "auth-password-secret",
        });

      expect(response.status).toBe(401);
      expect(consoleError).not.toHaveBeenCalled();
      expect(consoleWarn).not.toHaveBeenCalled();
      expect(output.join("")).not.toContain("auth-password-secret");

      expect(loggedRequests()).toContainEqual(
        expect.objectContaining({
          level: 40,
          event: "authentication_failure",
          route: "/api/auth/sign-in/email",
          statusCode: response.status,
          requestId,
          req: expect.objectContaining({ id: requestId }),
        }),
      );
    } finally {
      consoleError.mockRestore();
      consoleWarn.mockRestore();
    }
  });

  it("uses the protected logger for request errors", async () => {
    const requestId = "error-request-123";
    await request(app)
      .get("/deck")
      .set("X-Request-Id", requestId)
      .set("Authorization", "Bearer error-header-secret");

    expect(output.join("")).toContain("Not authenticated");
    expect(output.join("")).not.toContain("error-header-secret");

    const errorLog = loggedRequests().find(
      log => log.msg === "Not authenticated",
    );
    expect(errorLog?.req?.id).toBe(requestId);
  });

  it("assigns appropriate log level to automatic HTTP request logs based on status code", async () => {
    await request(app).get("/health");
    const healthLog = loggedRequests().find(
      log => log.req?.url === "/health" && log.msg === "request completed",
    );
    expect(healthLog?.level).toBe(30);

    await request(app).get("/non-existent-route-for-status-check");
    const notFoundLog = loggedRequests().find(
      log =>
        log.req?.url === "/non-existent-route-for-status-check" &&
        log.msg === "request completed",
    );
    expect(notFoundLog?.level).toBe(40);
  });
});
