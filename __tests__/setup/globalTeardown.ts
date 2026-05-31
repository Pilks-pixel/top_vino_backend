/**
 * Jest Global Teardown
 *
 * Runs ONCE after all test suites complete.
 * Disconnects any lingering connections.
 */
export default async function globalTeardown() {
  console.log("[globalTeardown] Test run complete.");
}
