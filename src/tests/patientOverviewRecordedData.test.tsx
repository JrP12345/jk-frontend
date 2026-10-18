import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PatientOverviewCards } from "@/components/clinical/PatientOverviewCards";
afterEach(cleanup);
const patient = { id: "patient", name: "Recorded patient", email: "", allergies: [], conditions: [] };
it("uses honest missing-data states instead of synthetic clinical charts, admissions or insurance assumptions", () => {
  render(<PatientOverviewCards patient={patient} />);
  expect(screen.getByText("No recorded vitals in the available visits.")).toBeInTheDocument();
  expect(screen.getByText("No insurance details recorded.")).toBeInTheDocument();
  expect(screen.queryByText("Longitudinal Vitals Trajectory")).not.toBeInTheDocument();
  expect(screen.queryByText("Active Admissions")).not.toBeInTheDocument();
  expect(document.body.textContent).not.toContain("Self-Pay Patient");
});
it("shows only recorded vital fields, preserving a partial blood pressure reading", () => {
  render(<PatientOverviewCards patient={patient} visits={[{ id: "visit", appointmentTime: "2026-10-18T10:00:00Z", vitals: { bpSystolic: 128, pulse: 76 } }]} />);
  expect(screen.getByText("128/— mmHg")).toBeInTheDocument();
  expect(screen.getByText("76 bpm")).toBeInTheDocument();
  expect(screen.queryByText(/98%/)).not.toBeInTheDocument();
});
it("does not reveal clinical information while the profile requires patient approval", () => {
  render(<PatientOverviewCards patient={{ ...patient, clinicalProfileRestricted: true, allergies: ["Restricted allergy"], conditions: ["Restricted condition"], medicalNotes: "Restricted notes", insurancePolicies: [{ providerName: "Restricted insurer", policyNumber: "policy" }] }} visits={[{ vitals: { pulse: 99 } }]} />);
  for (const value of ["Restricted allergy", "Restricted condition", "Restricted notes", "Restricted insurer", "99 bpm"]) expect(screen.queryByText(value)).not.toBeInTheDocument();
});
