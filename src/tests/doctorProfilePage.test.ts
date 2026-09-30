import { afterEach, describe, expect, it, vi } from "vitest";
import { getDoctor } from "../app/doctor/[id]/page";

afterEach(() => vi.unstubAllGlobals());

describe("public doctor profile", () => {
  it("builds the selected doctor's page from the public clinic listing when the profile API is unavailable", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {
        id: "clinic-1", name: "Tamboli Clinic", city: "Valsad", address: "Madhav Complex",
        currency: "INR", onlineBookingAvailable: true,
        doctors: [{ id: "doctor-1", name: "Rajesh Tamboli", specialization: "General Physician / Consultant", fees: 300, feeType: "fixed" }],
      } }) });
    vi.stubGlobal("fetch", fetchMock);

    const doctor = await getDoctor("doctor-1", "clinic-1");
    expect(doctor).toMatchObject({
      id: "doctor-1", name: "Dr. Rajesh Tamboli", specialization: "General Physician / Consultant",
      locations: [{ id: "clinic-1", name: "Tamboli Clinic", fees: 300, onlineBookingAvailable: true }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not show a different doctor from the same clinic", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {
        id: "clinic-1", doctors: [{ id: "doctor-2", name: "Someone Else" }],
      } }) }));
    expect(await getDoctor("doctor-1", "clinic-1")).toBeNull();
  });
});
