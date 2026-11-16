import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { pharmacyConnectionFailure, usePharmacyReconnect } from "@/hooks/usePharmacyReconnect";
function Recovery({ enabled = true, retry }: { enabled?: boolean; retry: () => Promise<void> }) { usePharmacyReconnect(enabled, retry); return null; }
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it("deduplicates foreground events during a read and cancels all backoff after recovery", async () => {
  let finish!: () => void; const retry = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const view = render(<Recovery retry={retry} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); }); expect(retry).toHaveBeenCalledTimes(1);
  act(() => { window.dispatchEvent(new Event("online")); window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("online")); });
  expect(retry).toHaveBeenCalledTimes(1); await act(async () => finish());
  await act(async () => { await vi.advanceTimersByTimeAsync(9999); }); expect(retry).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); }); expect(retry).toHaveBeenCalledTimes(2);
  view.rerender(<Recovery retry={retry} enabled={false} />); await act(async () => finish());
  await act(async () => { await vi.advanceTimersByTimeAsync(120_000); }); expect(retry).toHaveBeenCalledTimes(2);
});
it("uses the latest cart callback on foreground retry and tolerates a failed read", async () => {
  const first = vi.fn(async () => {}), second = vi.fn(async () => { throw Error("Network unavailable"); });
  const view = render(<Recovery retry={first} />); view.rerender(<Recovery retry={second} />);
  await act(async () => window.dispatchEvent(new Event("online")));
  expect(first).not.toHaveBeenCalled(); expect(second).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); }); expect(second).toHaveBeenCalledTimes(2);
});
it("separates server connectivity from stock conflicts and local validation", () => {
  expect(pharmacyConnectionFailure({ response: { status: 409 } })).toBe(false);
  expect(pharmacyConnectionFailure(Error("Enter whole pack quantities"))).toBe(false);
  expect(pharmacyConnectionFailure({ code: "ERR_NETWORK" })).toBe(true);
  expect(pharmacyConnectionFailure({ response: { status: 503 } })).toBe(true);
  expect(pharmacyConnectionFailure({ name: "AbortError", message: "Network unavailable" })).toBe(false);
});
