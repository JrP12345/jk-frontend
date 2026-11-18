import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { createHash } from "node:crypto";
import { patchCssModules } from "vite-css-modules";
import path from "node:path";
import nextConfig from "./next.config";
import postcssConfig from "./postcss.config.mjs";

export default defineConfig({
  plugins: [
    patchCssModules({ exportMode: "default" }),
    // Cloudflare owns the output layout. Keep standalone in next.config for Node/Docker.
    vinext({ nextConfig: { ...nextConfig, output: undefined } }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
  css: {
    // Reuse Next's plugin declarations, but import their ESM entry points directly.
    // Vite's string loader resolves CJS and adds a cache-busting query, which fails
    // while loading this configuration in the current multi-environment build.
    postcss: {
      ...postcssConfig,
      plugins: await Promise.all(Object.entries(postcssConfig.plugins).map(async ([name, options]) => {
        const { default: plugin } = await import(name);
        return plugin(options);
      })),
    },
    modules: {
      generateScopedName(name: string, filename: string) {
        const relativePath = path.relative(import.meta.dirname, filename.replace(/\?.*$/, "")).replaceAll("\\", "/");
        return `_${name}_${createHash("sha256").update(relativePath).digest("hex").slice(0, 7)}`;
      },
    },
  },
});
