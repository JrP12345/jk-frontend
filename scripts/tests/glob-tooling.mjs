import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import glob, { globSync } from "../../packages/fast-glob/index.mjs";

const require = createRequire(import.meta.url);
const fixture = await mkdtemp(path.join(os.tmpdir(), "ekavyu-glob-tooling with spaces-"));
const posix = value => value.replaceAll("\\", "/");
after(async () => {
  assert.equal(path.dirname(fixture), path.resolve(os.tmpdir()));
  assert.ok(path.basename(fixture).startsWith("ekavyu-glob-tooling with spaces-"));
  await rm(fixture, { recursive: true, force: true });
});
for (const [name, content] of Object.entries({
  "apps/clinic/package.json": "{}",
  "apps/pharmacy/package.json": "{}",
  "pages/one.js": "export default 'ordinary';",
  "pages/two.ts": "export default 'typed';",
  "pages/skip.txt": "not a module",
  "pages/.hidden.js": "export default 'hidden';",
  "pages/nested/index.js": "export default 'nested';",
  "entry.js": "export function load(name) { return import('./pages/' + name + '.js'); }",
  "common.js": "export function load(name) { return require('./pages/' + name + '.js'); }",
})) {
  const target = path.join(fixture, name);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}

test("sync, async and CommonJS APIs preserve the callers' glob contracts", async () => {
  const patterns = ["pages/**/*.{js,ts}", "!pages/nested/**"];
  const expected = ["pages/one.js", "pages/two.ts"];
  assert.deepEqual(globSync(patterns, { cwd: fixture }).sort(), expected);
  assert.deepEqual((await glob(patterns, { cwd: fixture })).sort(), expected);
  const cjs = require("../../packages/fast-glob/index.cjs");
  assert.equal(typeof cjs, "function");
  assert.equal(cjs.sync, cjs.globSync);
  assert.deepEqual(cjs.sync(patterns, { cwd: fixture }).sort(), expected);
  assert.deepEqual(globSync("pages", { cwd: fixture }), []);
  assert.deepEqual(globSync(`${posix(fixture)}/apps/*`, { onlyDirectories: true }).sort(), ["clinic", "pharmacy"].map(name => `${posix(fixture)}/apps/${name}`));
});

test("unsupported options, ambiguous patterns and excessive nesting fail visibly", () => {
  assert.throws(() => globSync("**", { stats: true }), /Unsupported/);
  assert.throws(() => globSync([`${posix(fixture)}/*`, "pages/*"]), /Mixed/);
  assert.throws(() => globSync("{01..05}"), /Padded/);
  assert.throws(() => globSync("{1..10..2}"), /stepped/);
  assert.throws(() => globSync("{".repeat(65)), /nesting/);
  assert.throws(() => globSync("x".repeat(32769)), /Invalid/);
});

test("both installed consumers resolve the reviewed adapter", () => {
  const adapter = fileURLToPath(new URL("../../packages/fast-glob/index.cjs", import.meta.url));
  for (const consumer of ["@next/eslint-plugin-next", "vite-plugin-dynamic-import"]) {
    const fromConsumer = createRequire(require.resolve(consumer));
    assert.equal(fromConsumer.resolve("fast-glob"), adapter, consumer);
  }
});

test("Next lint discovers configured workspace roots", () => {
  const pluginRoot = path.dirname(require.resolve("@next/eslint-plugin-next"));
  const { getRootDirs } = require(path.join(pluginRoot, "utils/get-root-dirs.js"));
  const roots = getRootDirs({ cwd: fixture, settings: { next: { rootDir: `${posix(fixture)}/apps/*` } } });
  assert.deepEqual(roots.sort(), ["clinic", "pharmacy"].map(name => `${posix(fixture)}/apps/${name}`));
  assert.deepEqual(getRootDirs({ cwd: fixture, settings: {} }), [fixture]);
});

test("Vite dynamic import and CommonJS builds discover actual modules", async () => {
  const { build } = await import("vite");
  const { default: dynamicImport } = await import("vite-plugin-dynamic-import");
  const { default: commonjs } = await import("vite-plugin-commonjs");
  for (const [entry, plugin] of [["entry.js", dynamicImport()], ["common.js", commonjs()]]) {
    const result = await build({
      root: fixture, configFile: false, logLevel: "silent", plugins: [plugin],
      build: { write: false, minify: false, lib: { entry: path.join(fixture, entry), formats: ["es"] } },
    });
    const code = (Array.isArray(result) ? result : [result]).flatMap(item => item.output).filter(item => item.type === "chunk").map(item => item.code).join("\n");
    assert.ok(code.includes("ordinary"), entry);
    assert.ok(code.includes("nested"), entry);
    assert.ok(!code.includes("not a module"), entry);
    assert.ok(!code.includes("hidden"), entry);
  }
});
