import { readFileSync } from "node:fs";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider, ModeSwitcher, useTheme } from "@/components/ui/ThemeProvider";
import { getPrintBrandStyles } from "@/lib/printBrand";

let media: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("data-mode");
  document.documentElement.removeAttribute("data-palette");
  document.documentElement.style.cssText = "";
  media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal("matchMedia", vi.fn(() => media));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function Probe() {
  const theme = useTheme();
  return <><output>{theme.mode}:{theme.resolvedMode}</output><button onClick={() => theme.setMode("system")}>Use system</button><ModeSwitcher variant="icon" /></>;
}
const mount = () => render(<ThemeProvider><Probe /></ThemeProvider>);

describe("Ekavyu mode compatibility", () => {
  it("keeps a saved dark mode and ignores the retired palette preference", () => {
    localStorage.setItem("jk-mode", "dark");
    localStorage.setItem("jk-palette", "violet");
    mount();
    expect(screen.getByRole("status")).toHaveTextContent("dark:dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).not.toHaveAttribute("data-palette");
    expect(screen.queryByRole("button", { name: /palette/i })).not.toBeInTheDocument();
  });
  it("honors explicit light mode even when the OS and stale DOM are dark", () => {
    media.matches = true;
    localStorage.setItem("jk-mode", "light");
    document.documentElement.classList.add("dark");
    mount();
    expect(document.documentElement).toHaveAttribute("data-mode", "light");
    expect(document.documentElement).not.toHaveClass("dark");
  });
  it("follows system preference changes and removes its listener on unmount", () => {
    localStorage.setItem("jk-mode", "system");
    const view = mount();
    const handler = media.addEventListener.mock.calls[0][1];
    act(() => handler({ matches: true }));
    expect(document.documentElement).toHaveAttribute("data-mode", "dark");
    expect(screen.getByRole("status")).toHaveTextContent("system:dark");
    view.unmount();
    expect(media.removeEventListener).toHaveBeenCalledWith("change", handler);
  });
  it("toggles, persists the existing key and keeps accessible labels in sync", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(localStorage.getItem("jk-mode")).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(localStorage.getItem("jk-mode")).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });
  it("can select system mode without a color selector", () => {
    media.matches = true;
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Use system" }));
    expect(localStorage.getItem("jk-mode")).toBe("system");
    expect(document.documentElement).toHaveAttribute("data-mode", "dark");
  });
  it("continues working when browser storage is denied", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Blocked"); });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(document.documentElement).toHaveAttribute("data-mode", "dark");
  });
  it("resolves the saved system mode before hydration without the retired palette", () => {
    media.matches = true;
    localStorage.setItem("jk-mode", "system");
    localStorage.setItem("jk-palette", "blue");
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    const bootstrap = layout.match(/__html: `([^`]+)`/)?.[1];
    expect(bootstrap).toBeTruthy();
    new Function(bootstrap!)();
    expect(document.documentElement).toHaveAttribute("data-mode", "dark");
    expect(document.documentElement).not.toHaveAttribute("data-palette");
  });
});

describe("standalone print branding", () => {
  it("exports the fixed paper palette from CSS rather than the current dark screen colors", () => {
    document.documentElement.style.setProperty("--print-text", "#0E2A28");
    document.documentElement.style.setProperty("--print-accent", "#0F6F66");
    document.documentElement.style.setProperty("--text-primary", "#F7F7F2");
    const css = getPrintBrandStyles();
    expect(css).toContain("--print-text:#0E2A28;");
    expect(css).toContain("--print-accent:#0F6F66;");
    expect(css).toContain("color-scheme:light;");
    expect(css).not.toContain("#F7F7F2");
  });
});

const css = readFileSync("src/app/globals.css", "utf8");
function palette(mode: "light" | "dark") {
  const base = [...css.matchAll(/(?:^|\n):root \{([^}]+)\}/g)].map(match => match[1]).join("\n");
  const themed = css.match(mode === "light" ? /:root, \[data-mode="light"\] \{([^}]+)\}/ : /\.dark, \[data-mode="dark"\] \{([^}]+)\}/)![1];
  const tokens = Object.fromEntries([...`${base}${themed}`.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
  const resolve = (key: string): string => tokens[key].replace(/var\(--([\w-]+)\)/g, (_, next) => resolve(next));
  return resolve;
}
function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const rgb = hex.slice(1).match(/../g)!.map(n => parseInt(n, 16) / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
    return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  };
  const values = [luminance(a), luminance(b)].sort((x,y) => y-x);
  return (values[0] + .05) / (values[1] + .05);
}
describe.each(["light", "dark"] as const)("%s semantic contrast", mode => {
  const value = palette(mode);
  it.each(["background", "surface", "surface-muted", "surface-elevated"])("keeps all body text AA-readable on %s", surface => {
    for (const text of ["text-primary", "text-secondary", "text-muted", "accent"]) {
      expect(contrast(value(text), value(surface)), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("keeps solid actions, badges, form edges and focus distinguishable", () => {
    expect(contrast(value("brand-mist"), value("brand-primary"))).toBeGreaterThanOrEqual(4.5);
    for (const status of ["success", "warning", "danger"]) expect(contrast(value(`${status}-text`), value(`${status}-subtle`))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(value("input-border"), value("surface"))).toBeGreaterThanOrEqual(3);
    expect(contrast(value("focus-ring"), value("surface"))).toBeGreaterThanOrEqual(3);
  });
});
