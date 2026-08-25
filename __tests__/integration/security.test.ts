import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

const request = (await import("supertest")).default;
const { app } = await import("../setup/testApp.js");

describe("Security middleware headers", () => {
  it("GET / returns x-frame-options header", async () => {
    const res = await request(app).get("/");

    expect(res.status).toBe(200);
    expect(res.headers["x-frame-options"]).toBeDefined();
  });

  it("GET / returns x-content-type-options as nosniff", async () => {
    const res = await request(app).get("/");

    expect(res.status).toBe(200);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("GET / returns ratelimit-limit header", async () => {
    const res = await request(app).get("/");

    expect(res.status).toBe(200);
    expect(res.headers["ratelimit-limit"]).toBeDefined();
  });

  it("GET / does not include x-powered-by header", async () => {
    const res = await request(app).get("/");

    expect(res.status).toBe(200);
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
