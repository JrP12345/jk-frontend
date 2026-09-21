import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

describe("Content Security Policy (CSP) Regression Tests", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("generates strict CSP without unsafe-inline or unsafe-eval in production mode", () => {
    process.env.NODE_ENV = "production";
    const request = new NextRequest("https://ananta.health/browse");
    const response = proxy(request);

    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toBeDefined();
    expect(csp).not.toBeNull();

    // In production, must NOT contain unsafe-inline anywhere
    expect(csp).not.toContain("'unsafe-inline'");
    // Must NOT contain unsafe-eval in production
    expect(csp).not.toContain("'unsafe-eval'");
    // Must NOT permit style-src-attr
    expect(csp).not.toContain("style-src-attr");

    // Must enforce nonce on script and style
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+'/);
    expect(csp).toMatch(/style-src 'self' 'nonce-[A-Za-z0-9+/=]+'/);

    // Default source and object restriction
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
  });

  it("allows unsafe-inline styles and unsafe-eval in development mode for Next devtools and React overlay", () => {
    process.env.NODE_ENV = "development";
    const request = new NextRequest("https://ananta.health/browse");
    const response = proxy(request);

    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toBeDefined();

    // In development mode, Next.js devtools and HMR style injection need unsafe-inline & unsafe-eval
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain("style-src-attr");
  });

  it("generates unique cryptographic nonces across requests", () => {
    process.env.NODE_ENV = "production";
    const req1 = new NextRequest("https://ananta.health/browse");
    const res1 = proxy(req1);
    const nonce1 = res1.headers.get("x-nonce") || "";
    const cspNonce1 = res1.headers.get("Content-Security-Policy")?.match(/'nonce-([^']+)'/)?.[1];

    const req2 = new NextRequest("https://ananta.health/browse");
    const res2 = proxy(req2);
    const nonce2 = res2.headers.get("x-nonce") || "";
    const cspNonce2 = res2.headers.get("Content-Security-Policy")?.match(/'nonce-([^']+)'/)?.[1];

    expect(nonce1).toBeTruthy();
    expect(nonce2).toBeTruthy();
    expect(nonce1).not.toBe(nonce2);

    expect(cspNonce1).toBe(nonce1);
    expect(cspNonce2).toBe(nonce2);
  });
});
