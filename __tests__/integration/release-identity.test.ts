import request from "supertest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createApp } from "../../src/app.ts";

const execute = promisify(execFile);
const original = { ...process.env };
const commit = "a".repeat(40);

afterEach(() => {
  process.env = { ...original };
});

it("exposes the full accepted commit on root and liveness without changing their bodies", async () => {
  process.env.RENDER_GIT_COMMIT = commit;
  delete process.env.RELEASE_COMMIT;
  const app = createApp();
  const root = await request(app).get("/");
  const health = await request(app).get("/health");
  expect(root.status).toBe(200);
  expect(root.headers["x-release-commit"]).toBe(commit);
  expect(root.text).toContain("Top Vino API sandbox");
  expect(health.headers["x-release-commit"]).toBe(commit);
  expect(health.body.status).toBe("ok");
});

it.each([
  { RELEASE_COMMIT: "private-invalid-commit", RENDER_GIT_COMMIT: "" },
  { RELEASE_COMMIT: commit, RENDER_GIT_COMMIT: "b".repeat(40) },
])(
  "rejects malformed or conflicting release identity before startup without printing values (%#)",
  async identity => {
    const result = await execute(
      process.execPath,
      ["--experimental-strip-types", "src/server.ts"],
      {
        env: {
          ...process.env,
          NODE_ENV: "production",
          DATABASE_URL: "postgresql://localhost:9/synthetic",
          BETTER_AUTH_URL: "https://api.example.test",
          FRONTEND_URL: "https://api.example.test",
          BETTER_AUTH_SECRETS: "1:synthetic-signing-key-at-least-32-characters",
          BETTER_AUTH_SECRET: "",
          AUTH_SECRET: "",
          LOG_LEVEL: "silent",
          PORT: "49167",
          ...identity,
        },
        timeout: 2000,
      },
    ).then(
      () => {
        throw new Error("Invalid identity started the server");
      },
      error => error as { code: number; stdout: string; stderr: string },
    );
    expect(result.code).toBe(1);
    expect(result.stdout + result.stderr).not.toContain("private-");
    expect(JSON.parse(result.stdout)).toMatchObject({
      event: "startup_failure",
      reason: "environment_validation",
    });
  },
);

it("supports the portable identity without assuming a Render deployment", async () => {
  delete process.env.RENDER_GIT_COMMIT;
  process.env.RELEASE_COMMIT = commit;
  expect(
    (await request(createApp()).get("/health")).headers["x-release-commit"],
  ).toBe(commit);
});
