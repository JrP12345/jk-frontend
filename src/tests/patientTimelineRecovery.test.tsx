import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PatientTimeline } from "@/components/ehr/PatientTimeline";

const fixture = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get, post: fixture.post } }));
vi.mock("@/components/ehr/PatientHistoryAccess", () => ({ default: () => <p>Patient history approval controls</p> }));
afterEach(() => { cleanup(); fixture.get.mockReset(); fixture.post.mockReset(); });

const event = {
  id: "event", title: "Original consultation", summary: "Original recorded summary", occurredAt: "2026-09-25T09:00:00Z",
  patientId: "patient", actor: { name: "Care team" }, sourceRef: { link: "/dashboard/consultations/encounter" },
  displayMetadata: { statusLabel: "Completed", icon: "stethoscope", badgeColor: "emerald" },
  clinicalMetadata: { diagnoses: [] }, clinicalConcepts: {},
};
describe("Shared patient history recovery", () => {
  it("keeps history controls mounted while changing from populated to loading and empty results", async () => {
    let finish!: (value: unknown) => void;
    fixture.get.mockResolvedValueOnce({ data: { data: { events: [event] } } })
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<PatientTimeline patientId="patient" accessToken="approved" />);
    await screen.findByText(event.title);
    const category = screen.getByRole("button", { name: /^Diagnostics/ });
    const search = screen.getByRole("textbox", { name: "Search patient history" });
    fireEvent.click(category);
    expect(await screen.findByRole("status", { name: "Loading patient health records timeline" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Diagnostics/ })).toBe(category);
    expect(screen.getByRole("textbox", { name: "Search patient history" })).toBe(search);
    expect(screen.queryByText(event.title)).not.toBeInTheDocument();
    await act(async () => { finish({ data: { data: { events: [] } } }); });
    expect(await screen.findByText("No clinical timeline events found matching filters.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Diagnostics/ })).toBe(category);
  });

  it("ignores a cancelled patient's late history response", async () => {
    let finish!: (value: unknown) => void;
    fixture.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockResolvedValue({ data: { data: { events: [] } } });
    const { rerender } = render(<PatientTimeline patientId="previous" accessToken={null} />);
    const signal = fixture.get.mock.calls[0][1].signal;
    rerender(<PatientTimeline patientId="current" accessToken={null} />);
    await screen.findByText("No clinical timeline events found matching filters.");
    expect(signal.aborted).toBe(true);
    await act(async () => { finish({ data: { data: { events: [event] } } }); });
    expect(screen.queryByText(event.title)).not.toBeInTheDocument();
  });

  it("retries the profile-owned scope and preserves its approval header", async () => {
    fixture.get.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ data: { data: { events: [], hasMore: false } } });
    render(<PatientTimeline patientId="patient" accessToken="patient-approved-token" />);
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(fixture.get.mock.calls[1][0]).toBe("/patients/patient/timeline?scope=all");
    expect(fixture.get.mock.calls[1][1].headers).toEqual({ "X-Patient-Record-Access": "patient-approved-token" });
    expect(screen.queryByText("Patient history approval controls")).not.toBeInTheDocument();
  });
  it("keeps embedded/direct consumers organization-scoped and exposes selected category", async () => {
    fixture.get.mockResolvedValue({ data: { data: { events: [] } } });
    render(<PatientTimeline patientId="patient" events={[]} />);
    expect(screen.getByText("Patient history approval controls")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Diagnostics/ }));
    await waitFor(() => expect(fixture.get).toHaveBeenCalledWith("/patients/patient/timeline?category=lab", expect.objectContaining({ headers: {} })));
    expect(screen.getByRole("button", { name: /^Diagnostics/ })).toHaveAttribute("aria-pressed", "true");
  });
  it("retains the original record and reports failed explanation requests accurately", async () => {
    fixture.get.mockResolvedValue({ data: { data: { events: [event] } } });
    fixture.post.mockRejectedValue(new Error("offline"));
    render(<PatientTimeline patientId="patient" accessToken={null} />);
    fireEvent.click(await screen.findByRole("button", { name: "AI Explainer" }));
    expect(await screen.findByText(/The explanation could not be loaded/)).toBeInTheDocument();
    expect(screen.getAllByText(event.summary)).toHaveLength(2);
    expect(screen.queryByText("Grounded Real AI Analysis")).not.toBeInTheDocument();
  });
});
