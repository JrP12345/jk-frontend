import { bindings, defineConfig, defineWorker } from "cf/config";

// One operator-configured upstream, shared with next.config's HTTP rewrite.
// Loopback HTTP is supported only to exercise the Worker against a local fixture.
const backend = new URL(process.env.BACKEND_INTERNAL_URL || "");
if (backend.username || backend.password || backend.search || backend.hash || backend.pathname !== "/" ||
    (backend.protocol !== "https:" && !(backend.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(backend.hostname)))) {
  throw new Error("BACKEND_INTERNAL_URL must be an HTTPS origin (or loopback HTTP for local checks)");
}

export default defineConfig({
  worker: defineWorker({
    name: "ekavyu-dev",
    entrypoint: "./cloudflare/worker.ts",
    compatibilityDate: "2026-10-18",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      BACKEND_INTERNAL_URL: bindings.text(backend.origin),
    },
  }),
});
