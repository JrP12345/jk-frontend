"use strict";
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Next loads this synchronous CommonJS entry with require().
const path = require("node:path");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Keep the CommonJS consumer free of an asynchronous ESM boundary.
const tiny = require("tinyglobby");

// These are the options used by the checked Next and Vite callers. Refuse API
// drift instead of silently ignoring an unsupported fast-glob option.
function input(patterns, options = {}) {
  const list = typeof patterns === "string" ? [patterns] : patterns;
  if (!Array.isArray(list) || list.length > 256 || list.some(value => typeof value !== "string" || value.length > 32768)) throw new TypeError("Invalid tooling glob patterns");
  if (!options || typeof options !== "object" || Array.isArray(options) || Object.keys(options).some(key => !["cwd", "onlyDirectories", "absolute"].includes(key))) throw new TypeError("Unsupported tooling glob option; review its caller before extending the adapter");
  if (options.cwd !== undefined && typeof options.cwd !== "string" || options.onlyDirectories !== undefined && typeof options.onlyDirectories !== "boolean" || options.absolute !== undefined && typeof options.absolute !== "boolean") throw new TypeError("Invalid tooling glob options");
  for (const pattern of list) {
    let depth = 0;
    for (let index = 0; index < pattern.length; index++) {
      const char = pattern[index];
      if (char === "\\") { index++; continue; }
      if (char === "{" || char === "(") { if (++depth > 64) throw new RangeError("Tooling glob nesting exceeds the supported limit"); }
      else if (char === "}" || char === ")") depth = Math.max(0, depth - 1);
    }
    for (const [, body] of pattern.matchAll(/\{([^{}]*)\}/g)) {
      const range = body.split("..");
      if (range.length > 2 || range.length === 2 && /^-?0\d+$/.test(range[0])) throw new TypeError("Padded or stepped brace ranges are unsupported by the tooling adapter");
    }
  }
  const positive = list.filter(pattern => !pattern.startsWith("!"));
  const absolute = positive.map(pattern => path.isAbsolute(pattern));
  if (absolute.some(Boolean) && absolute.some(value => !value)) throw new TypeError("Mixed absolute and relative tooling globs require separate calls");
  return [list, { ...options, expandDirectories: false, absolute: options.absolute ?? absolute.some(Boolean) }];
}
// tinyglobby marks directories with a slash; fast-glob's default does not.
function normalize(results) {
  return results.map(value => value.endsWith("/") && value !== "/" && !/^[a-zA-Z]:\/$/.test(value) ? value.slice(0, -1) : value);
}
async function glob(patterns, options) { return normalize(await tiny.glob(...input(patterns, options))); }
function globSync(patterns, options) { return normalize(tiny.globSync(...input(patterns, options))); }
module.exports = Object.assign(glob, { glob, globSync, sync: globSync });
