#!/usr/bin/env bun
import { build } from "bun";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const target = process.argv[2];
const packages = target ? [target] : ["core", "client", "server", "express", "hono", "fastify"];

for (const pkg of packages) {
  const pkgDir = resolve(root, "packages", pkg);
  const entry = resolve(pkgDir, "src", "index.js");

  console.log(`Building @webwire/${pkg}...`);

  await build({
    entrypoints: [entry],
    outdir: resolve(pkgDir, "dist"),
    target: "browser",
    format: "esm",
    naming: "index.js",
    external: getExternals(pkg),
  });

  await build({
    entrypoints: [entry],
    outdir: resolve(pkgDir, "dist"),
    target: "node",
    format: "cjs",
    naming: "index.cjs",
    external: getExternals(pkg),
  });

  console.log(`  ✓ @webwire/${pkg}`);
}

function getExternals(pkg) {
  const map = {
    core: [],
    client: ["@webwire/core"],
    server: ["@webwire/core"],
    express:  ["@webwire/core", "@webwire/server", "express"],
    hono:     ["@webwire/core", "@webwire/server", "hono"],
    fastify:  ["@webwire/core", "@webwire/server", "fastify", "@fastify/websocket"],
  };
  return map[pkg] ?? [];
}
