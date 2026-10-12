/** Portable, nonsecret identity for operator release verification. */
export function releaseCommit(): string | undefined {
  const render = process.env.RENDER_GIT_COMMIT;
  const portable = process.env.RELEASE_COMMIT;
  for (const [name, value] of [
    ["RENDER_GIT_COMMIT", render],
    ["RELEASE_COMMIT", portable],
  ] as const) {
    if (value !== undefined && !/^[a-f0-9]{40}$/i.test(value)) {
      throw new Error(`Invalid environment variable: ${name}`);
    }
  }
  if (render && portable && render.toLowerCase() !== portable.toLowerCase()) {
    throw new Error(
      "Invalid environment variable: RENDER_GIT_COMMIT/RELEASE_COMMIT",
    );
  }
  return (render ?? portable)?.toLowerCase();
}
