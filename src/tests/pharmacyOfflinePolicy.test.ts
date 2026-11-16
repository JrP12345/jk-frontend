// @vitest-environment node
import { NextRequest } from "next/server";
import { expect, it } from "vitest";
import { proxy } from "@/proxy";
it("permits the same-origin PWA worker while retaining nonce scripts on the authenticated dashboard", () => {
  const response = proxy(new NextRequest("https://app.test/dashboard/pharmacy", { headers: { cookie: "ekavyu_session=1" } }));
  const policy = response.headers.get("Content-Security-Policy")!;
  expect(policy).toContain("worker-src 'self'"); expect(policy).toContain("'strict-dynamic'"); expect(policy).toMatch(/script-src[^;]*'nonce-/);
  expect(response.headers.get("x-nonce")).toBeTruthy();
});
it("serves the data-free offline shell with a separate self-only policy and no inline scripts", () => {
  const response = proxy(new NextRequest("https://app.test/pharmacy-offline.html"));
  const policy = response.headers.get("Content-Security-Policy")!;
  expect(policy).toContain("default-src 'none'"); expect(policy).toContain("script-src 'self'"); expect(policy).toContain("worker-src 'self'"); expect(policy).not.toContain("unsafe-inline");
  expect(response.headers.get("x-nonce")).toBeNull(); expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
});
