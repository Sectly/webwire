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

  console.log(`Building @webwirejs/${pkg}...`);

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

  console.log(`  ✓ @webwirejs/${pkg}`);
}

function getExternals(pkg) {
  const map = {
    core: [],
    client: ["@webwirejs/core"],
    server: ["@webwirejs/core"],
    express:  ["@webwirejs/core", "@webwirejs/server", "express"],
    hono:     ["@webwirejs/core", "@webwirejs/server", "hono"],
    fastify:  ["@webwirejs/core", "@webwirejs/server", "fastify", "@fastify/websocket"],
  };
  return map[pkg] ?? [];
}
