// Trusted-workstation operator smoke. Product operations are read-only.
import { open, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

let stage = "configuration";
let cleanupFailed = false;

async function main() {
  const { values } = parseArgs({
    options: {
      origin: { type: "string" },
      "expected-commit": { type: "string" },
      "deck-id": { type: "string" },
      "credentials-file": { type: "string" },
      "allow-test-loopback": { type: "boolean", default: false },
      "timeout-ms": { type: "string", default: "60000" },
    },
  });
  const timeout = Number(values["timeout-ms"]);
  if (
    !/^\d+$/.test(values["timeout-ms"]) ||
    !Number.isInteger(timeout) ||
    timeout < 100 ||
    timeout > 120000
  )
    throw new Error("Invalid timeout");
  const originUrl = new URL(values.origin);
  const testLoopback =
    values["allow-test-loopback"] &&
    process.env.NODE_ENV === "test" &&
    originUrl.protocol === "http:" &&
    ["127.0.0.1", "[::1]", "localhost"].includes(originUrl.hostname);
  if (
    (originUrl.protocol !== "https:" && !testLoopback) ||
    originUrl.origin !== values.origin ||
    originUrl.username ||
    originUrl.password ||
    !/^[a-f0-9]{40}$/.test(values["expected-commit"] ?? "") ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      values["deck-id"] ?? "",
    )
  )
    throw new Error("Invalid configuration");
  const file = values["credentials-file"];
  if (!file || !isAbsolute(file))
    throw new Error("Private external file required");
  const project = await realpath(
    fileURLToPath(new URL("../", import.meta.url)),
  );
  const resolvedFile = await realpath(file);
  if (resolvedFile.startsWith(project + sep))
    throw new Error("Private external file required");
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  let credentials;
  try {
    const metadata = await handle.stat();
    if (
      !metadata.isFile() ||
      (metadata.mode & 0o777) !== 0o600 ||
      metadata.size > 16384
    )
      throw new Error("Private credential file required");
    credentials = JSON.parse(await handle.readFile("utf8"));
  } finally {
    await handle.close();
  }
  const { email, password } = credentials;
  if (
    typeof email !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,63}@example\.test$/.test(email) ||
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 1024
  )
    throw new Error("Synthetic credentials required");
  const origin = values.origin;
  let cookie;
  let failure;
  async function request(path, init = {}) {
    return fetch(`${origin}${path}`, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(timeout),
      headers: {
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
        ...init.headers,
      },
    });
  }
  async function successful(path, name) {
    stage = name;
    const response = await request(path);
    if (response.status !== 200) throw new Error("Unexpected response");
    return response;
  }
  async function signOut() {
    const logout = await request("/api/auth/sign-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (logout.status !== 200) throw new Error("Session cleanup failed");
    await logout.body?.cancel();
  }
  try {
    const root = await successful("/", "commit_identity");
    if (root.headers.get("X-Release-Commit") !== values["expected-commit"])
      throw new Error("Commit mismatch");
    await root.text();
    const healthResponse = await successful("/health", "health");
    if (
      healthResponse.headers.get("X-Release-Commit") !==
      values["expected-commit"]
    )
      throw new Error("Commit mismatch");
    const health = await healthResponse.json();
    if (health.status !== "ok") throw new Error("Health unavailable");
    const ready = await (await successful("/ready", "readiness")).json();
    if (ready.status !== "ready") throw new Error("Readiness unavailable");
    const documentation = await successful("/docs", "documentation");
    if (
      !documentation.headers.get("Content-Type")?.includes("text/html") ||
      !(await documentation.text()).includes("Disposable sandbox")
    )
      throw new Error("Documentation unavailable");
    const schema = await (
      await successful("/openapi.json", "product_schema")
    ).json();
    if (schema.openapi !== "3.1.0" || !schema.paths?.["/deck/{id}"])
      throw new Error("Product schema unavailable");
    const authSchema = await (
      await successful("/api/auth/open-api/generate-schema", "auth_schema")
    ).json();
    if (
      !authSchema.openapi ||
      !authSchema.paths ||
      authSchema.info?.title !== "Better Auth capability reference"
    )
      throw new Error("Auth schema unavailable");
    stage = "sign_in";
    const login = await request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    cookie = login.headers
      .getSetCookie()
      .map(value => value.split(";", 1)[0])
      .join("; ");
    if (
      login.status !== 200 ||
      !cookie ||
      (await login.json()).user?.email !== email
    )
      throw new Error("Sign-in failed");
    const deck = await (
      await successful(`/deck/${values["deck-id"]}`, "authorized_deck")
    ).json();
    if (deck.success !== true || deck.data?.id !== values["deck-id"])
      throw new Error("Authorized Deck unavailable");
  } catch (error) {
    failure = error;
  } finally {
    if (cookie) {
      try {
        await signOut();
      } catch (error) {
        cleanupFailed = true;
        if (!failure) {
          stage = "session_cleanup";
          failure = error;
        }
      }
    }
  }
  if (failure) throw failure;
  console.log(
    JSON.stringify({
      event: "release_smoke_passed",
      commit: values["expected-commit"],
      logsReview: "pending_operator_review",
    }),
  );
}

try {
  await main();
} catch {
  console.error(
    JSON.stringify({ event: "release_smoke_failed", stage, cleanupFailed }),
  );
  process.exitCode = 1;
}
