import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Tabs from "@/components/ui/Tabs";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import Toggle from "@/components/ui/Toggle";
import Security from "@/app/(dashboard)/dashboard/security/page";
import { vibrateFeedback } from "@/lib/haptics";

const apiGet = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ default: { get: apiGet, post: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));
vi.mock("@/store/authStore", () => ({ useAuthStore: () => ({ user: { id: "owner", role: "admin" } }) }));
vi.mock("@simplewebauthn/browser", () => ({ browserSupportsWebAuthn: () => false, startRegistration: vi.fn() }));

let fakeNow = 1_800_000_000_000;
let vibrateMock: ReturnType<typeof vi.fn>;

function pointerClick(target: Element, pointerType: string) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  fireEvent(target, event);
}

beforeEach(() => {
  fakeNow += 10_000;
  vi.spyOn(Date, "now").mockImplementation(() => fakeNow);
  vibrateMock = vi.fn(() => true);
  Object.defineProperty(navigator, "vibrate", { configurable: true, writable: true, value: vibrateMock });
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  HTMLElement.prototype.scrollIntoView = vi.fn();
  localStorage.clear();
  apiGet.mockResolvedValue({ data: { data: [] } });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("Haptic feedback priority and cooldown", () => {
  it("allows higher-priority error and success feedback immediately after selection without being swallowed", () => {
    expect(vibrateFeedback("selection")).toBe(true);
    expect(vibrateMock).toHaveBeenLastCalledWith(16);

    fakeNow += 20;
    expect(vibrateFeedback("error")).toBe(true);
    expect(vibrateMock).toHaveBeenLastCalledWith([45, 50, 65]);

    fakeNow += 40;
    expect(vibrateFeedback("selection")).toBe(false);
    expect(vibrateMock).toHaveBeenCalledTimes(2);

    fakeNow += 160;
    expect(vibrateFeedback("selection")).toBe(true);
    expect(vibrateMock).toHaveBeenCalledTimes(3);
  });

  it("coalesces duplicate selection taps within cooldown and skips recording rejected vibrations", () => {
    vibrateMock.mockReturnValueOnce(false).mockReturnValue(true);
    expect(vibrateFeedback("selection")).toBe(false);
    expect(vibrateFeedback("selection")).toBe(true);
    fakeNow += 50;
    expect(vibrateFeedback("selection")).toBe(false);
    expect(vibrateMock).toHaveBeenCalledTimes(2);
  });

  it("stops vibrating when ekavyu_haptics is off or reduced motion is preferred", () => {
    localStorage.setItem("ekavyu_haptics", "off");
    expect(vibrateFeedback("alert")).toBe(false);
    expect(vibrateMock).not.toHaveBeenCalled();

    localStorage.clear();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    expect(vibrateFeedback("success")).toBe(false);
    expect(vibrateMock).not.toHaveBeenCalled();
  });
});

function ActionToastHarness() {
  const { toast } = useToast();
  return (
    <>
      <Button onClick={() => toast({ title: "Missing required item", variant: "error" })}>
        Trigger error toast
      </Button>
      <Button onClick={() => toast({ title: "Check batch expiry", variant: "warning" })}>
        Trigger warning toast
      </Button>
    </>
  );
}

describe("Shared UI haptic controls", () => {
  it("avoids double-buzzing on synchronous toast actions and ignores desktop mouse clicks", () => {
    render(
      <ToastProvider>
        <ActionToastHarness />
        <Button onClick={vi.fn()}>Save draft</Button>
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Trigger error toast" }));
    expect(vibrateMock).toHaveBeenCalledTimes(1);
    expect(vibrateMock).toHaveBeenCalledWith([45, 50, 65]);

    fakeNow += 200;
    fireEvent.click(screen.getByRole("button", { name: "Trigger warning toast" }));
    expect(vibrateMock).toHaveBeenCalledTimes(2);
    expect(vibrateMock).toHaveBeenLastCalledWith([30, 50, 30]);

    fakeNow += 200;
    pointerClick(screen.getByRole("button", { name: "Save draft" }), "mouse");
    expect(vibrateMock).toHaveBeenCalledTimes(2);

    pointerClick(screen.getByRole("button", { name: "Save draft" }), "touch");
    expect(vibrateMock).toHaveBeenCalledTimes(3);
    expect(vibrateMock).toHaveBeenLastCalledWith(16);
  });

  it("triggers selection haptics on Toggle, inactive Tab switches, and Select option picks", async () => {
    const onToggle = vi.fn();
    const onTab = vi.fn();
    const onSelect = vi.fn();
    render(
      <>
        <Toggle label="Auto-print" onChange={onToggle} />
        <Tabs
          tabs={[
            { id: "cart", label: "Cart" },
            { id: "history", label: "History" },
          ]}
          defaultTab="cart"
          onChange={onTab}
        />
        <Select
          label="Payment mode"
          options={[
            { value: "cash", label: "Cash" },
            { value: "upi", label: "UPI" },
          ]}
          value="cash"
          onChange={onSelect}
        />
      </>,
    );

    fireEvent.click(screen.getByRole("switch", { name: "Auto-print" }));
    expect(onToggle).toHaveBeenCalledWith(true);
    expect(vibrateMock).toHaveBeenCalledTimes(1);
    expect(vibrateMock).toHaveBeenLastCalledWith(16);

    fakeNow += 200;
    fireEvent.click(screen.getByRole("tab", { name: "Cart" }));
    expect(vibrateMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    expect(onTab).toHaveBeenCalledWith("history");
    expect(vibrateMock).toHaveBeenCalledTimes(2);

    fakeNow += 200;
    fireEvent.click(screen.getByRole("combobox", { name: "Payment mode" }));
    fireEvent.click(await screen.findByRole("option", { name: "UPI" }));
    expect(onSelect).toHaveBeenCalledWith({ target: { name: undefined, value: "upi" } });
    expect(vibrateMock).toHaveBeenCalledTimes(3);
  });
});

describe("Security vibration setting and browser status", () => {
  it("tests feedback when enabling vibration and suppresses when turning it off", async () => {
    render(<ToastProvider><Security /></ToastProvider>);
    const toggle = await screen.findByRole("switch", { name: "Vibration feedback" });
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith("/auth/passkeys"));

    fireEvent.click(toggle);
    expect(localStorage.getItem("ekavyu_haptics")).toBe("off");
    expect(vibrateMock).not.toHaveBeenCalled();

    fakeNow += 200;
    fireEvent.click(toggle);
    expect(localStorage.getItem("ekavyu_haptics")).toBe("on");
    expect(vibrateMock).toHaveBeenCalledExactlyOnceWith([24, 45, 32]);
  });

  it("explains when browser vibration is unsupported or paused by reduced motion", async () => {
    Object.defineProperty(navigator, "vibrate", { configurable: true, writable: true, value: undefined });
    render(<ToastProvider><Security /></ToastProvider>);
    expect(await screen.findByText(/unavailable in this browser or device/i)).toBeInTheDocument();

    cleanup();
    Object.defineProperty(navigator, "vibrate", { configurable: true, writable: true, value: vibrateMock });
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    render(<ToastProvider><Security /></ToastProvider>);
    expect(await screen.findByText(/paused while Reduced Motion is turned on/i)).toBeInTheDocument();
  });
});
