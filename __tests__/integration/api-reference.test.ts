import request from "supertest";

import { createApp } from "../../src/app.js";

const originalNodeEnv = process.env.NODE_ENV;

type ScalarSource = {
  title?: string;
  slug?: string;
  url?: string;
  default?: boolean;
};

// The whole Scalar configuration cannot be parsed as JSON because Scalar
// serializes function values (like customFetch) as raw JavaScript source.
// The sources array is plain JSON, so extract and parse just that array.
function extractScalarSources(html: string): ScalarSource[] {
  const match = html.match(/"sources":\s*(\[[\s\S]*?\])/);

  if (!match) {
    throw new Error("Scalar sources configuration not found in /docs HTML");
  }

  return JSON.parse(match[1]) as ScalarSource[];
}

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
  });

  it("offers Top Vino and Authentication sources in development", async () => {
    process.env.NODE_ENV = "development";

    const response = await request(createApp()).get("/docs");
    const sources = extractScalarSources(response.text);

    expect(sources).toContainEqual({
      title: "Top Vino API",
      slug: "top-vino",
      url: "/openapi.json",
      default: true,
    });
    expect(sources).toContainEqual({
      title: "Authentication",
      slug: "authentication",
      url: "/api/auth/open-api/generate-schema",
    });
  });

  it("selects the Top Vino source by default", async () => {
    process.env.NODE_ENV = "development";

    const response = await request(createApp()).get("/docs");
    const sources = extractScalarSources(response.text);

    expect(sources.find(source => source.slug === "top-vino")?.default).toBe(
      true,
    );
    expect(sources.filter(source => source.default === true)).toHaveLength(1);
  });

  it("includes cookies in requests made by the try-it console", async () => {
    process.env.NODE_ENV = "development";

    const response = await request(createApp()).get("/docs");

    expect(response.text).toContain('credentials: "include"');
  });

  it("does not persist credentials typed into the reference", async () => {
    process.env.NODE_ENV = "development";

    const response = await request(createApp()).get("/docs");

    expect(response.text).toContain('"persistAuth": false');
  });

  it("is not mounted in production", async () => {
    process.env.NODE_ENV = "production";

    const response = await request(createApp()).get("/docs");

    expect(response.status).toBe(404);
  });
});
