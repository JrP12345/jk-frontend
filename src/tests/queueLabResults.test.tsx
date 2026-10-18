import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import QueueLabResults from "@/components/queue/QueueLabResults";
import { InCabinInvestigationViewerModal } from "@/components/clinical/InCabinInvestigationViewerModal";
import { ToastProvider } from "@/components/ui/Toast";

vi.mock("@/lib/api", () => ({ default: { get: vi.fn().mockResolvedValue({ data: { data: { tests: {} } } }) } }));

afterEach(cleanup);

it("summarizes pending lab work without repeating placeholder values", () => {
  const open = vi.fn();
  render(<QueueLabResults onOpen={open} results={[
    { testName: "Complete blood count", value: "Pending Sample / Analysis" },
    { testName: "Serum creatinine", value: "Pending Sample / Analysis" },
  ]} />);
  expect(screen.getByText("2 lab tests")).toBeInTheDocument();
  expect(screen.getByText("Results pending")).toBeInTheDocument();
  expect(screen.getByText(/Complete blood count · Serum creatinine/)).toBeInTheDocument();
  expect(screen.queryByText("Pending Sample / Analysis")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View reports" }));
  expect(open).toHaveBeenCalledTimes(1);
});

it("keeps abnormal and mixed pending readings visible with their units", () => {
  render(<QueueLabResults onOpen={vi.fn()} results={[
    { testName: "Glucose", value: "240", unit: "mg/dL", isAbnormal: true },
    { testName: "Serum creatinine", value: "Pending Sample / Analysis" },
  ]} />);
  expect(screen.getByText("1 abnormal")).toBeInTheDocument();
  expect(screen.getByText(/240 mg\/dL/)).toHaveTextContent("Abnormal");
  expect(screen.getByText("Pending Sample / Analysis")).toBeInTheDocument();
});

it("labels a pending report as pending in the viewer", async () => {
  render(<ToastProvider><InCabinInvestigationViewerModal open onClose={vi.fn()} patientId="patient"
    patientName="Ananya Shah" initialResults={[{ testName: "Complete blood count", value: "Pending Sample / Analysis" }]} /></ToastProvider>);
  expect(await screen.findByText("Results pending")).toBeInTheDocument();
  expect(screen.queryByText("Within Normal Limits")).not.toBeInTheDocument();
  expect(screen.queryByText("Normal", { exact: true })).not.toBeInTheDocument();
});
