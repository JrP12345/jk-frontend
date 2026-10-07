import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { ThemeProvider } from "@/components/ui/ThemeProvider";


import Modal from "@/components/ui/Modal";
import { ToastProvider } from "@/components/ui/Toast";
import BrowseDetailClient, { type LocationDetail } from "@/app/browse/[slug]/BrowseDetailClient";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import { useAuthStore } from "@/store/authStore";
import { clearRecentTracker } from "@/store/trackerStore";
import { forceResetScrollLock } from "@/lib/scrollLock";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/browse", useSearchParams: () => new URLSearchParams() }));

class TouchPointer extends MouseEvent {
  pointerId: number; pointerType: string; isPrimary: boolean;
  constructor(type: string, options: MouseEventInit & { pointerId?: number; pointerType?: string; isPrimary?: boolean } = {}) {
    super(type, options);
    this.pointerId = options.pointerId ?? 1;
    this.pointerType = options.pointerType ?? "touch";
    this.isPrimary = options.isPrimary ?? true;
  }
}
beforeEach(() => {
  vi.stubGlobal("PointerEvent", TouchPointer);
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  localStorage.clear(); sessionStorage.clear(); clearRecentTracker();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("data-mode");
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); forceResetScrollLock(); });

function swipe(target: Element, dx: number, dy = 0, options: { pointerType?: string; startX?: number } = {}) {
  const startX = options.startX ?? 180;
  const props = { clientX: startX, clientY: 160, pointerType: options.pointerType || "touch", pointerId: 1, isPrimary: true };
  fireEvent.pointerDown(target, props);
  fireEvent.pointerMove(target, { ...props, clientX: startX + dx, clientY: 160 + dy });
  fireEvent.pointerUp(target, { ...props, clientX: startX + dx, clientY: 160 + dy });
}

