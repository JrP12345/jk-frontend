import { afterEach, expect, it, vi } from "vitest";
import { getDoctor } from "../app/doctor/[slug]/page";
afterEach(() => vi.unstubAllGlobals());
it("loads the current doctor profile representation", async () => {
  const profile = { id: "private-doctor", slug: "asha", name: "Asha", specialization: "Medicine", locations: [{ id: "private-location", slug: "care", name: "Care", fees: 300 }] };
  const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: profile }) });
  vi.stubGlobal("fetch", request);
  expect(await getDoctor("asha", "care")).toMatchObject({ ...profile, name: "Dr. Asha" });
  expect(request).toHaveBeenCalledTimes(1);
});
it("returns an unavailable profile when the profile API fails", async () => {
  const request = vi.fn().mockResolvedValue({ ok: false });
  vi.stubGlobal("fetch", request);
  expect(await getDoctor("asha", "care")).toBeNull();
  expect(request).toHaveBeenCalledTimes(1);
});
