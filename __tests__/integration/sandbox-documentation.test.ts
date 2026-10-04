import request from "supertest";
import { jest } from "@jest/globals";

const originalNodeEnv = process.env.NODE_ENV;
const originalAuthUrl = process.env.BETTER_AUTH_URL;
const originalLogLevel = process.env.LOG_LEVEL;

// Configure production HTTPS before authentication and schemas initialize.
process.env.NODE_ENV = "production";
process.env.BETTER_AUTH_URL = "https://api.example.test";
process.env.LOG_LEVEL = "silent";

const { createApp } = await import("../../src/app.ts");
const { createLogger } = await import("../../src/lib/logger.ts");
const { default: prisma, disconnectPrisma } = await import(
  "../../src/lib/prisma.ts"
);

beforeEach(() => {
  process.env.NODE_ENV = "production";
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

afterAll(async () => {
  process.env.BETTER_AUTH_URL = originalAuthUrl;
  if (originalLogLevel === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = originalLogLevel;
  await disconnectPrisma();
});

describe("production sandbox documentation", () => {
  it("documents the HTTPS session cookie used by production product routes", async () => {
    const response = await request(createApp()).get("/openapi.json");

    expect(response.status).toBe(200);
    expect(
      response.body.components.securitySchemes.sessionCookie,
    ).toMatchObject({
      type: "apiKey",
      in: "cookie",
      name: "__Secure-better-auth.session_token",
    });
  });

  it("retains correlated auth failure events for a rate-limited generated schema", async () => {
    const output: string[] = [];
    const app = createApp(
      createLogger({
        environment: "production",
        logLevel: "info",
        destination: {
          write: (message: string) => {
            output.push(message);
          },
        },
      }),
    );
    for (let index = 0; index < 60; index++)
      await request(app).get("/robots.txt");

    const response = await request(app)
      .get("/api/auth/open-api/generate-schema")
      .set("X-Request-Id", "schema-quota-failure");

    expect(response.status).toBe(429);
    expect(output.map(line => JSON.parse(line))).toContainEqual(
      expect.objectContaining({
        level: 40,
        event: "authentication_failure",
        route: "/api/auth/open-api/generate-schema",
        statusCode: 429,
        requestId: "schema-quota-failure",
      }),
    );
  });

  it("allows the browser reference to run under a per-response script nonce while retaining security headers", async () => {
    const app = createApp();
    const first = await request(app).get("/docs");
    const second = await request(app).get("/docs");
    const nonce = first.text.match(/<script[^>]*nonce="([^"]+)"/)?.[1];

    expect(nonce).toBeDefined();
    expect(second.text).not.toContain(`nonce="${nonce}"`);
    const policy = first.headers["content-security-policy"] as string;
    expect(policy).toContain(`'nonce-${nonce}'`);
    expect(policy).toContain("https://cdn.jsdelivr.net");
    expect(policy).toContain("connect-src 'self'");
    const scriptPolicy = policy
      .split(";")
      .find(directive => directive.startsWith("script-src "));
    expect(scriptPolicy).not.toContain("'unsafe-inline'");
    expect(scriptPolicy).not.toContain("'unsafe-eval'");
    expect(first.headers["x-content-type-options"]).toBe("nosniff");
    expect(first.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(first.headers["x-powered-by"]).toBeUndefined();
  });

  it("shares a separate 60-per-minute documentation quota and keeps probes available after all quotas are exhausted", async () => {
    const app = createApp();

    for (let index = 0; index < 60; index++) {
      const path =
        index < 21
          ? "/api/auth/open-api/generate-schema"
          : index % 2 === 0
            ? "/docs"
            : "/openapi.json";
      const response = await request(app).get(path);
      expect(response.status).toBe(200);
      expect(response.headers["ratelimit-limit"]).toBe("60");
      expect(response.headers["ratelimit-policy"]).toBe("60;w=60");
    }
    for (const path of [
      "/docs",
      "/openapi.json",
      "/api/auth/open-api/generate-schema",
    ]) {
      const response = await request(app).get(path);
      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        success: false,
        status: "error",
        statusCode: 429,
        message: "Too many documentation requests, please try again later",
      });
      expect(response.headers["x-robots-tag"]).toBe("noindex, nofollow");
      expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
      expect(Number(response.headers["retry-after"])).toBeLessThanOrEqual(60);
    }
    for (let index = 0; index < 20; index++) {
      const response = await request(app).get("/api/auth/unknown-capability");
      expect(response.status).toBe(404);
      expect(response.headers["ratelimit-limit"]).toBe("20");
    }
    expect(
      (await request(app).get("/api/auth/unknown-capability")).status,
    ).toBe(429);

    for (let index = 0; index < 100; index++) {
      const response = await request(app).get("/user/me");
      expect(response.status).toBe(401);
      expect(response.headers["ratelimit-limit"]).toBe("100");
    }
    expect((await request(app).get("/user/me")).status).toBe(429);

    for (const [path, body] of [
      ["/health", { status: "ok" }],
      ["/ready", { status: "ready" }],
    ] as const) {
      const response = await request(app).get(path);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject(body);
      expect(response.headers["ratelimit-limit"]).toBeUndefined();
    }

    const databaseFailure = jest
      .spyOn(prisma, "$queryRaw")
      .mockRejectedValue(new Error("private-database-connection-details"));
    try {
      const readiness = await request(app).get("/ready");
      expect(readiness.status).toBe(503);
      expect(readiness.body).toEqual({ status: "unavailable" });
      expect(readiness.headers["ratelimit-limit"]).toBeUndefined();
      const liveness = await request(app).get("/health");
      expect(liveness.status).toBe(200);
      expect(liveness.body).toEqual({
        status: "ok",
        uptime: expect.any(Number),
        timestamp: expect.any(String),
      });
      expect(liveness.headers["ratelimit-limit"]).toBeUndefined();
    } finally {
      databaseFailure.mockRestore();
    }
  });

  it("discourages indexing of public documentation and schemas", async () => {
    const app = createApp();

    for (const path of [
      "/",
      "/docs",
      "/openapi.json",
      "/api/auth/open-api/generate-schema",
    ]) {
      const response = await request(app).get(path);

      expect(response.status).toBe(200);
      expect(response.headers["x-robots-tag"]).toBe("noindex, nofollow");
    }
    const robots = await request(app).get("/robots.txt");
    expect(robots.status).toBe(200);
    expect(robots.type).toBe("text/plain");
    expect(robots.text).toBe("User-agent: *\nDisallow: /\n");
  });

  it("separates live product routes from the generated authentication capability reference", async () => {
    const app = createApp();
    const product = await request(app).get("/openapi.json");
    const authentication = await request(app).get(
      "/api/auth/open-api/generate-schema",
    );
    const reference = await request(app).get("/docs");

    for (const response of [product, authentication]) {
      expect(response.status).toBe(200);
      expect(response.type).toBe("application/json");
      expect(response.body.info.description).toContain(
        "synthetic disposable data",
      );
      expect(response.body.info.description).toContain("may sleep or reset");
      expect(response.body.info.description).toContain(
        "no uptime or recovery promise",
      );
      expect(response.text).not.toContain(process.env.DATABASE_URL);
      expect(response.text).not.toContain(process.env.BETTER_AUTH_SECRET);
    }
    expect(product.body.paths["/deck"].get).toBeDefined();
    expect(product.body.paths["/user/me"].get).toBeDefined();
    expect(product.body.paths).not.toHaveProperty("/api/auth/sign-up/email");
    expect(authentication.body.paths["/sign-in/email"].post).toBeDefined();
    expect(authentication.body.paths["/sign-up/email"].post).toBeDefined();
    expect(authentication.body.info.description).toContain(
      "advertised routes may be disabled",
    );
    expect(reference.text).toContain('"title": "Authentication capabilities"');
    expect(reference.text).toContain("advertised routes may be disabled");
  });

  it("identifies the API and warns visitors about disposable data on the root and reference", async () => {
    const app = createApp();

    for (const path of ["/", "/docs"]) {
      const response = await request(app).get(path);

      expect(response.status).toBe(200);
      expect(response.type).toBe("text/html");
      expect(response.text).toContain("Top Vino API");
      expect(response.text).toContain("synthetic disposable data");
      expect(response.text).toContain("may sleep or reset");
      expect(response.text).toContain("no uptime or recovery promise");
      expect(response.text).not.toContain(process.env.DATABASE_URL);
      expect(response.text).not.toContain(process.env.BETTER_AUTH_SECRET);
    }
  });
});
