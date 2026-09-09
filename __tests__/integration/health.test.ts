import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

const request = (await import("supertest")).default;
const { app } = await import("../setup/testApp.ts");
const { disconnectDb } = await import("../setup/testDb.ts");

afterAll(async () => disconnectDb());

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("returns uptime as a number", async () => {
    const res = await request(app).get("/health");
    expect(typeof res.body.uptime).toBe("number");
  });

  it("returns timestamp as an ISO string", async () => {
    const res = await request(app).get("/health");
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });
});

describe("GET /ready", () => {
  it("returns 200 with status ready when DB is reachable", async () => {
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ready");
  });
});
