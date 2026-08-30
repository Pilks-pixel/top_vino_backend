import request from "supertest";

import { createApp } from "../../src/app.js";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe("Scalar API reference", () => {
  it("is browsable at /docs in development", async () => {
    process.env.NODE_ENV = "development";

    const response = await request(createApp()).get("/docs");

    expect(response.status).toBe(200);
    expect(response.type).toBe("text/html");
    expect(response.text).toContain("Scalar");
    expect(response.text).toContain("/openapi.json");
  });

  it("includes cookies in requests made by the try-it console", async () => {
    process.env.NODE_ENV = "development";

    const response = await request(createApp()).get("/docs");

    expect(response.text).toContain('credentials: "include"');
  });

  it("is not mounted in production", async () => {
    process.env.NODE_ENV = "production";

    const response = await request(createApp()).get("/docs");

    expect(response.status).toBe(404);
  });
});
