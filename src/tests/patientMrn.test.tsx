import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PatientMrn } from "@/components/patients/PatientMrn";
import { PatientHeader } from "@/components/clinical/PatientHeader";

afterEach(cleanup);
const mrn = "MRN-2026-EXAMPLE-ORGANIZATION-000001";

it("reveals the exact identifier from the compact mobile label and closes without changing it", async () => {
  render(<PatientMrn value={mrn} />);
  const trigger = screen.getByRole("button", { name: "View full MRN" });
  expect(trigger).toHaveTextContent("MRN: …000001");
  fireEvent.click(trigger);
  const dialog = await screen.findByRole("dialog", { name: "Patient MRN" });
  expect(within(dialog).getByText(mrn)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(trigger).toHaveTextContent("MRN: …000001");
});

it("keeps short identifiers intact and never creates an identifier when missing", () => {
  const view = render(<PatientMrn value="MRN-12" />);
  expect(screen.getByRole("button", { name: "View full MRN" })).toHaveTextContent("MRN: MRN-12");
  view.rerender(<PatientMrn />);
  expect(screen.getByText("MRN: Not assigned")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("preserves the full header identifier unless compact presentation is requested", () => {
  const patient = { id: "sample-patient", name: "Sample patient", mrn };
  const view = render(<PatientHeader patient={patient} />);
  expect(screen.getByText(`MRN: ${mrn}`)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "View full MRN" })).not.toBeInTheDocument();
  view.rerender(<PatientHeader patient={patient} compactMrn />);
  expect(screen.getByRole("button", { name: "View full MRN" })).toBeInTheDocument();
});
