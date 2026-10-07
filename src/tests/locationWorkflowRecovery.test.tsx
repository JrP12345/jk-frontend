import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appointmentBookingLabel, appointmentPaymentLabel } from "@/lib/appointmentPresentation";
import { confirmLeavingClinicalDraft, useUnsavedClinicalChanges } from "@/hooks/useUnsavedClinicalChanges";
import { EncounterProvider, useEncounterContext } from "@/providers/EncounterProvider";
import { EncounterEventBus, EncounterEvents } from "@/events/EncounterEventBus";

const orders = vi.hoisted(() => vi.fn());
vi.mock("@/services/orders.service", () => ({ OrdersService: { getOrders: orders } }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); EncounterEventBus.clear(); orders.mockReset(); });

describe("Clinic workflow recovery", () => {
  it("shows a payment as settled only when the server says paid", () => {
    expect(appointmentPaymentLabel("paid")).toBe("Paid");
    expect(appointmentPaymentLabel("pending")).toBe("Payment pending");
    expect(appointmentPaymentLabel(undefined)).toBe("Payment pending");
    expect(appointmentPaymentLabel("pay_at_location")).toBe("Payment due at reception");
    expect(appointmentBookingLabel("pending_payment")).toBe("Booking awaiting payment");
    expect(appointmentBookingLabel("pending")).toBe("Booking pending confirmation");
  });

  it("warns before reload and cancels link navigation until the draft is saved", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { rerender, unmount } = renderHook(({ dirty }) => useUnsavedClinicalChanges(dirty), { initialProps: { dirty: true } });
    const reload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(reload);
    expect(reload.defaultPrevented).toBe(true);
    const link = document.createElement("a"); link.href = "/dashboard/appointments"; document.body.append(link);
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(confirmLeavingClinicalDraft()).toBe(false);
    rerender({ dirty: false });
    expect(confirmLeavingClinicalDraft()).toBe(true);
    unmount(); link.remove();
  });

  it("refreshes diagnostic orders from other sessions and retains loaded orders after a failed refresh", async () => {
    vi.useFakeTimers();
    orders.mockResolvedValueOnce([{ id: "lab", status: "ordered" }])
      .mockResolvedValueOnce([{ id: "lab", status: "processing" }])
      .mockRejectedValueOnce(new Error("offline"));
    function Consumer() { const context = useEncounterContext(); return <div><p>{context.orders[0]?.status}</p><p>{context.error}</p></div>; }
    await act(async () => { render(<EncounterProvider encounterId="visit" patientId="patient" locationId="clinic" doctorId="doctor"><Consumer /></EncounterProvider>); });
    expect(screen.getByText("ordered")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(screen.getByText("processing")).toBeInTheDocument();
    await act(async () => { EncounterEventBus.emit(EncounterEvents.ORDER_COLLECTED, { encounterId: "visit" }); });
    expect(screen.getByText("processing")).toBeInTheDocument();
    expect(screen.getByText("Unable to load diagnostic orders. Please retry.")).toBeInTheDocument();
  });
});