describe("Appearance preferences", () => {


  it("keeps appearance and sign-in directly available to guests on Browse", () => {
    render(<ThemeProvider><MarketplaceNavbar /></ThemeProvider>);
    fireEvent.click(within(screen.getByRole("group", { name: "Mobile appearance" })).getByRole("button", { name: "Switch to dark mode" }));
    expect(document.documentElement).toHaveAttribute("data-mode", "dark");
    expect(screen.getByText("Sign in").closest("a")).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button", { name: "Toggle Menu" })).not.toBeInTheDocument();
  });
  it("uses the clinic identity for a linked booking page", () => {
    render(<ThemeProvider><MarketplaceNavbar brand={{ name: "Surat Clinic", logoUrl: "/clinic-logo.png", href: "/browse/clinic-1" }} /></ThemeProvider>);
    const identity = screen.getByRole("link", { name: /Surat Clinic.*Appointments powered by Ekavyu/ });
    expect(identity).toHaveAttribute("href", "/browse/clinic-1");
    expect(identity.querySelector("img")).toHaveAttribute("src", "/clinic-logo.png");
  });
  it("keeps the account menu compact and supports swipe-up or Escape to close it", () => {
    useAuthStore.setState({ user: { id: "patient", name: "Patient", email: "patient@test.com", role: "patient", permissions: [] }, isAuthenticated: true, isLoading: false });
    render(<ThemeProvider><MarketplaceNavbar /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Toggle Menu" }));
    const menu = screen.getByRole("dialog", { name: "Navigation" });
    expect(menu).toHaveClass("max-w-sm");
    expect(within(menu).queryByRole("link", { name: "Browse Locations" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("button", { name: /appearance/i })).not.toBeInTheDocument();
    expect(menu).toBeInTheDocument();
    expect(document.body.style.position).toBe("fixed");
    swipe(within(menu).getByText("Account"), 0, -100);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Mobile appearance" })).getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Toggle Menu" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

function Surface({ onSwipe, enabled = true }: { onSwipe: (direction: string) => void; enabled?: boolean }) {
  const gesture = useSwipeGesture({ axis: "x", direction: "left", enabled, onSwipe });
  return <div data-testid="surface" {...gesture.handlers}><p>Swipe here</p><button>Close</button><input aria-label="Notes" /><div data-testid="scroll-strip" style={{ overflowX: "auto" }}>Scrollable dates</div><output>{gesture.offset}</output></div>;
}
describe("Gesture ownership", () => {
  it("recognizes the intended swipe once and lets short drags snap back", () => {
    const close = vi.fn(); render(<Surface onSwipe={close} />);
    swipe(screen.getByText("Swipe here"), -40);
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("0");
    swipe(screen.getByText("Swipe here"), -100);
    expect(close).toHaveBeenCalledExactlyOnceWith("left");
  });
  it("does not treat vertical scrolling, the wrong direction, or mouse input as dismissal", () => {
    const close = vi.fn(); render(<Surface onSwipe={close} />);
    swipe(screen.getByText("Swipe here"), -20, 120);
    swipe(screen.getByText("Swipe here"), 100);
    swipe(screen.getByText("Swipe here"), -100, 0, { pointerType: "mouse" });
    expect(close).not.toHaveBeenCalled();
  });
  it("respects buttons, forms, native horizontal scrolling, and browser edge-back gestures", () => {
    const close = vi.fn(); render(<Surface onSwipe={close} />);
    swipe(screen.getByRole("button", { name: "Close" }), -100);
    swipe(screen.getByRole("textbox", { name: "Notes" }), -100);
    const strip = screen.getByTestId("scroll-strip");
    Object.defineProperties(strip, { scrollWidth: { value: 600 }, clientWidth: { value: 200 } });
    swipe(strip, -100);
    swipe(screen.getByText("Swipe here"), 100, 0, { startX: 5 });
    expect(close).not.toHaveBeenCalled();
  });
  it("cancels interrupted and multi-touch gestures without dismissal", () => {
    const close = vi.fn(); render(<Surface onSwipe={close} />);
    const surface = screen.getByTestId("surface");
    const props = { clientX: 180, clientY: 160, pointerType: "touch", pointerId: 1, isPrimary: true };
    fireEvent.pointerDown(surface, props);
    fireEvent.pointerMove(surface, { ...props, clientX: 60 });
    fireEvent.pointerCancel(surface, props);
    fireEvent.pointerUp(surface, { ...props, clientX: 60 });
    fireEvent.pointerDown(surface, props);
    fireEvent.pointerDown(surface, { ...props, pointerId: 2, isPrimary: false });
    fireEvent.pointerUp(surface, { ...props, clientX: 60 });
    expect(close).not.toHaveBeenCalled();
  });
  it("ignores gestures while disabled or outside the mobile breakpoint", () => {
    const close = vi.fn(); const view = render(<Surface onSwipe={close} enabled={false} />);
    swipe(screen.getByText("Swipe here"), -100);
    view.rerender(<Surface onSwipe={close} />);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    swipe(screen.getByText("Swipe here"), -100);
    expect(close).not.toHaveBeenCalled();
  });
  it("suppresses the click following a drag without blocking keyboard activation", () => {
    const close = vi.fn(); render(<Surface onSwipe={close} />);
    const surface = screen.getByTestId("surface");
    swipe(screen.getByText("Swipe here"), -40);
    expect(fireEvent.click(surface, { detail: 1 })).toBe(false);
    expect(fireEvent.click(surface, { detail: 0 })).toBe(true);
  });
});

describe("Booking sheet drag", () => {
  it("only dismisses from its handle, blocks dismissal while confirming, and keeps keyboard close available", async () => {
    const close = vi.fn();
    const view = render(<Modal open presentation="sheet" title="Book visit" onClose={close}>Patient details</Modal>);
    const dialog = await screen.findByRole("dialog", { name: "Book visit" });
    swipe(within(dialog).getByText("Patient details"), 0, 120);
    expect(close).not.toHaveBeenCalled();
    const handle = dialog.querySelector('[aria-hidden="true"]')!;
    swipe(handle, 0, 120);
    expect(close).toHaveBeenCalledOnce();
    view.rerender(<Modal open presentation="sheet" busy title="Book visit" onClose={close}>Patient details</Modal>);
    swipe(handle, 0, 120);
    expect(close).toHaveBeenCalledOnce();
    view.rerender(<Modal open presentation="sheet" title="Book visit" onClose={close}>Patient details</Modal>);
    act(() => fireEvent.keyDown(document, { key: "Escape" }));
    expect(close).toHaveBeenCalledTimes(2);
  });
});

describe("Gallery navigation", () => {
  it("swipes through photos without closing the gallery and retains arrow and keyboard controls", () => {
    const location: LocationDetail = { id: "clinic", slug: "clinic", name: "Test Clinic", city: "Surat", address: "Test street", phone: "", email: "", description: "Care", image_url: "", timings: "09:00-17:00", doctors: [], images: ["/first.jpg", "/second.jpg"] };
    render(<ThemeProvider><ToastProvider><BrowseDetailClient slug="clinic" initialLocation={location} /></ToastProvider></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Browse Campus Gallery" }));
    const gallery = screen.getByRole("dialog", { name: "Photo gallery" });
    swipe(within(gallery).getByRole("img", { name: "Facility showcase 1" }), -100);
    const second = within(gallery).getByRole("img", { name: "Facility showcase 2" });
    expect(second).toHaveAttribute("src", "/second.jpg");
    fireEvent.click(second, { detail: 1 });
    expect(gallery).toBeInTheDocument();
    fireEvent.click(within(gallery).getByRole("button", { name: "Previous photo" }));
    expect(within(gallery).getByRole("img", { name: "Facility showcase 1" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(within(gallery).getByRole("img", { name: "Facility showcase 2" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
