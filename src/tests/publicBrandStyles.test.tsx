import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import PublicBrandStyles from "@/components/PublicBrandStyles";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-nonce": "test-nonce" }) }));

it("renders saved branding under the response nonce without style attributes", async () => {
  const html = renderToStaticMarkup(await PublicBrandStyles({ color: "#1D4ED8" }));
  expect(html).toContain('nonce="test-nonce"');
  expect(html).toContain("border-top:4px solid #1D4ED8");
  expect(html).toContain("background-color:#1D4ED8");
  expect(html).not.toContain("style=");
});

it.each([undefined, "red", "#123", "#ffffff}</style><script>alert(1)</script>"])("rejects untrusted CSS input %s", async color => {
  const html = renderToStaticMarkup(await PublicBrandStyles({ color }));
  expect(html).toContain("border-top:4px solid #0F6F66");
  expect(html).not.toContain("<script>");
});
