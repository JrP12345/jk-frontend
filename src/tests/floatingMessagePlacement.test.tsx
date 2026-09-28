import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PWAInstallBanner } from "@/components/ui/PWAInstallBanner";
import { ToastProvider, useToast } from "@/components/ui/Toast";

function offerInstallation() {
  act(() => { window.dispatchEvent(new Event("beforeinstallprompt", { cancelable: true })); });
}

function Page({ browse = false }: { browse?: boolean }) {
  const { toast, clearAll } = useToast();
  return <>
    <header key={browse ? "browse" : "dashboard"} data-app-header data-bottom={browse ? 64 : 112}>Navigation</header>
    <button onClick={() => toast({ title: "Impersonation ended", duration: 10000 })}>Notify</button>
    <button onClick={clearAll}>Clear messages</button>
    <PWAInstallBanner />
  </>;
}

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const bottom = Number(this.dataset.bottom || 0);
    return { top: 0, bottom, height: bottom, width: 390 } as DOMRect;
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Floating messages across page transitions", () => {
  it("keeps the install prompt below the current header when routes replace navigation", async () => {
    const { container, rerender } = render(<ToastProvider><Page /></ToastProvider>);
    offerInstallation();
    const banner = screen.getByRole("region", { name: "Install Ekavyu" });
    expect(container).not.toContainElement(banner);
    expect(banner.style.getPropertyValue("--toast-header-offset")).toBe("124px");
    rerender(<ToastProvider><Page browse /></ToastProvider>);
    await waitFor(() => expect(banner.style.getPropertyValue("--toast-header-offset")).toBe("76px"));
  });

  it("gives notifications priority over the install prompt without dismissing installation", () => {
    render(<ToastProvider><Page browse /></ToastProvider>);
    offerInstallation();
    fireEvent.click(screen.getByRole("button", { name: "Notify" }));
    expect(screen.queryByRole("region", { name: "Install Ekavyu" })).not.toBeInTheDocument();
    const region = screen.getByRole("region", { name: "Notifications" });
    expect(region.style.getPropertyValue("--toast-header-offset")).toBe("76px");
    expect(within(region).getByRole("group", { name: "Impersonation ended" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear messages" }));
    expect(screen.getByRole("region", { name: "Install Ekavyu" })).toBeVisible();
    expect(sessionStorage.getItem("pwa_install_dismissed")).toBeNull();
  });

  it("tracks the mobile keyboard viewport and remembers explicit install dismissal", () => {
    const viewport = Object.assign(new EventTarget(), { offsetTop: 24, height: 360 });
    vi.stubGlobal("visualViewport", viewport);
    render(<ToastProvider><Page browse /></ToastProvider>);
    offerInstallation();
    const banner = screen.getByRole("region", { name: "Install Ekavyu" });
    expect(banner.style.getPropertyValue("--toast-visible-top")).toBe("40px");
    expect(banner.style.getPropertyValue("--toast-viewport-bottom")).toBe("384px");
    act(() => { viewport.offsetTop = 80; viewport.height = 280; viewport.dispatchEvent(new Event("resize")); });
    expect(banner.style.getPropertyValue("--toast-visible-top")).toBe("96px");
    expect(banner.style.getPropertyValue("--toast-viewport-bottom")).toBe("360px");
    fireEvent.click(within(banner).getByRole("button", { name: "Dismiss banner" }));
    expect(screen.queryByRole("region", { name: "Install Ekavyu" })).not.toBeInTheDocument();
    expect(sessionStorage.getItem("pwa_install_dismissed")).toBe("1");
  });
});
