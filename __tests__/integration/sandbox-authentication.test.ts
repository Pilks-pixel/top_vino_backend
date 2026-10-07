import request from "supertest";
import { jest } from "@jest/globals";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import {
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { makeSignature } from "better-auth/crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const temporary = await mkdtemp(join(tmpdir(), "top-vino-testers-"));
const databaseTarget = "localhost:5432/top_vino_test";

async function provisionTester(email: string) {
  const file = join(temporary, `${email}.json`);
  const output = await execute(
    process.execPath,
    [
      "--experimental-strip-types",
      "src/scripts/manageSyntheticTester.ts",
      "provision",
      "--email",
      email,
      "--credentials-file",
      file,
      "--confirm-target",
      databaseTarget,
    ],
    {
      env: {
        ...process.env,
        SANDBOX_TESTER_TOOLS_ENABLED: "true",
        SANDBOX_DATABASE_TARGET: databaseTarget,
        SANDBOX_PROVISIONING_DATABASE_URL: process.env.DATABASE_URL,
      },
    },
  );
  const credentials = JSON.parse(await readFile(file, "utf8")) as {
    email: string;
    password: string;
  };
  expect(output.stdout + output.stderr).not.toContain(credentials.password);
  expect((await stat(file)).mode & 0o777).toBe(0o600);
  await rm(file);
  return credentials;
}

function sessionCookie(response: request.Response): string {
  const cookies = response.headers["set-cookie"] as unknown as string[];
  return cookies.map(cookie => cookie.split(";", 1)[0]).join("; ");
}

async function startProductionServer(secrets: string) {
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const port = (socket.address() as { port: number }).port;
  await new Promise<void>(resolve => socket.close(() => resolve()));
  const child = spawn(
    process.execPath,
    ["--experimental-strip-types", "src/server.ts"],
    {
      env: {
        ...process.env,
        PORT: String(port),
        FRONTEND_URL: "https://api.example.test",
        BETTER_AUTH_SECRETS: secrets,
        LOG_LEVEL: "info",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  await new Promise<void>((resolve, reject) => {
    const deadline = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Production API startup timed out"));
    }, 10_000);
    child.once("exit", code => {
      clearTimeout(deadline);
      reject(new Error(`Production API exited with ${code}`));
    });
    child.stdout.on("data", chunk => {
      if (String(chunk).includes('"event":"server_started"')) {
        clearTimeout(deadline);
        resolve();
      }
    });
  });
  return {
    address: `http://127.0.0.1:${port}`,
    async stop() {
      const exited = once(child, "exit");
      child.kill("SIGTERM");
      await exited;
    },
  };
}

const originalEnv = { ...process.env };
process.env = { ...process.env };
let rateClock = Date.now();
process.env.NODE_ENV = "production";
process.env.BETTER_AUTH_URL = "https://api.example.test";
process.env.BETTER_AUTH_SECRETS =
  "1:synthetic-test-signing-key-with-at-least-32-characters";
// Prisma's local client can load missing keys from .env even in these tests.
// Empty legacy inputs prevent that local autoload from changing the contract.
process.env.BETTER_AUTH_SECRET = "";
process.env.AUTH_SECRET = "";
process.env.LOG_LEVEL = "silent";

const { createApp } = await import("../../src/app.ts");
const { cleanDb, disconnectDb, testPrisma } = await import(
  "../setup/testDb.ts"
);
const { disconnectPrisma } = await import("../../src/lib/prisma.ts");

beforeEach(async () => {
  // Advance the clock at its external boundary so production burst protection
  // remains enabled without making independent onboarding tests sleep.
  rateClock += 15_000;
  jest.spyOn(Date, "now").mockReturnValue(rateClock);
  process.env.NODE_ENV = "production";
  await cleanDb();
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await cleanDb();
  await disconnectDb();
  await disconnectPrisma();
  await rm(temporary, { recursive: true, force: true });
  process.env = originalEnv;
});

describe("production synthetic tester authentication", () => {
  it("refuses unsafe operator requests without database changes, delivery-file overwrite, or credential leaks", async () => {
    const existingFile = join(temporary, "existing.json");
    await writeFile(existingFile, "existing-private-delivery", { mode: 0o600 });
    const safeFile = join(temporary, "guarded.json");
    const checkoutLink = join(temporary, "checkout-link");
    await symlink(process.cwd(), checkoutLink, "dir");
    const env = {
      ...process.env,
      SANDBOX_TESTER_TOOLS_ENABLED: "true",
      SANDBOX_DATABASE_TARGET: databaseTarget,
      SANDBOX_PROVISIONING_DATABASE_URL: process.env.DATABASE_URL,
    };
    const noPortDatabase = new URL(process.env.DATABASE_URL!);
    noPortDatabase.port = "";
    const noPortTarget = `${noPortDatabase.host}${noPortDatabase.pathname}`;
    const cases = [
      { env: { ...env, SANDBOX_TESTER_TOOLS_ENABLED: "false" } },
      { env: { ...env, SANDBOX_DATABASE_TARGET: "other/db" } },
      {
        env: {
          ...env,
          SANDBOX_PROVISIONING_DATABASE_URL:
            "postgresql://user:private-database-password@localhost:5432/other",
        },
      },
      ...[
        "host=localhost",
        "port=5432",
        "options=-csearch_path%3Dpublic",
        "user=pete",
        "schema=other",
        "schema=public&schema=other",
      ].map(override => ({
        env: {
          ...env,
          SANDBOX_PROVISIONING_DATABASE_URL: `${process.env.DATABASE_URL}?${override}`,
        },
      })),
      {
        env: {
          ...env,
          PGPORT: "5432",
          SANDBOX_DATABASE_TARGET: noPortTarget,
          SANDBOX_PROVISIONING_DATABASE_URL: noPortDatabase.href,
        },
        confirm: noPortTarget,
      },
      { confirm: "other/db" },
      { email: "real-person@example.com" },
      { file: existingFile },
      { file: join(process.cwd(), "operator-test-credentials.json") },
      { file: join(checkoutLink, "operator-test-credentials.json") },
    ];
    for (const unsafe of cases) {
      try {
        await execute(
          process.execPath,
          [
            "--experimental-strip-types",
            "src/scripts/manageSyntheticTester.ts",
            "provision",
            "--email",
            unsafe.email ?? "tester-guard@example.test",
            "--credentials-file",
            unsafe.file ?? safeFile,
            "--confirm-target",
            unsafe.confirm ?? databaseTarget,
          ],
          { env: unsafe.env ?? env },
        );
        throw new Error("Unsafe operator action succeeded");
      } catch (error) {
        const failure = error as {
          code?: number;
          stdout?: string;
          stderr?: string;
        };
        expect(failure.code).toBe(1);
        expect((failure.stdout ?? "") + (failure.stderr ?? "")).not.toContain(
          "private-",
        );
      }
    }
    expect(await testPrisma.user.count()).toBe(0);
    expect(await readFile(existingFile, "utf8")).toBe(
      "existing-private-delivery",
    );
    await expect(readFile(safeFile)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("fails closed for recovery, verification, provider, and other unenabled capabilities", async () => {
    for (const [method, path] of [
      ["post", "/request-password-reset"],
      ["post", "/reset-password"],
      ["get", "/reset-password/test-token"],
      ["post", "/send-verification-email"],
      ["get", "/verify-email"],
      ["post", "/change-email"],
      ["post", "/sign-in/social"],
      ["get", "/callback/google"],
      ["post", "/link-social"],
      ["post", "/unlink-account"],
      ["get", "/list-accounts"],
      ["post", "/get-access-token"],
      ["post", "/refresh-token"],
      ["post", "/delete-user"],
      ["post", "/update-user"],
      ["post", "/set-password"],
      ["post", "/sign-up/email/"],
      ["post", "/sign-up%2Femail"],
    ] as const) {
      const client = request(createApp());
      const response = await client[method](`/api/auth${path}`)
        .set("Origin", "https://api.example.test")
        .send({
          provider: "google",
          email: "tester@example.test",
          token: "synthetic-token",
        });
      expect(response.status).toBe(404);
      expect(response.headers["set-cookie"]).toBeUndefined();
    }
  });

  it("lets testers revoke other sessions, revoke all sessions, and sign out", async () => {
    const tester = await provisionTester("tester-sessions@example.test");
    const app = createApp();
    const login = async () => {
      const response = await request(app)
        .post("/api/auth/sign-in/email")
        .set("Origin", "https://api.example.test")
        .send(tester);
      expect(response.status).toBe(200);
      return sessionCookie(response);
    };
    const first = await login();
    const second = await login();
    const revoke = (path: string, cookie: string) =>
      request(app)
        .post(`/api/auth/${path}`)
        .set("Origin", "https://api.example.test")
        .set("Cookie", cookie)
        .send({});
    expect((await revoke("revoke-other-sessions", first)).status).toBe(200);
    expect(
      (await request(app).get("/user/me").set("Cookie", second)).status,
    ).toBe(401);
    expect(
      (await request(app).get("/user/me").set("Cookie", first)).status,
    ).toBe(200);
    const third = await login();
    expect((await revoke("revoke-sessions", first)).status).toBe(200);
    for (const cookie of [first, third])
      expect(
        (await request(app).get("/user/me").set("Cookie", cookie)).status,
      ).toBe(401);
    rateClock += 15_000;
    jest.spyOn(Date, "now").mockReturnValue(rateClock);
    const final = await login();
    expect((await revoke("sign-out", final)).status).toBe(200);
    expect(
      (await request(app).get("/user/me").set("Cookie", final)).status,
    ).toBe(401);
  });

  it("uses real cookie sessions for Deck Access and keeps each requestor's Progress separate", async () => {
    const tester = await provisionTester("tester-owner@example.test");
    const other = await provisionTester("tester-reader@example.test");
    const app = createApp();
    const signIn = async (credentials: typeof tester) => {
      const response = await request(app)
        .post("/api/auth/sign-in/email")
        .set("Origin", "https://api.example.test")
        .send(credentials);
      expect(response.status).toBe(200);
      return {
        cookie: sessionCookie(response),
        id: response.body.user.id as string,
      };
    };
    const owner = await signIn(tester);
    const reader = await signIn(other);
    const deck = await request(app)
      .post("/deck")
      .set("Cookie", owner.cookie)
      .send({ name: "Synthetic study Deck", isPublic: false });
    expect(deck.status).toBe(201);
    const deckPath = `/deck/${deck.body.data.id}`;
    expect(
      (await request(app).get(deckPath).set("Cookie", owner.cookie)).status,
    ).toBe(200);
    expect((await request(app).get(deckPath)).status).toBe(401);
    expect(
      (await request(app).get(deckPath).set("Cookie", reader.cookie)).status,
    ).toBe(403);
    const card = await request(app)
      .post(`${deckPath}/cards`)
      .set("Cookie", owner.cookie)
      .send({
        type: "basic",
        question: "What is a synthetic fixture?",
        correctAnswer: "Disposable study content",
      });
    expect(card.status).toBe(201);
    expect(
      (
        await request(app)
          .put(deckPath)
          .set("Cookie", owner.cookie)
          .send({ isPublic: true })
      ).status,
    ).toBe(200);
    expect(
      (await request(app).get(deckPath).set("Cookie", reader.cookie)).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .put(deckPath)
          .set("Cookie", reader.cookie)
          .send({ name: "Denied edit" })
      ).status,
    ).toBe(403);
    const review = await request(app)
      .post("/review")
      .set("Cookie", owner.cookie)
      .send({ cardId: card.body.data.id, quality: 4 });
    expect(review.status).toBe(201);
    const progressPath = `/review/progress/${card.body.data.id}`;
    expect(
      (await request(app).get(progressPath).set("Cookie", reader.cookie))
        .status,
    ).toBe(404);
    const readerReview = await request(app)
      .post("/review")
      .set("Cookie", reader.cookie)
      .send({ cardId: card.body.data.id, quality: 2 });
    expect(readerReview.status).toBe(201);
    expect(readerReview.body.data.progress.userId).toBe(reader.id);
    const ownerProgress = await request(app)
      .get(progressPath)
      .set("Cookie", owner.cookie);
    expect(ownerProgress.status).toBe(200);
    expect(ownerProgress.body.data).toEqual(review.body.data.progress);
  });

  it("revokes all of a tester's sessions and sign-in access without resetting existing credentials", async () => {
    const tester = await provisionTester("tester-revoke@example.test");
    const app = createApp();
    const login = () =>
      request(app)
        .post("/api/auth/sign-in/email")
        .set("Origin", "https://api.example.test")
        .send(tester);
    const first = await login();
    const second = await login();
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const env = {
      ...process.env,
      SANDBOX_TESTER_TOOLS_ENABLED: "true",
      SANDBOX_DATABASE_TARGET: databaseTarget,
      SANDBOX_PROVISIONING_DATABASE_URL: process.env.DATABASE_URL,
    };
    const repeatFile = join(temporary, "repeat.json");
    await expect(
      execute(
        process.execPath,
        [
          "--experimental-strip-types",
          "src/scripts/manageSyntheticTester.ts",
          "provision",
          "--email",
          tester.email,
          "--credentials-file",
          repeatFile,
          "--confirm-target",
          databaseTarget,
        ],
        { env },
      ),
    ).rejects.toMatchObject({ code: 1 });
    await expect(readFile(repeatFile)).rejects.toMatchObject({
      code: "ENOENT",
    });
    // Repeated provisioning left the original password usable.
    expect((await login()).status).toBe(200);
    const revoked = await execute(
      process.execPath,
      [
        "--experimental-strip-types",
        "src/scripts/manageSyntheticTester.ts",
        "revoke",
        "--email",
        tester.email,
        "--confirm-target",
        databaseTarget,
      ],
      { env },
    );
    expect(revoked.stdout + revoked.stderr).not.toContain(tester.password);
    for (const response of [first, second]) {
      const cookie = sessionCookie(response);
      expect(
        (await request(app).get("/user/me").set("Cookie", cookie)).status,
      ).toBe(401);
      expect(
        (await request(app).get("/api/auth/get-session").set("Cookie", cookie))
          .body,
      ).toBeNull();
    }
    rateClock += 15_000;
    jest.spyOn(Date, "now").mockReturnValue(rateClock);
    expect((await login()).status).toBe(401);
    // Model the race's stored result: sign-in read credentials before revoke,
    // then inserted its session afterwards. Each endpoint gets a fresh late
    // session so a preceding denial cannot mask a missing authorization check.
    for (const [method, path, body] of [
      ["get", "/user/me", {}],
      ["get", "/api/auth/get-session", {}],
      ["get", "/api/auth/list-sessions", {}],
      [
        "post",
        "/api/auth/change-password",
        {
          currentPassword: tester.password,
          newPassword: "changed-synthetic-password",
        },
      ],
      ["post", "/api/auth/revoke-sessions", {}],
      ["post", "/api/auth/revoke-other-sessions", {}],
      [
        "post",
        "/api/auth/revoke-session",
        { token: "another-synthetic-session" },
      ],
    ] as const) {
      const token = randomUUID();
      await testPrisma.session.create({
        data: {
          id: randomUUID(),
          token,
          userId: first.body.user.id,
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });
      const name = sessionCookie(first).split("=", 1)[0];
      const signature = await makeSignature(
        token,
        process.env.BETTER_AUTH_SECRETS!.split(":")[1],
      );
      const lateCookie = `${name}=${encodeURIComponent(`${token}.${signature}`)}`;
      const client = request(app);
      const denied = await client[method](path)
        .set("Origin", "https://api.example.test")
        .set("Cookie", lateCookie)
        .send(body);
      expect(denied.status).toBe(401);
      expect(
        await testPrisma.session.count({
          where: { userId: first.body.user.id },
        }),
      ).toBe(0);
    }
    await expect(
      execute(
        process.execPath,
        [
          "--experimental-strip-types",
          "src/scripts/manageSyntheticTester.ts",
          "provision",
          "--email",
          tester.email,
          "--credentials-file",
          repeatFile,
          "--confirm-target",
          databaseTarget,
        ],
        { env },
      ),
    ).rejects.toMatchObject({ code: 1 });
  });

  it("keeps existing cookie sessions through an overlapping key rotation and rejects retired keys", async () => {
    const tester = await provisionTester("tester-rotation@example.test");
    const signIn = await request(createApp())
      .post("/api/auth/sign-in/email")
      .set("Origin", "https://api.example.test")
      .send(tester);
    expect(signIn.status).toBe(200);
    const oldCookie = sessionCookie(signIn);
    const oldKey = process.env.BETTER_AUTH_SECRETS!;
    const currentKey =
      "2:rotated-synthetic-signing-key-with-at-least-32-characters";
    const overlapping = await startProductionServer(`${currentKey},${oldKey}`);
    let newCookie: string;
    try {
      const profile = await request(overlapping.address)
        .get("/user/me")
        .set("Cookie", oldCookie);
      expect(profile.status).toBe(200);
      expect(profile.body.data.email).toBe(tester.email);
      const session = await request(overlapping.address)
        .get("/api/auth/get-session")
        .set("Cookie", oldCookie);
      expect(session.body.user.email).toBe(tester.email);
      const login = await request(overlapping.address)
        .post("/api/auth/sign-in/email")
        .set("Origin", "https://api.example.test")
        .send(tester);
      expect(login.status).toBe(200);
      newCookie = sessionCookie(login);
    } finally {
      await overlapping.stop();
    }
    const retired = await startProductionServer(currentKey);
    try {
      expect(
        (
          await request(retired.address)
            .get("/user/me")
            .set("Cookie", oldCookie)
        ).status,
      ).toBe(401);
      expect(
        (
          await request(retired.address)
            .get("/user/me")
            .set("Cookie", newCookie!)
        ).status,
      ).toBe(200);
    } finally {
      await retired.stop();
    }
  });

  it("immediately denies a revoked session even when the browser retains every issued cookie", async () => {
    const tester = await provisionTester("tester-003@example.test");
    const app = createApp();
    const login = () =>
      request(app)
        .post("/api/auth/sign-in/email")
        .set("Origin", "https://api.example.test")
        .send(tester);
    const first = await login();
    const second = await login();
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const firstCookie = sessionCookie(first);
    const secondCookie = sessionCookie(second);
    expect(
      (await request(app).get("/user/me").set("Cookie", secondCookie)).status,
    ).toBe(200);

    const revoked = await request(app)
      .post("/api/auth/revoke-session")
      .set("Origin", "https://api.example.test")
      .set("Cookie", firstCookie)
      .send({ token: second.body.token });
    expect(revoked.status).toBe(200);
    expect(
      (await request(app).get("/user/me").set("Cookie", secondCookie)).status,
    ).toBe(401);
    expect(
      (await request(app).get("/user/me").set("Cookie", firstCookie)).status,
    ).toBe(200);
  });

  it("lets an operator provision distinct private passwords and a tester change the initial password", async () => {
    const tester = await provisionTester("tester-001@example.test");
    const other = await provisionTester("tester-002@example.test");
    expect(tester.password).toHaveLength(43);
    expect(other.password).not.toBe(tester.password);
    const app = createApp();
    const signIn = await request(app)
      .post("/api/auth/sign-in/email")
      .set("Origin", "https://api.example.test")
      .send(tester);
    expect(signIn.status).toBe(200);
    const cookie = sessionCookie(signIn);
    const sessions = await request(app)
      .get("/api/auth/list-sessions")
      .set("Cookie", cookie);
    expect(sessions.status).toBe(200);
    expect(sessions.body).toHaveLength(1);

    const newPassword = "tester-changed-synthetic-password";
    const changed = await request(app)
      .post("/api/auth/change-password")
      .set("Origin", "https://api.example.test")
      .set("Cookie", cookie)
      .send({
        currentPassword: tester.password,
        newPassword,
        revokeOtherSessions: true,
      });
    expect(changed.status).toBe(200);
    expect(
      (
        await request(createApp())
          .post("/api/auth/sign-in/email")
          .set("Origin", "https://api.example.test")
          .send(tester)
      ).status,
    ).toBe(401);
    expect(
      (
        await request(createApp())
          .post("/api/auth/sign-in/email")
          .set("Origin", "https://api.example.test")
          .send({ email: tester.email, password: newPassword })
      ).status,
    ).toBe(200);
  });

  it("denies public sign-up even though the generated capability schema advertises it", async () => {
    const app = createApp();
    const schema = await request(app).get("/api/auth/open-api/generate-schema");
    expect(schema.body.paths["/sign-up/email"].post).toBeDefined();

    const response = await request(app)
      .post("/api/auth/sign-up/email")
      .set("Origin", "https://api.example.test")
      .send({
        email: "uninvited@example.test",
        name: "Uninvited tester",
        password: "uninvited-synthetic-password",
      });
    expect(response.status).toBe(404);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });
});
