import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PWAInstallBanner } from "@/components/ui/PWAInstallBanner";
import { ToastProvider, useToast, type ToastOptions } from "@/components/ui/Toast";

vi.mock("next/navigation", () => ({ usePathname: () => "/browse" }));

function offerInstallation() {
  act(() => { window.dispatchEvent(new Event("beforeinstallprompt", { cancelable: true })); });
}

function Page({ browse = false, management = false }: { browse?: boolean; management?: boolean }) {
  const { toast, clearAll } = useToast();
  return <>
    <header key={browse ? "browse" : "dashboard"} data-app-header data-bottom={browse ? 64 : 112}>Navigation</header>
    <button onClick={() => toast({ title: "Impersonation ended", duration: 10000 })}>Notify</button>
    <button onClick={() => toast({ title: "Changes saved", duration: 10000 })}>Second notice</button>
    <button onClick={clearAll}>Clear messages</button>
    <PWAInstallBanner suppressed={management} />
  </>;
}

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal("innerHeight", 800);
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const bottom = Number(this.dataset.bottom || 0);
    const top = Number(this.dataset.top || 0);
    return { top, bottom, height: bottom - top, width: 390 } as DOMRect;
  });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Floating messages across page transitions", () => {
  it("keeps organization management clear while preserving the installation offer on other pages", () => {
    const view = render(<ToastProvider><Page management /></ToastProvider>);
    offerInstallation();
    expect(screen.queryByRole("region", { name: "Install Ekavyu" })).not.toBeInTheDocument();
    view.rerender(<ToastProvider><Page browse /></ToastProvider>);
    expect(screen.getByRole("region", { name: "Install Ekavyu" })).toBeInTheDocument();
  });
  it("keeps installation floating when routes replace navigation", () => {
    const { container, rerender } = render(<ToastProvider><Page /></ToastProvider>);
    offerInstallation();
    const banner = screen.getByRole("region", { name: "Install Ekavyu" });
    expect(container).toContainElement(banner);
    expect(banner).toHaveClass("fixed");
    rerender(<ToastProvider><Page browse /></ToastProvider>);
    expect(container).toContainElement(banner);
    expect(banner).toHaveClass("fixed");
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

  it("keeps top-center placement stable when routes replace different-height navigation", async () => {
    const view = render(<ToastProvider><Page /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Notify" }));
    const region = screen.getByRole("region", { name: "Notifications" });
    expect(region).toHaveClass("fixed", "left-1/2", "-translate-x-1/2");
    expect(region.style.getPropertyValue("--toast-visible-top")).toBe("16px");
    expect(region.style.getPropertyValue("--toast-header-offset")).toBe("124px");
    view.rerender(<ToastProvider><Page browse /></ToastProvider>);
    await waitFor(() => expect(region.style.getPropertyValue("--toast-header-offset")).toBe("76px"));
    expect(region.style.getPropertyValue("--toast-visible-top")).toBe("16px");
    expect(region).not.toHaveClass("right-4", "sm:right-6");
  });

  it("deduplicates repeated messages and reveals the previous notice after dismissal", async () => {
    render(<ToastProvider><Page /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Notify" }));
    fireEvent.click(screen.getByRole("button", { name: "Notify" }));
    expect(screen.queryByRole("button", { name: /Show .* more/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Second notice" }));
    fireEvent.click(screen.getByRole("button", { name: "Show 1 more" }));
    const saved = screen.getByRole("group", { name: "Changes saved" });
    fireEvent.click(within(saved).getByRole("button", { name: "Dismiss notification" }));
    await waitFor(() => expect(screen.queryByRole("group", { name: "Changes saved" })).not.toBeInTheDocument());
    expect(screen.getByRole("group", { name: "Impersonation ended" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Show .* more/ })).not.toBeInTheDocument();
  });

  it("tracks the mobile keyboard viewport and remembers explicit install dismissal", () => {
    const viewport = Object.assign(new EventTarget(), { offsetTop: 24, height: 360 });
    vi.stubGlobal("visualViewport", viewport);
    render(<ToastProvider><Page browse /></ToastProvider>);
    offerInstallation();
    const banner = screen.getByRole("region", { name: "Install Ekavyu" });
    expect(banner).toHaveClass("fixed");
    fireEvent.click(screen.getByRole("button", { name: "Notify" }));
    const region = screen.getByRole("region", { name: "Notifications" });
    expect(region.style.getPropertyValue("--toast-visible-top")).toBe("40px");
    expect(region.style.getPropertyValue("--toast-viewport-bottom")).toBe("384px");
    act(() => { viewport.offsetTop = 80; viewport.height = 280; viewport.dispatchEvent(new Event("resize")); });
    expect(region.style.getPropertyValue("--toast-visible-top")).toBe("96px");
    expect(region.style.getPropertyValue("--toast-viewport-bottom")).toBe("360px");
    fireEvent.click(screen.getByRole("button", { name: "Clear messages" }));
    expect(banner).toHaveClass("fixed");
    fireEvent.click(within(screen.getByRole("region", { name: "Install Ekavyu" })).getByRole("button", { name: "Dismiss banner" }));
    expect(screen.queryByRole("region", { name: "Install Ekavyu" })).not.toBeInTheDocument();
    expect(sessionStorage.getItem("pwa_install_dismissed")).toBe("1");
  });
});

function Notices({ notices }: { notices: ToastOptions[] }) {
  const { toast } = useToast();
  return notices.map((notice, index) => <button key={index} onClick={() => toast(notice)}>Notify {index + 1}</button>);
}

describe("Toast lifetime and message updates", () => {
  it("preserves distinct descriptions and variants even when their titles match", () => {
    render(<ToastProvider><Notices notices={[
      { title: "Update failed", description: "The clinic could not be saved.", variant: "error" },
      { title: "Update failed", description: "The profile could not be saved.", variant: "error" },
      { title: "Update failed", description: "The profile could not be saved.", variant: "warning" },
    ]} /></ToastProvider>);
    for (let index = 1; index <= 3; index++) fireEvent.click(screen.getByRole("button", { name: `Notify ${index}` }));
    fireEvent.click(screen.getByRole("button", { name: "Show 2 more" }));
    expect(screen.getAllByRole("group", { name: "Update failed" })).toHaveLength(3);
    expect(screen.getByText("The clinic could not be saved.")).toBeVisible();
  });

  it("uses explicit IDs to keep separate messages and update only the matching toast", () => {
    render(<ToastProvider><Notices notices={[
      { id: "clinic", title: "Saved" }, { id: "profile", title: "Saved" },
      { id: "profile", title: "Profile updated" },
    ]} /></ToastProvider>);
    for (let index = 1; index <= 3; index++) fireEvent.click(screen.getByRole("button", { name: `Notify ${index}` }));
    fireEvent.click(screen.getByRole("button", { name: "Show 1 more" }));
    expect(screen.getByRole("group", { name: "Saved" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Profile updated" })).toBeVisible();
  });

  it("restarts both the timer and progress when an existing message is refreshed", () => {
    vi.useFakeTimers();
    render(<ToastProvider><Notices notices={[{ id: "saved", title: "Saved", duration: 1000 }]} /></ToastProvider>);
    const notify = screen.getByRole("button", { name: "Notify 1" });
    fireEvent.click(notify);
    const progress = screen.getByRole("group", { name: "Saved" }).querySelector(".animate-toast-progress");
    act(() => vi.advanceTimersByTime(400));
    fireEvent.click(notify);
    expect(screen.getByRole("group", { name: "Saved" }).querySelector(".animate-toast-progress")).not.toBe(progress);
    act(() => vi.advanceTimersByTime(600));
    expect(screen.getByRole("button", { name: "Dismiss notification" })).toHaveAttribute("aria-disabled", "false");
    act(() => vi.advanceTimersByTime(400));
    expect(screen.getByRole("button", { name: "Dismiss notification" })).toHaveAttribute("aria-disabled", "true");
    act(() => vi.advanceTimersByTime(180));
    expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument();
  });

  it("pauses on hover and resumes with the remaining time", () => {
    vi.useFakeTimers();
    render(<ToastProvider><Notices notices={[{ title: "Saved", duration: 1000 }]} /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Notify 1" }));
    act(() => vi.advanceTimersByTime(400));
    const region = screen.getByRole("region", { name: "Notifications" });
    fireEvent.mouseEnter(region);
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByRole("button", { name: "Dismiss notification" })).toHaveAttribute("aria-disabled", "false");
    fireEvent.mouseLeave(region);
    act(() => vi.advanceTimersByTime(599));
    expect(screen.getByRole("button", { name: "Dismiss notification" })).toHaveAttribute("aria-disabled", "false");
    act(() => vi.advanceTimersByTime(1));
    act(() => vi.advanceTimersByTime(180));
    expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument();
  });

  it("cancels an old dismissal when the same toast is refreshed during its exit", () => {
    vi.useFakeTimers();
    render(<ToastProvider><Notices notices={[{ id: "saved", title: "Saved", duration: 1000 }]} /></ToastProvider>);
    const notify = screen.getByRole("button", { name: "Notify 1" });
    fireEvent.click(notify);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    act(() => vi.advanceTimersByTime(100));
    fireEvent.click(notify);
    act(() => vi.advanceTimersByTime(180));
    expect(screen.getByRole("button", { name: "Dismiss notification" })).toHaveAttribute("aria-disabled", "false");
  });

  it("keeps persistent messages until explicitly dismissed and honors zero duration", () => {
    vi.useFakeTimers();
    render(<ToastProvider><Notices notices={[
      { title: "Persistent", duration: Infinity }, { title: "Immediate", duration: 0 },
    ]} /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Notify 1" }));
    act(() => vi.advanceTimersByTime(60000));
    expect(screen.getByRole("group", { name: "Persistent" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Persistent" }).querySelector(".animate-toast-progress")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    act(() => vi.advanceTimersByTime(180));
    fireEvent.click(screen.getByRole("button", { name: "Notify 2" }));
    act(() => vi.advanceTimersByTime(0));
    act(() => vi.advanceTimersByTime(180));
    expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument();
  });

  it("restores keyboard focus after dismissal and resumes the previous message", () => {
    vi.useFakeTimers();
    render(<ToastProvider><Notices notices={[
      { title: "First", duration: 1000 }, { title: "Second", duration: 1000 },
    ]} /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Notify 1" }));
    const trigger = screen.getByRole("button", { name: "Notify 2" });
    fireEvent.click(trigger);
    act(() => trigger.focus());
    const dismiss = screen.getByRole("button", { name: "Dismiss notification" });
    act(() => dismiss.focus());
    act(() => vi.advanceTimersByTime(3000));
    expect(dismiss).toHaveAttribute("aria-disabled", "false");
    fireEvent.click(dismiss);
    act(() => vi.advanceTimersByTime(180));
    expect(trigger).toHaveFocus();
    expect(screen.getByRole("group", { name: "First" })).toBeVisible();
    act(() => vi.advanceTimersByTime(1000));
    act(() => vi.advanceTimersByTime(180));
    expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument();
  });
});
