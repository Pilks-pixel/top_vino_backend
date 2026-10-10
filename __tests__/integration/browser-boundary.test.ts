import request from "supertest";
import { jest } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";

const originalEnv = { ...process.env };
process.env.NODE_ENV = "production";
process.env.BETTER_AUTH_URL = "https://api.example.test";
process.env.FRONTEND_URL = "https://frontend.example.test";
process.env.BETTER_AUTH_SECRETS =
  "1:synthetic-browser-signing-secret-at-least-32-characters";
process.env.BETTER_AUTH_SECRET = "";
process.env.LOG_LEVEL = "silent";
delete process.env.TRUST_PROXY;

const { createApp } = await import("../../src/app.ts");
const { default: prisma, disconnectPrisma } = await import(
  "../../src/lib/prisma.ts"
);
const { cleanDb, disconnectDb, testPrisma } = await import(
  "../setup/testDb.ts"
);
const { createTestUser } = await import("../setup/factories.ts");
const { createLogger } = await import("../../src/lib/logger.ts");
let clock = Date.now();

beforeEach(async () => {
  clock += 15_000;
  jest.spyOn(Date, "now").mockReturnValue(clock);
  delete process.env.TRUST_PROXY;
  await cleanDb();
});
afterEach(() => jest.restoreAllMocks());

async function tester() {
  const credentials = {
    email: "tester-browser@example.test",
    password: "synthetic-browser-password",
  };
  const user = await createTestUser({ email: credentials.email });
  await testPrisma.account.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: await hashPassword(credentials.password),
    },
  });
  return credentials;
}

afterAll(async () => {
  await cleanDb();
  await disconnectDb();
  await disconnectPrisma();
  process.env = originalEnv;
});

