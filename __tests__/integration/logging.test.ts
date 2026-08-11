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
  req?: {
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

    try {
      const response = await request(app).post("/api/auth/sign-in/email").send({
        email: "missing@example.com",
        password: "auth-password-secret",
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(consoleError).not.toHaveBeenCalled();
      expect(output.join("")).not.toContain("auth-password-secret");
    } finally {
      consoleError.mockRestore();
    }
  });

  it("uses the protected logger for request errors", async () => {
    await request(app)
      .get("/deck")
      .set("Authorization", "Bearer error-header-secret");

    expect(output.join("")).toContain("Not authenticated");
    expect(output.join("")).not.toContain("error-header-secret");
  });
});
