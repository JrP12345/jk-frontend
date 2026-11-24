import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { usePharmacyCounterAvailability } from "@/hooks/usePharmacyCounterAvailability";
import { PharmacyCounterAvailabilityNotice } from "@/components/pharmacy/PharmacyCounterAvailabilityNotice";
import { validateCounterAvailability, type CounterAvailability } from "@/lib/pharmacyCounterAvailability";
import { ToastProvider } from "@/components/ui";
const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
const locationId = "b".repeat(24), checkedAt = new Date().toISOString();
const status = (mode: CounterAvailability["mode"] = "cloud"): CounterAvailability => ({ locationId, mode, checkedAt, offline: mode === "cloud" ? null : { deviceName: "Main pharmacy PC", currentOperator: false, validUntil: checkedAt } });
const response = (data: unknown) => ({ data: { data } });
function Counter({ branch = locationId }: { branch?: string }) {
  const state = usePharmacyCounterAvailability(branch);
  return <ToastProvider><PharmacyCounterAvailabilityNotice {...state} onRefresh={() => { void state.refresh(); }} /><input aria-label="Prepare a cart" /><button disabled={state.blocked}>Save new bill</button><button onClick={() => { void state.refresh(); }}>Manual check</button></ToastProvider>;
}
beforeEach(() => { api.get.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
it("keeps preparation available, blocks final issuance on a held branch and resumes after actual release", async () => {
  api.get.mockResolvedValueOnce(response(status("offline_active"))).mockResolvedValueOnce(response(status())); render(<Counter />);
  await screen.findByText("Branch reserved for the designated offline PC"); expect(screen.getByRole("button", { name: "Save new bill" })).toBeDisabled(); expect(screen.getByLabelText("Prepare a cart")).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Refresh counter availability" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save new bill" })).toBeEnabled()); expect(screen.queryByText("Branch reserved for the designated offline PC")).not.toBeInTheDocument();
});
it("preserves a known hold on a failed read or malformed release and explains expired authority", async () => {
  api.get.mockResolvedValueOnce(response(status("offline_reconciliation"))).mockRejectedValueOnce(Error("Network lost")).mockResolvedValueOnce(response({ ...status(), offline: {} })); render(<Counter />);
  await screen.findByText(/Expiry does not release stock/); fireEvent.click(screen.getByRole("button", { name: "Refresh counter availability" }));
  await screen.findByText(/Branch availability could not refresh/); expect(screen.getByRole("button", { name: "Save new bill" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Refresh counter availability" })); await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3));
  expect(screen.getByRole("button", { name: "Save new bill" })).toBeDisabled();
});
it("coalesces concurrent focus checks, refreshes on return and discards another branch's late response", async () => {
  let resolve!: (value: unknown) => void; api.get.mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValueOnce(response({ ...status(), locationId: "c".repeat(24) }));
  const view = render(<Counter />); fireEvent.focus(window); fireEvent(window, new Event("online")); expect(api.get).toHaveBeenCalledOnce();
  view.rerender(<Counter branch={"c".repeat(24)} />); await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  await act(async () => { resolve(response(status("offline_active"))); });
  expect(screen.queryByText("Branch reserved for the designated offline PC")).not.toBeInTheDocument(); expect(screen.getByRole("button", { name: "Save new bill" })).toBeEnabled();
});
it("does not poll a hidden page or leave a polling timer after unmount", async () => {
  vi.useFakeTimers(); api.get.mockResolvedValue(response(status())); const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden"), view = render(<Counter />);
  await act(async () => {}); expect(api.get).toHaveBeenCalledOnce();
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); }); expect(api.get).toHaveBeenCalledOnce();
  visibility.mockReturnValue("visible"); await act(async () => { document.dispatchEvent(new Event("visibilitychange")); }); expect(api.get).toHaveBeenCalledTimes(2);
  view.unmount(); await act(async () => { await vi.advanceTimersByTimeAsync(120_000); }); expect(api.get).toHaveBeenCalledTimes(2);
});
it.each([{ mode: "unlocked" }, { locationId: "other" }, { checkedAt: "yesterday" }, { offline: { deviceName: "PC" } }, { offline: { deviceName: "PC\u0000", currentOperator: true, validUntil: checkedAt } }])("rejects unverified availability payload %j", change => {
  expect(() => validateCounterAvailability({ ...status("offline_active"), ...change }, locationId)).toThrow(/could not be confirmed/);
});
