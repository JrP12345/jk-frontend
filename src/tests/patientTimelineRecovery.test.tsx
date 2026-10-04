import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    fireEvent.click(screen.getByRole("button", { name: "Diagnostics" }));
    await waitFor(() => expect(fixture.get).toHaveBeenCalledWith("/patients/patient/timeline?category=lab", expect.objectContaining({ headers: {} })));
    expect(screen.getByRole("button", { name: "Diagnostics" })).toHaveAttribute("aria-pressed", "true");
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
