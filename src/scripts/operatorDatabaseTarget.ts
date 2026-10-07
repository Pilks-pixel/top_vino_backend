/** Workstation-only PostgreSQL target; connection options cannot change its identity. */
export function operatorDatabaseTarget(value: string): {
  database: URL;
  target: string;
} {
  const database = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !database.hostname ||
    !database.port ||
    Number(database.port) < 1 ||
    Number(database.port) > 65535 ||
    !database.username ||
    !database.password ||
    database.pathname.length <= 1 ||
    database.hash ||
    [...database.searchParams.keys()].some(
      key => database.searchParams.getAll(key).length !== 1,
    ) ||
    [
      "host",
      "port",
      "dbname",
      "database",
      "user",
      "password",
      "options",
      "service",
    ].some(key => database.searchParams.has(key)) ||
    (database.searchParams.has("schema") &&
      database.searchParams.get("schema") !== "public") ||
    database.searchParams.get("pgbouncer") === "true"
  )
    throw new Error("Sandbox target configuration invalid");
  return { database, target: `${database.host}${database.pathname}` };
}
