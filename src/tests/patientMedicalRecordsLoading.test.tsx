import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PatientMedicalRecords } from "@/components/ehr/PatientMedicalRecords";

const fixture = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get } }));
vi.mock("@/components/ehr/PatientHistoryAccess", () => ({ default: () => <button>Patient history approval controls</button> }));
vi.mock("@/components/clinical/UnifiedDocumentModal", () => ({ UnifiedDocumentModal: () => null }));
beforeEach(() => { HTMLElement.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { cleanup(); fixture.get.mockReset(); });

function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
}

describe("Medical record read sequence", () => {
  it("keeps approval controls available while waiting for both reads", async () => {
    const notes = deferred(), invoices = deferred();
    fixture.get.mockReturnValueOnce(notes.promise).mockReturnValueOnce(invoices.promise);
    render(<PatientMedicalRecords patientId="patient" />);
    expect(screen.getByRole("status", { name: "Loading medical records" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Patient history approval controls" })).toBeEnabled();
    expect(screen.queryByText("No consultation notes found for your profile.")).not.toBeInTheDocument();
    await act(async () => notes.resolve({ data: { data: [] } }));
    expect(screen.getByRole("status", { name: "Loading medical records" })).toBeInTheDocument();
    await act(async () => invoices.resolve({ data: { data: [] } }));
    expect(await screen.findByText("No consultation notes found for your profile.")).toBeInTheDocument();
  });

  it("retries failed reads with the same approved patient scope", async () => {
    fixture.get.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ data: { data: [] } });
    render(<PatientMedicalRecords patientId="patient" accessToken="approved-token" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load medical records");
    expect(screen.queryByText("No consultation notes found for your profile.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No consultation notes found for your profile.")).toBeInTheDocument();
    expect(fixture.get.mock.calls[2]).toEqual([
      "/patients/patient/clinical-notes/history?scope=all",
      expect.objectContaining({ headers: { "X-Patient-Record-Access": "approved-token" } }),
    ]);
  });

  it("keeps successful consultation notes when the receipt read fails", async () => {
    fixture.get.mockResolvedValueOnce({ data: { data: [{ id: "note", subjective: { chiefComplaint: "Recorded consultation" }, createdAt: "2026-10-07", status: "signed" }] } })
      .mockRejectedValueOnce(new Error("Receipt access denied"));
    render(<PatientMedicalRecords patientId="patient" accessToken={null} />);
    expect(await screen.findByText("Recorded consultation")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Billing receipts could not be loaded");
    fireEvent.click(screen.getByRole("tab", { name: "Invoices & Receipts" }));
    expect(screen.queryByText("No billing receipts found.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("ignores cancelled reads after changing patients", async () => {
    const previous = deferred();
    fixture.get.mockReturnValueOnce(previous.promise).mockResolvedValue({ data: { data: [] } });
    const { rerender } = render(<PatientMedicalRecords patientId="patient-a" accessToken={null} />);
    const signal = fixture.get.mock.calls[0][1].signal;
    rerender(<PatientMedicalRecords patientId="patient-b" accessToken={null} />);
    await waitFor(() => expect(signal.aborted).toBe(true));
    expect(await screen.findByText("No consultation notes found for your profile.")).toBeInTheDocument();
    await act(async () => previous.resolve({ data: { data: [{ id: "previous-note", subjective: { chiefComplaint: "Previous patient's consultation" } }] } }));
    expect(screen.queryByText("Previous patient's consultation")).not.toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading medical records" })).not.toBeInTheDocument();
  });
});
