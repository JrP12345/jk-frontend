import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePWA } from "@/hooks/usePWA";
import { PWAInstallBanner } from "@/components/ui/PWAInstallBanner";

vi.mock("next/navigation", () => ({ usePathname: () => "/browse" }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ hasActiveToasts: false }) }));

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  sessionStorage.clear();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function offer(outcome: "accepted" | "dismissed" = "dismissed") {
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome, platform: "web" }),
  });
  act(() => { window.dispatchEvent(event); });
  return event;
}

describe("PWA install recovery", () => {
  it("consumes a dismissed prompt once, including simultaneous clicks, and accepts a new offer", async () => {
    const { result } = renderHook(() => usePWA());
    const event = offer();
    await act(async () => {
      const install = result.current.installApp;
      expect(await Promise.all([install(), install()])).toEqual([false, false]);
    });
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(result.current.isInstallable).toBe(false);
    const replacement = offer("accepted");
    await act(async () => { expect(await result.current.installApp()).toBe(true); });
    expect(replacement.prompt).toHaveBeenCalledOnce();
    expect(result.current.isInstalled).toBe(true);
  });

  it("recovers from a browser prompt rejection without retaining the consumed event", async () => {
    const { result } = renderHook(() => usePWA());
    const event = offer();
    event.prompt.mockRejectedValueOnce(new DOMException("Prompt unavailable", "NotAllowedError"));
    await act(async () => { expect(await result.current.installApp()).toBe(false); });
    expect(result.current.isInstallable).toBe(false);
    expect(result.current.isInstalled).toBe(false);
  });

  it("removes its installed-event listener on unmount", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => usePWA());
    const handler = add.mock.calls.find(([name]) => name === "appinstalled")?.[1];
    expect(handler).toBeDefined();
    unmount();
    expect(remove).toHaveBeenCalledWith("appinstalled", handler);
  });

  it("allows an in-memory dismissal when storage reads and writes are blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    render(<PWAInstallBanner />);
    offer();
    expect(screen.getByRole("region", { name: "Install Ekavyu" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss banner" }));
    expect(screen.queryByRole("region", { name: "Install Ekavyu" })).not.toBeInTheDocument();
  });
});
