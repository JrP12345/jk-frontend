import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "@/components/ui";
import { ClinicalDocumentGeneratorModal } from "@/components/clinical/ClinicalDocumentGeneratorModal";

describe("official clinical document generator", () => {
  it("does not prefill fictional clinical findings or issue a document without real identity", () => {
    const onDocumentGenerated = vi.fn();
    render(
      <ToastProvider>
        <ClinicalDocumentGeneratorModal open onClose={vi.fn()} onDocumentGenerated={onDocumentGenerated} />
      </ToastProvider>,
    );
    expect(screen.queryByDisplayValue(/Acute Coronary Syndrome/)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(/DMC-48291/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Patient Name" }), { target: { value: "Real Patient" } });
    fireEvent.click(screen.getByRole("button", { name: /Generate & Print Certificate/ }));
    expect(onDocumentGenerated).not.toHaveBeenCalled();
    expect(screen.getByText("Document details required")).toBeInTheDocument();
  });

  it("generates a referral when real identity and clinical details are supplied", () => {
    const onDocumentGenerated = vi.fn();
    render(<ToastProvider><ClinicalDocumentGeneratorModal open onClose={vi.fn()}
      locationName="Recorded Clinic" defaultDoctorName="Recorded Doctor" defaultDoctorRegistrationNumber="REG-123"
      onDocumentGenerated={onDocumentGenerated} /></ToastProvider>);
    fireEvent.change(screen.getByRole("textbox", { name: "Patient Name" }), { target: { value: "Recorded Patient" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Referred To (Doctor / Hospital / Center)" }), { target: { value: "Receiving Hospital" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Provisional / Working Diagnosis" }), { target: { value: "Recorded diagnosis" } });
    fireEvent.change(screen.getByPlaceholderText("Describe patient symptoms, duration, examination findings..."), { target: { value: "Recorded findings" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Reason & Indication for Referral" }), { target: { value: "Specialist assessment" } });
    fireEvent.click(screen.getByRole("button", { name: /Generate & Print Certificate/ }));
    expect(onDocumentGenerated).toHaveBeenCalledWith(expect.objectContaining({
      locationName: "Recorded Clinic", doctorName: "Recorded Doctor", doctorRegistrationNumber: "REG-123", patientName: "Recorded Patient",
    }));
  });
});
