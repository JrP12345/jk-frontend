import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import PublicBrandStyles from "@/components/PublicBrandStyles";
import PublicBrandStyleSheet from "@/components/PublicBrandStyleSheet";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-nonce": "test-nonce" }) }));
afterEach(() => document.getElementById("ekavyu-theme-bootstrap")?.remove());

it("keeps the active document nonce across client navigation and branding changes", () => {
  const bootstrap = document.createElement("script");
  bootstrap.id = "ekavyu-theme-bootstrap";
  bootstrap.nonce = "document-nonce";
  document.head.appendChild(bootstrap);
  // Browsers hide nonce attributes; the property remains available to trusted JS.
  vi.spyOn(bootstrap, "getAttribute").mockReturnValue("");
  const view = render(<PublicBrandStyleSheet color="#123456" nonce="new-request-nonce" />);
  expect(document.querySelector("style")?.nonce).toBe("document-nonce");
  expect(document.querySelector("style")?.textContent).toContain("#123456");
  view.rerender(<PublicBrandStyleSheet color="#654321" nonce="another-request-nonce" />);
  expect(document.querySelector("style")?.nonce).toBe("document-nonce");
  expect(document.querySelector("style")?.textContent).toContain("#654321");
});

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
