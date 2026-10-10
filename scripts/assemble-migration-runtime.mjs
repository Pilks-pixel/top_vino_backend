// Copy only the lockfile-resolved migration runtime, without a second install.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
const destination = resolve("migration/node_modules");
const copied = new Set();
function copy(name, from = resolve("package.json")) {
  if (copied.has(name)) return;
  copied.add(name);
  const manifest = createRequire(from)
    .resolve.paths(name)
    .map(path => resolve(path, name, "package.json"))
    .find(path => existsSync(path));
  if (!manifest)
    throw new Error(`Locked migration dependency missing: ${name}`);
  const source = dirname(manifest);
  const target = resolve(destination, name);
  mkdirSync(dirname(target), { recursive: true });
  if (name === "prisma") {
    mkdirSync(resolve(target, "build"), { recursive: true });
    cpSync(manifest, resolve(target, "package.json"));
    for (const asset of [
      "prisma_schema_build_bg.wasm",
      "schema_engine_bg.wasm",
    ]) {
      cpSync(resolve(source, "build", asset), resolve(target, "build", asset));
    }
    cpSync(
      resolve(source, "build/index.js"),
      resolve(target, "build/index.js"),
    );
  } else {
    cpSync(source, target, {
      recursive: true,
      filter: path =>
        !path.endsWith(".d.ts") &&
        !path.endsWith(".map") &&
        !path.startsWith(source + "/node_modules/"),
    });
    // Migration deploy needs the schema engine, never a second query engine.
    if (name === "@prisma/engines") {
      for (const asset of readdirSync(target).filter(name =>
        name.startsWith("libquery_engine"),
      )) {
        rmSync(resolve(target, asset));
      }
      rmSync(resolve(target, "scripts"), { recursive: true, force: true });
    }
  }
  const pkg = JSON.parse(readFileSync(manifest, "utf8"));
  for (const dependency of Object.keys(pkg.dependencies ?? {}))
    copy(dependency, manifest);
}
copy("prisma");
