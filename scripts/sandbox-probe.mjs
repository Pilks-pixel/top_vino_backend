import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

// Public operator boundary. Time and HTTP adapters keep five-minute retry tests fast.
export async function probeSandbox(
  origin,
  { request = fetch, wait = delay } = {},
) {
  let address;
  try {
    address = new URL(origin);
    if (
      address.protocol !== "https:" ||
      address.username ||
      address.password ||
      address.pathname !== "/" ||
      address.search ||
      address.hash ||
      address.origin !== origin
    )
      throw new Error();
  } catch {
    throw new Error("Invalid SANDBOX_URL: expected an HTTPS origin");
  }
  for (let attempt = 1; attempt <= 2; attempt++) {
    let stage = "health";
    try {
      for (const path of ["/health", "/ready"]) {
        stage = path === "/health" ? "health" : "ready";
        const response = await request(`${origin}${path}`, {
          signal: AbortSignal.timeout(stage === "health" ? 90000 : 30000),
          redirect: "error",
          credentials: "omit",
        });
        await response.body?.cancel();
        if (!response.ok) throw new Error("Probe response failed");
      }
      return { ok: true, attempts: attempt };
    } catch {
      if (attempt === 2) return { ok: false, attempts: attempt, stage };
      await wait(300000);
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const result = await probeSandbox(process.env.SANDBOX_URL);
    console.log(JSON.stringify({ event: "sandbox_probe", ...result }));
    if (!result.ok) process.exitCode = 1;
  } catch {
    console.error(
      JSON.stringify({
        event: "sandbox_probe",
        ok: false,
        stage: "configuration",
      }),
    );
    process.exitCode = 1;
  }
}
