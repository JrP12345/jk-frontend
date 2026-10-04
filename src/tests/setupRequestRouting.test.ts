import { expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

it("allows the public setup request while preserving CSP", () => {
  const response = proxy(new NextRequest("https://app.example/onboarding?mode=new_org&plan=pro"));
  expect(response.headers.get("location")).toBeNull();
  expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'self'");
});
it("keeps legacy activation and dashboard routes authenticated", () => {
  for (const path of ["/onboarding?key=legacy", "/dashboard/organizations"]) {
    expect(proxy(new NextRequest(`https://app.example${path}`)).headers.get("location")).toBe("https://app.example/login");
  }
});
it("allows authenticated Root provisioning without redirecting its route", () => {
  const response = proxy(new NextRequest("https://app.example/onboarding?mode=new_org", { headers: { cookie: "ananta_session=1" } }));
  expect(response.headers.get("location")).toBeNull();
});