describe("reviewed browser boundary", () => {
  it("keeps sensitive-route burst allowances separate for real clients behind the reviewed proxy", async () => {
    process.env.TRUST_PROXY = "render-1";
    const app = createApp();
    const login = (forwarded: string) =>
      request(app)
        .post("/api/auth/sign-in/email")
        .set("Origin", "https://frontend.example.test")
        .set("X-Forwarded-For", forwarded)
        .set("X-Real-IP", "203.0.113.99")
        .set("X-Top-Vino-Client-IP", "203.0.113.99")
        .send({
          email: "missing@example.test",
          password: "synthetic-password",
        });
    for (let attempt = 0; attempt < 3; attempt++) {
      expect(
        (await login(`192.0.2.${attempt + 1}, 198.51.100.10`)).status,
      ).toBe(401);
    }
    expect((await login("192.0.2.99, 198.51.100.10")).status).toBe(429);
    expect((await login("192.0.2.99, 198.51.100.11")).status).toBe(401);
  });
  it("sanitizes authentication database failures and unknown-route responses", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const consoleWarn = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const output: string[] = [];
    const app = createApp(
      createLogger({
        environment: "production",
        logLevel: "info",
        destination: {
          write: line => {
            output.push(line);
          },
        },
      }),
    );
    jest
      .spyOn(prisma.user, "findFirst")
      .mockRejectedValueOnce(
        new Error(
          "private-password https://user:private-secret@example.test/db",
        ),
      );
    const failure = await request(app)
      .post("/api/auth/sign-in/email")
      .set("Origin", "https://frontend.example.test")
      .set("X-Request-Id", "auth-database-failure-45")
      .send({ email: "missing@example.test", password: "private-password" });
    expect(failure.status).toBe(500);
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(failure.text + output.join("")).not.toContain("private-");
    expect(output.map(line => JSON.parse(line))).toContainEqual(
      expect.objectContaining({
        event: "authentication_failure",
        statusCode: 500,
        requestId: "auth-database-failure-45",
      }),
    );
    const missing = await request(app).get("/unknown/private-path-token");
    expect(missing.status).toBe(404);
    expect(missing.text + output.join("")).not.toContain("private-");
  });
  it("sanitizes application failure responses and multiline error stacks", async () => {
    const output: string[] = [];
    const app = createApp(
      createLogger({
        environment: "production",
        logLevel: "info",
        destination: {
          write: line => {
            output.push(line);
          },
        },
      }),
    );
    const login = await request(app)
      .post("/api/auth/sign-in/email")
      .set("Origin", "https://frontend.example.test")
      .send(await tester());
    expect(login.status).toBe(200);
    const cookie = (login.headers["set-cookie"] as unknown as string[])
      .map(value => value.split(";", 1)[0])
      .join("; ");
    const failure = new Error(
      "private-database-password https://user:private-password@example.test/db",
    );
    failure.stack =
      "Error: private-message\nprivate-body-and-token\n    at private-secret-location";
    jest.spyOn(prisma.deck, "findMany").mockRejectedValueOnce(failure);
    const response = await request(app)
      .get("/deck")
      .set("Cookie", cookie)
      .set("X-Request-Id", "application-privacy-45");
    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Internal server error");
    expect(response.body.stack).toBeUndefined();
    expect(response.text + output.join("")).not.toContain("private-");
    expect(output.map(line => JSON.parse(line))).toContainEqual(
      expect.objectContaining({
        event: "application_failure",
        requestId: "application-privacy-45",
        statusCode: 500,
      }),
    );
  });

  it.each([
    ["TRUST_PROXY", "true"],
    ["TRUST_PROXY", "2"],
    ["TRUST_PROXY", "loopback"],
    ["TRUST_PROXY", "https://user:private-secret@example.test"],
    ["BETTER_AUTH_TRUSTED_ORIGINS", "https://private-unreviewed.example.test"],
  ])(
    "rejects unreviewed %s at startup without exposing its value (%#)",
    async (name, value) => {
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const run = promisify(execFile);
      const failure = await run(
        process.execPath,
        ["--experimental-strip-types", "src/server.ts"],
        {
          env: { ...process.env, [name]: value },
          timeout: 5000,
        },
      ).then(
        () => {
          throw new Error("Unreviewed configuration started the API");
        },
        error => error as { code: number; stdout: string; stderr: string },
      );
      expect(failure.code).toBe(1);
      expect(failure.stdout + failure.stderr).not.toContain("private-");
      expect(JSON.parse(failure.stdout)).toMatchObject({
        event: "startup_failure",
        reason: "environment_validation",
        message: `Invalid environment variable: ${name}`,
      });
    },
  );
  it("keeps credential-bearing paths, headers, URLs and bodies out of auth failure logs while retaining correlation", async () => {
    const output: string[] = [];
    const app = createApp(
      createLogger({
        environment: "production",
        logLevel: "info",
        destination: {
          write: line => {
            output.push(line);
          },
        },
      }),
    );
    const response = await request(app)
      .post("/api/auth/reset-password/private-path-token")
      .query({ token: "private-query-token" })
      .set("X-Request-Id", "privacy-request-45")
      .set("Origin", "https://private-origin.example.test")
      .set("Referer", "https://example.test/private-referrer-url")
      .set("X-New-Credential", "private-new-header")
      .set("Cookie", "session=private-cookie")
      .set("Authorization", "Bearer private-token")
      .send({
        password: "private-password",
        callbackURL: "https://example.test/private-callback-url",
      });
    expect(response.status).toBe(404);
    expect(response.headers["x-request-id"]).toBe("privacy-request-45");
    expect(output.join("")).not.toContain("private-");
    expect(response.text).not.toContain("private-");
    expect(output.map(line => JSON.parse(line))).toContainEqual(
      expect.objectContaining({
        event: "authentication_failure",
        statusCode: 404,
        requestId: "privacy-request-45",
      }),
    );
  });
  it("enforces 10 KB on auth and product bodies, including chunked and compressed requests", async () => {
    const app = createApp();
    const { gzipSync } = await import("node:zlib");
    for (const path of ["/api/auth/sign-in/email", "/deck"]) {
      // An exact 10240-byte JSON body reaches normal validation/authentication.
      const exact = JSON.stringify({ padding: "x".repeat(10226) });
      expect(Buffer.byteLength(exact)).toBe(10240);
      expect(
        (await request(app).post(path).type("json").send(exact)).status,
      ).not.toBe(413);
      for (const encoding of ["plain", "chunked", "gzip"] as const) {
        const oversized = JSON.stringify({
          password: "private-body",
          padding: "x".repeat(10240),
        });
        const pending = request(app).post(path).type("json");
        if (encoding === "chunked") {
          pending.write(oversized);
        } else if (encoding === "gzip") {
          pending.set("Content-Encoding", "gzip").write(gzipSync(oversized));
        } else pending.send(oversized);
        const denied = await pending;
        expect({ path, encoding, status: denied.status }).toEqual({
          path,
          encoding,
          status: 413,
        });
        expect(denied.body.message).toBe("Request body too large");
        expect(JSON.stringify(denied.body)).not.toContain("private-body");
        expect(denied.headers["set-cookie"]).toBeUndefined();
      }
    }
    for (const path of ["/api/auth/sign-in/email", "/deck"]) {
      const form = await request(app)
        .post(path)
        .type("form")
        .send({ password: "x".repeat(10240) });
      expect(form.status).toBe(413);
    }
    expect((await request(app).get("/health")).status).toBe(200);
    expect((await request(app).get("/ready")).status).toBe(200);
  });
  it("retains sensitive-route burst protection using the same unspoofable client IP and standard Retry-After", async () => {
    const app = createApp();
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await request(app)
        .post("/api/auth/sign-in/email")
        .set("Origin", "https://frontend.example.test")
        .set("X-Forwarded-For", `198.51.100.${attempt + 1}`)
        .set("X-Top-Vino-Client-IP", `203.0.113.${attempt + 1}`)
        .send({ email: "missing@example.test", password: "private-password" });
      expect(response.status).toBe(401);
    }
    const blocked = await request(app)
      .post("/api/auth/sign-in/email")
      .set("Origin", "https://frontend.example.test")
      .set("X-Forwarded-For", "198.51.100.99")
      .set("X-Top-Vino-Client-IP", "203.0.113.99")
      .send({ email: "missing@example.test", password: "private-password" });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    expect(Number(blocked.headers["retry-after"])).toBeLessThanOrEqual(10);
  });

  it("limits product traffic to 100 per 15 minutes without consuming auth, documentation or health allowances", async () => {
    const app = createApp();
    for (let attempt = 0; attempt < 100; attempt++) {
      expect((await request(app).get("/user/me")).status).toBe(401);
    }
    const blocked = await request(app).get("/user/me");
    expect(blocked.status).toBe(429);
    expect(blocked.headers["ratelimit-limit"]).toBe("100");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    expect(Number(blocked.headers["retry-after"])).toBeLessThanOrEqual(900);
    expect((await request(app).get("/api/auth/get-session")).status).toBe(200);
    expect((await request(app).get("/openapi.json")).status).toBe(200);
    expect((await request(app).get("/health")).status).toBe(200);
    expect((await request(app).get("/ready")).status).toBe(200);
  });
  it("keeps origin, callback and Fetch Metadata protections enabled", async () => {
    const credentials = await tester();
    const app = createApp();
    for (const headers of [
      { Origin: "https://unrelated.example.test" },
      { Origin: "null" },
      { "Sec-Fetch-Site": "cross-site", "Sec-Fetch-Mode": "navigate" },
    ]) {
      const denied = await request(app)
        .post("/api/auth/sign-in/email")
        .set(headers)
        .send(credentials);
      expect(denied.status).toBe(403);
      expect(denied.headers["set-cookie"]).toBeUndefined();
    }
    clock += 15_000;
    jest.spyOn(Date, "now").mockReturnValue(clock);
    const callback = await request(app)
      .post("/api/auth/sign-in/email")
      .set("Origin", "https://frontend.example.test")
      .send({
        ...credentials,
        callbackURL: "https://unrelated.example.test/private-url",
      });
    expect(callback.status).toBe(403);
    expect(JSON.stringify(callback.body)).not.toContain("private-url");
    expect(callback.headers["set-cookie"]).toBeUndefined();
    const login = await request(app)
      .post("/api/auth/sign-in/email")
      .set("Origin", "https://frontend.example.test")
      .send(credentials);
    expect(login.status).toBe(200);
    const cookie = (login.headers["set-cookie"] as unknown as string[])
      .map(value => value.split(";", 1)[0])
      .join("; ");
    for (const origin of [undefined, "https://unrelated.example.test"]) {
      const logout = request(app)
        .post("/api/auth/sign-out")
        .set("Cookie", cookie);
      if (origin) logout.set("Origin", origin);
      expect((await logout.send({})).status).toBe(403);
    }
    expect(
      (await request(app).get("/user/me").set("Cookie", cookie)).status,
    ).toBe(200);
  });

  it("defaults to socket identity so spoofed forwarding headers cannot renew an auth allowance", async () => {
    const app = createApp();
    for (let attempt = 0; attempt < 20; attempt++) {
      const response = await request(app)
        .get("/api/auth/get-session")
        .set("X-Forwarded-For", `198.51.100.${attempt + 1}`)
        .set("X-Real-IP", `192.0.2.${attempt + 1}`)
        .set("X-Top-Vino-Client-IP", `203.0.113.${attempt + 1}`);
      expect(response.status).toBe(200);
    }
    const blocked = await request(app)
      .get("/api/auth/get-session")
      .set("X-Forwarded-For", "198.51.100.99");
    expect(blocked.status).toBe(429);
    expect(blocked.headers["ratelimit-limit"]).toBe("20");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    expect(Number(blocked.headers["retry-after"])).toBeLessThanOrEqual(900);
  });

  it("uses only the nearest forwarded address for the reviewed Render one-hop rule", async () => {
    process.env.TRUST_PROXY = "render-1";
    const app = createApp();
    for (let attempt = 0; attempt < 20; attempt++) {
      const response = await request(app)
        .get("/api/auth/get-session")
        .set("X-Forwarded-For", `192.0.2.${attempt + 1}, 198.51.100.10`);
      expect(response.status).toBe(200);
    }
    const blocked = await request(app)
      .get("/api/auth/get-session")
      .set("X-Forwarded-For", "192.0.2.99, 198.51.100.10");
    expect(blocked.status).toBe(429);
    const other = await request(app)
      .get("/api/auth/get-session")
      .set("X-Forwarded-For", "192.0.2.99, 198.51.100.11");
    expect(other.status).toBe(200);
  });
  it("lets a reviewed frontend sign in with Secure, HttpOnly, host-only, SameSite=Lax cookies", async () => {
    const response = await request(createApp())
      .post("/api/auth/sign-in/email")
      .set("Origin", "https://frontend.example.test")
      .send(await tester());
    expect(response.status).toBe(200);
    const cookies = response.headers["set-cookie"] as unknown as string[];
    expect(cookies.length).toBeGreaterThan(0);
    for (const cookie of cookies) {
      expect(cookie).toMatch(/; Secure/i);
      expect(cookie).toMatch(/; HttpOnly/i);
      expect(cookie).toMatch(/; SameSite=Lax/i);
      expect(cookie).not.toMatch(/; Domain=/i);
    }
    const profile = await request(createApp())
      .get("/user/me")
      .set("Cookie", cookies.map(cookie => cookie.split(";", 1)[0]).join("; "));
    expect(profile.status).toBe(200);
    expect(profile.body.data.email).toBe("tester-browser@example.test");
  });
  it("grants credentialed CORS only to exact reviewed origins and varies every response by Origin", async () => {
    const app = createApp();
    for (const origin of [
      "https://frontend.example.test",
      "https://api.example.test",
      "https://frontend.example.test.evil.test",
      "https://frontend.example.test:444",
      "http://frontend.example.test",
      "null",
    ]) {
      const response = await request(app)
        .options("/api/auth/sign-in/email")
        .set("Origin", origin)
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "content-type");
      expect(response.headers.vary).toMatch(/\bOrigin\b/i);
      if (
        [process.env.FRONTEND_URL, process.env.BETTER_AUTH_URL].includes(origin)
      ) {
        expect(response.status).toBe(204);
        expect(response.headers["access-control-allow-origin"]).toBe(origin);
        expect(response.headers["access-control-allow-credentials"]).toBe(
          "true",
        );
      } else {
        expect(response.headers["access-control-allow-origin"]).toBeUndefined();
        expect(
          response.headers["access-control-allow-credentials"],
        ).toBeUndefined();
      }
    }
    const response = await request(app).get("/health");
    expect(response.headers.vary).toMatch(/\bOrigin\b/i);
    expect(
      response.headers["access-control-allow-credentials"],
    ).toBeUndefined();
  });
});
