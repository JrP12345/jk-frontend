// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import vm from "node:vm";

describe("service worker cache privacy", () => {
  it.each(["open", "put", "keys"])("preserves a successful network response when cache %s fails", async failure => {
    let handler!: (event: { request: Request; respondWith: (job: Promise<Response>) => void }) => void;
    const response = new Response("Current asset", { status: 200 });
    Object.defineProperty(response, "url", { value: "https://app.test/_next/static/chunk.js" });
    const fail = async () => { throw new DOMException("Storage unavailable", "QuotaExceededError"); };
    const cache = { put: failure === "put" ? fail : async () => {}, keys: failure === "keys" ? fail : async () => [], match: async () => new Response("Stale asset") };
    const cacheContext = vm.createContext({ URL, Response,
      self: { location: { origin: "https://app.test" }, addEventListener: (name: string, listener: typeof handler) => { if (name === "fetch") handler = listener; } },
      fetch: vi.fn().mockResolvedValue(response), caches: { open: failure === "open" ? fail : async () => cache },
    });
    vm.runInContext(fs.readFileSync("public/sw.js", "utf8"), cacheContext);
    let pending!: Promise<Response>;
    handler({ request: new Request(response.url), respondWith: job => { pending = job; } });
    expect(await pending).toBe(response);
  });

  it("returns a controlled offline response when both network and cache are unavailable", async () => {
    let handler!: (event: { request: Request; respondWith: (job: Promise<Response>) => void }) => void;
    const fail = async () => { throw new Error("Unavailable"); };
    const cacheContext = vm.createContext({ URL, Response,
      self: { location: { origin: "https://app.test" }, addEventListener: (name: string, listener: typeof handler) => { if (name === "fetch") handler = listener; } },
      fetch: fail, caches: { open: fail },
    });
    vm.runInContext(fs.readFileSync("public/sw.js", "utf8"), cacheContext);
    let pending!: Promise<Response>;
    handler({ request: new Request("https://app.test/browse"), respondWith: job => { pending = job; } });
    expect((await pending).status).toBe(503);
  });

  const context = vm.createContext({ URL, self: { location: { origin: "https://app.test" }, addEventListener() {} } });
  vm.runInContext(fs.readFileSync("public/sw.js", "utf8"), context);
  const evaluate = (expression: string) => vm.runInContext(expression, context);
  it("allows only explicit public pages and immutable assets", () => {
    for (const path of ["/", "/dashboard", "/patients", "/clinical-notes", "/settings", "/auth/login", "/storage/report.png", "/_next/image?url=private"]) expect(evaluate(`allowed(new URL('https://app.test${path}'))`)).toBe(false);
    for (const path of ["/browse", "/pricing", "/_next/static/chunk.js", "/app-icon-192.png"]) expect(evaluate(`allowed(new URL('https://app.test${path}'))`)).toBe(true);
  });
  it("rejects redirects, private cache controls and private final URLs", () => {
    context.response = { status: 200, redirected: true, url: "https://app.test/browse", headers: { get: () => "public" } };
    expect(evaluate("cacheable(response)")).toBe(false);
    context.response.redirected = false; context.response.headers.get = () => "private, no-store";
    expect(evaluate("cacheable(response)")).toBe(false);
    context.response.headers.get = () => "public"; context.response.url = "https://app.test/dashboard";
    expect(evaluate("cacheable(response)")).toBe(false);
    context.response.url = "https://app.test/browse";
    expect(evaluate("cacheable(response)")).toBe(true);
  });

  it("erases current and retired product caches on logout", async () => {
    const handlers: Record<string, (event: { data: { action: string }; waitUntil: (job: Promise<unknown>) => void }) => void> = {};
    const removed: string[] = [];
    const cacheContext = vm.createContext({
      URL,
      self: { location: { origin: "https://app.test" }, addEventListener: (name: string, handler: typeof handlers[string]) => { handlers[name] = handler; } },
      caches: { keys: async () => ["ekavyu-cache-v10", "healthos-cache-v3", "jk-cache-v1", "another-app"], delete: async (name: string) => { removed.push(name); return true; } },
    });
    vm.runInContext(fs.readFileSync("public/sw.js", "utf8"), cacheContext);
    let pending!: Promise<unknown>;
    handlers.message({ data: { action: "CLEAR_USER_CACHE" }, waitUntil: job => { pending = job; } });
    await pending;
    expect(removed.sort()).toEqual(["ekavyu-cache-v10", "healthos-cache-v3", "jk-cache-v1"]);
  });
});
