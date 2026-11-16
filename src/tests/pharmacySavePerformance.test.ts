import { afterEach, expect, it, vi } from "vitest";
import { measurePharmacyStep, recordPharmacyServerTiming } from "@/lib/pharmacySavePerformance";

afterEach(() => vi.restoreAllMocks());

it("records bounded phase-only timings without altering successful or uncertain commands", async () => {
  const measure = vi.spyOn(performance, "measure").mockImplementation(() => ({} as PerformanceMeasure));
  const clear = vi.spyOn(performance, "clearMeasures").mockImplementation(() => {});
  const result = { invoice: "private-result" };
  expect(await measurePharmacyStep("save_request", async () => result)).toBe(result);
  const uncertain = Error("Response lost");
  await expect(measurePharmacyStep("save_request", async () => { throw uncertain; })).rejects.toBe(uncertain);
  expect(clear.mock.calls).toEqual([["pharmacy.save_request"], ["pharmacy.save_request"]]);
  for (const [name, timing] of measure.mock.calls) {
    expect(name).toBe("pharmacy.save_request");
    expect(Object.keys(timing!)).toEqual(["start", "end"]);
    expect(timing!.end).toBeGreaterThanOrEqual(timing!.start!);
  }
});

it("keeps diagnostics failures outside the financial outcome", async () => {
  vi.spyOn(performance, "clearMeasures").mockImplementation(() => { throw Error("Timing unavailable"); });
  expect(await measurePharmacyStep("intent_write", async () => 7)).toBe(7);
  const storageFailure = Error("Device storage unavailable");
  await expect(measurePharmacyStep("draft_write", async () => { throw storageFailure; })).rejects.toBe(storageFailure);
});

it("still hands off printing when the browser clock is unavailable", async () => {
  vi.spyOn(performance, "now").mockImplementation(() => { throw Error("Clock disabled"); });
  const print = vi.fn().mockResolvedValue(undefined);
  await measurePharmacyStep("print_handoff", print);
  expect(print).toHaveBeenCalledTimes(1);
});

it("records only allowlisted server phases, ignoring arbitrary names and invalid durations", () => {
  const measure = vi.spyOn(performance, "measure").mockImplementation(() => ({} as PerformanceMeasure));
  recordPharmacyServerTiming("counter_save;dur=125.4, counter_stock;dur=9, counter_private_id;dur=8, counter_payment;dur=-1, counter_finalize;dur=99999999");
  expect(measure.mock.calls.map(([name]) => name)).toEqual(["pharmacy.server.save", "pharmacy.server.stock"]);
  expect(measure.mock.calls[0][1]).toMatchObject({ duration: 125.4 });
  recordPharmacyServerTiming(undefined);
  recordPharmacyServerTiming("x".repeat(2001));
  expect(measure).toHaveBeenCalledTimes(2);
});

it("does not throw when server timing instrumentation is unavailable", () => {
  vi.spyOn(performance, "measure").mockImplementation(() => { throw Error("Disabled"); });
  expect(() => recordPharmacyServerTiming("counter_save;dur=125.4")).not.toThrow();
});

it("clears a previous request's server phases when the next response has no timing header", () => {
  const clear = vi.spyOn(performance, "clearMeasures").mockImplementation(() => {});
  recordPharmacyServerTiming(undefined);
  expect(clear).toHaveBeenCalledWith("pharmacy.server.payment");
  expect(clear).toHaveBeenCalledWith("pharmacy.server.save");
});
