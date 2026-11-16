import { datePickerInput } from "./datePickerTestUtils";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { PharmacyExternalPrescriptions } from "@/components/pharmacy/PharmacyExternalPrescriptions";
import { PharmacyExternalPrescriptionEditor } from "@/components/pharmacy/PharmacyExternalPrescriptionEditor";
import { useAuthStore } from "@/store/authStore";
import { clearPharmacyDrafts } from "@/lib/pharmacyDrafts";
import { createSaleJournal } from "@/lib/pharmacyCommandJournal";
import { authScopeKey } from "@/lib/authScope";
import { externalPrescriptions, readExternalPrescription, recordExternalPrescription, externalMedicines, parseExternalPrescription, type ExternalPrescription } from "@/lib/pharmacyExternalPrescriptions";
import { quoteCounter, issueCounter, recoverCounter, type CounterIntent, type CounterIssueInput, type CounterQuote } from "@/lib/pharmacyCounter";

vi.mock("@/lib/pharmacyExternalPrescriptions", async original => ({ ...await original<typeof import("@/lib/pharmacyExternalPrescriptions")>(), externalPrescriptions: vi.fn(), readExternalPrescription: vi.fn(), recordExternalPrescription: vi.fn(), externalMedicines: vi.fn() }));
vi.mock("@/lib/pharmacyCounter", async original => ({ ...await original<typeof import("@/lib/pharmacyCounter")>(), quoteCounter: vi.fn(), issueCounter: vi.fn(), recoverCounter: vi.fn() }));
vi.mock("@/components/pharmacy/PharmacySavedBillPrint", () => ({ PharmacySavedBillPrint: ({ invoiceId }: { invoiceId: string }) => <p>Print saved {invoiceId}</p> }));
vi.mock("@/components/pharmacy/PharmacyCollections", () => ({ PharmacyCollections: () => <p>Existing collections</p> }));
const id = "a".repeat(24), medicineId = "b".repeat(24);
const rx: ExternalPrescription = { id, locationId: "branch", reference: "RX-001", revision: 0, status: "approved", validUntil: "2099-12-31T18:29:59Z", reviewedAt: "2026-11-14T10:00:00Z", issuedOn: "2026-11-14", patientName: "Outside patient", patientAddress: "Actual patient address", patientPhone: "9876543210", prescriberName: "Outside prescriber", prescriberAddress: "Actual prescriber address", prescriberRegistration: "RMP-001", prescriberCouncil: "Council", prescriberReviewReference: "Registration evidence", sourceReference: "Retained signed RX-001", reviewConfirmed: true, lines: [{ medicineId, name: "Reviewed medicine", baseUnit: "tablet", expectedUnitVersion: 1, expectedDispensingRevision: 1, quantity: 6, supplied: 0, instructions: "Original written directions" }], supplies: [] };
function quote(intent: CounterIntent): CounterQuote {
  const total = intent.lines.reduce((sum, line) => sum + line.quantity * 1000, 0);
  return { locationId: "branch", currency: "INR", quoteHash: "a".repeat(64), customer: null, calculation: { policy: "pharmacy-paise-v2", lines: intent.lines.map(line => ({ ...line, grossAmountPaise: line.quantity * 1000 })), totals: { payablePaise: total, baseAmountPaise: total, cgstPaise: 0, sgstPaise: 0, lineDiscountPaise: 0, invoiceDiscountPaise: 0, roundOffPaise: 0 } }, issueInput: { ...intent, expectedQuoteHash: "a".repeat(64), expectedTotalPaise: total, expectedProfileRevision: 1, lines: intent.lines.map(line => ({ ...line, expectedStockRevision: 1 })) }, lines: intent.lines.map(line => ({ ...line, description: "Reviewed medicine", unitSnapshot: { baseUnit: "tablet" }, batches: [{ batchNumber: "BATCH-1", quantity: line.quantity, expiryValue: "2099-12", mrpPaise: 1200, sellingPricePaise: 1000 }] })) };
}
const mount = (collect = false, locationId = "branch") => render(<PharmacyExternalPrescriptions locationId={locationId} canSupply canCollect={collect} canOpenTill={false} canViewSales={collect} />);
async function open() { fireEvent.click(await screen.findByRole("button", { name: /Open prescription RX-001/ })); await screen.findByLabelText("Supply Reviewed medicine"); }
async function prepare() { await open(); fireEvent.change(screen.getByLabelText("Supply Reviewed medicine"), { target: { value: "2" } }); fireEvent.click(screen.getByRole("button", { name: "Prepare bill for selected quantities" })); await screen.findByText("Current bill · ₹20.00"); }
beforeEach(async () => {
  vi.clearAllMocks(); sessionStorage.clear(); await clearPharmacyDrafts();
  useAuthStore.setState({ user: { id: "pharmacist", name: "Pharmacist", role: "pharmacy_pharmacist", email: "test@example.test", organization_id: "org", permissions: ["PHARMACY_DISPENSE_RESTRICTED"] } });
  vi.mocked(externalPrescriptions).mockResolvedValue({ items: [rx], nextCursor: null });
  vi.mocked(readExternalPrescription).mockResolvedValue(rx);
  vi.mocked(externalMedicines).mockResolvedValue([{ id: medicineId, name: "Reviewed medicine", genericName: "Generic", baseUnit: "tablet", unitVersion: 1, dispensingRevision: 1, scheduleType: "schedule_h1" }]);
  vi.mocked(quoteCounter).mockImplementation(async intent => quote(intent));
  vi.mocked(issueCounter).mockImplementation(async (input, key) => ({ invoiceId: "invoice", invoiceNumber: "INV-001", dispenseId: "dispense", requestKey: key, totalPaise: input.expectedTotalPaise, status: input.payment ? "paid" : "unpaid" }));
});

it("opens outside prescription evidence without a clinic visit, edits quantities locally and issues one linked bill", async () => {
  mount(); await prepare();
  expect(screen.getByText("Outside prescriptions")).toBeInTheDocument();
  expect(quoteCounter).toHaveBeenCalledTimes(1);
  expect(quoteCounter).toHaveBeenCalledWith(expect.objectContaining({ externalPrescription: { id, revision: 0 }, lines: [expect.objectContaining({ medicineId, quantity: 2 })] }));
  expect(issueCounter).not.toHaveBeenCalled();
  expect(screen.getByText(/authorized cashier must collect/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Issue bill for collection" }));
  await screen.findByText(/INV-001.*Awaiting collection/);
  expect(issueCounter).toHaveBeenCalledTimes(1);
  expect(vi.mocked(issueCounter).mock.calls[0][0]).toMatchObject({ includeDocument: true, externalPrescription: { id, revision: 0 } });
  expect(vi.mocked(issueCounter).mock.calls[0][0].payment).toBeUndefined();
  fireEvent.click(screen.getByRole("button", { name: "Print saved bill" }));
  expect(screen.getByText("Print saved invoice")).toBeInTheDocument();
});

it("invalidates a prepared bill when quantity changes and rejects quantities beyond the remaining allowance", async () => {
  mount(); await prepare();
  fireEvent.change(screen.getByLabelText("Supply Reviewed medicine"), { target: { value: "7" } });
  expect(screen.queryByText("Current bill · ₹20.00")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Prepare bill for selected quantities" }));
  await screen.findByText(/Enter whole quantities within/); expect(quoteCounter).toHaveBeenCalledTimes(1); expect(issueCounter).not.toHaveBeenCalled();
});

it("hands quantities to billing with Enter and F8, and never uses F10 to bypass actual receipt confirmation", async () => {
  mount(true); await open();
  const quantity = screen.getByLabelText("Supply Reviewed medicine"); expect(quantity).toHaveFocus();
  fireEvent.change(quantity, { target: { value: "2" } }); fireEvent.keyDown(quantity, { key: "Enter" });
  await screen.findByText("Current bill · ₹20.00");
  const cash = screen.getByLabelText("Cash received (INR)"); await waitFor(() => expect(cash).toHaveFocus());
  fireEvent.keyDown(cash, { key: "F10" }); expect(issueCounter).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText("I confirmed this payment was actually received."));
  fireEvent.keyDown(cash, { key: "F10" }); await waitFor(() => expect(issueCounter).toHaveBeenCalledTimes(1));
});

it("prepares through F8 after quantities are selected and ignores repeated shortcut events", async () => {
  mount(); await open(); const quantity = screen.getByLabelText("Supply Reviewed medicine");
  fireEvent.change(quantity, { target: { value: "1" } }); fireEvent.keyDown(quantity, { key: "F8", repeat: true }); expect(quoteCounter).not.toHaveBeenCalled();
  for (const modifier of ["altKey", "ctrlKey", "metaKey", "shiftKey"]) fireEvent.keyDown(quantity, { key: "F8", [modifier]: true });
  expect(quoteCounter).not.toHaveBeenCalled();
  fireEvent.keyDown(quantity, { key: "F8" }); await screen.findByText("Current bill · ₹10.00");
  expect(quoteCounter).toHaveBeenCalledTimes(1); expect(issueCounter).not.toHaveBeenCalled();
});

it("requires confirmation of actual money and validates cash before sending a paid supply", async () => {
  mount(true); await prepare();
  const save = screen.getByRole("button", { name: "Save supply and payment" }); expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Cash received (INR)"), { target: { value: "10" } });
  fireEvent.click(screen.getByLabelText("I confirmed this payment was actually received.")); fireEvent.click(save);
  await screen.findByText(/Confirm actual receipt/); expect(issueCounter).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Cash received (INR)"), { target: { value: "50" } });
  expect(save).toBeDisabled(); fireEvent.click(screen.getByLabelText("I confirmed this payment was actually received.")); fireEvent.click(save);
  await screen.findByText(/INV-001.*Paid/);
  expect(vi.mocked(issueCounter).mock.calls[0][0].payment).toMatchObject({ expectedBalancePaise: 2000, cashTenderedPaise: 5000, manualConfirmed: true, entries: [{ amountPaise: 2000, paymentMethod: "cash" }] });
});

it("restores an uncertain supply after unmount and checks the original key without creating another bill", async () => {
  vi.mocked(issueCounter).mockRejectedValue({ response: { status: 500, data: { message: "Outcome unknown" } } });
  const first = mount(); await prepare(); fireEvent.click(screen.getByRole("button", { name: "Issue bill for collection" }));
  await screen.findByText("Outcome unknown"); const [input, key] = vi.mocked(issueCounter).mock.calls[0];
  first.unmount();
  vi.mocked(recoverCounter).mockResolvedValue({ invoiceId: "invoice", invoiceNumber: "INV-001", dispenseId: "dispense", requestKey: key, totalPaise: input.expectedTotalPaise, status: "unpaid" });
  mount(); fireEvent.click(await screen.findByRole("button", { name: "Check saved result" }));
  await screen.findByText(/INV-001.*Awaiting collection/);
  expect(recoverCounter).toHaveBeenCalledWith("branch", key, true); expect(issueCounter).toHaveBeenCalledTimes(1);
});

it("drops prescription evidence on a branch change and ignores a late response from the previous branch", async () => {
  let resolve!: (row: ExternalPrescription) => void;
  vi.mocked(readExternalPrescription).mockImplementation(() => new Promise(done => { resolve = done; }));
  const view = mount(); fireEvent.click(await screen.findByRole("button", { name: /Open prescription RX-001/ }));
  vi.mocked(externalPrescriptions).mockResolvedValue({ items: [], nextCursor: null });
  view.rerender(<PharmacyExternalPrescriptions locationId="other" canSupply canCollect={false} canOpenTill={false} canViewSales={false} />);
  await act(async () => resolve(rx));
  await screen.findByText(/No outside prescriptions recorded/);
  expect(screen.queryByLabelText("Supply Reviewed medicine")).not.toBeInTheDocument(); expect(screen.queryByText("Actual patient address")).not.toBeInTheDocument();
});

it("requires a pharmacist's evidence review and actual directions before recording a prescription", async () => {
  vi.mocked(recordExternalPrescription).mockResolvedValue(rx); const saved = vi.fn();
  render(<PharmacyExternalPrescriptionEditor locationId="branch" onClose={vi.fn()} onSaved={saved} />);
  const button = screen.getByRole("button", { name: "Record reviewed prescription" }); expect(button).toBeDisabled();
  for (const [label, value] of [["Prescription reference", "RX-001"], ["Prescription date", "2026-11-14"], ["Reviewed supply deadline", "2026-11-20"], ["Patient name", "Outside patient"], ["Patient address", "Actual address"], ["Prescriber name", "Outside doctor"], ["Prescriber registration number", "REG-1"], ["Prescriber council", "Council"], ["Prescriber address", "Practice address"], ["Prescriber verification evidence reference", "Reviewed registration record"], ["Retained signed prescription reference", "Paper RX-001"]]) fireEvent.change(["Prescription date", "Reviewed supply deadline"].includes(label) ? datePickerInput(screen.getByLabelText(label)) : screen.getByLabelText(label), { target: { value } });
  fireEvent.click(await screen.findByRole("button", { name: "Add Reviewed medicine" }));
  fireEvent.change(screen.getByLabelText("Original directions for Reviewed medicine"), { target: { value: "Original written directions" } });
  const checkbox = screen.getByRole("checkbox"); fireEvent.click(checkbox);
  fireEvent.change(screen.getByLabelText("Permitted Reviewed medicine (tablet)"), { target: { value: "6" } });
  expect(checkbox).not.toBeChecked(); fireEvent.click(checkbox); fireEvent.click(button);
  await waitFor(() => expect(saved).toHaveBeenCalledWith(rx));
  expect(recordExternalPrescription).toHaveBeenCalledWith(expect.objectContaining({ reviewConfirmed: true, lines: [{ medicineId, quantity: 6, expectedUnitVersion: 1, expectedDispensingRevision: 1, instructions: "Original written directions" }] }), expect.any(String));
});

it("rejects foreign or overfilled prescription responses and isolates recovery intents without retaining patient details", async () => {
  expect(() => parseExternalPrescription({ ...rx, locationId: "foreign" }, "branch")).toThrow(/incomplete/);
  expect(() => parseExternalPrescription({ ...rx, lines: [{ ...rx.lines[0], supplied: 7 }] }, "branch")).toThrow(/incomplete/);
  const scope = authScopeKey(useAuthStore.getState().user), journal = createSaleJournal(scope, "branch", "external-prescription-sale"); await journal.load();
  const input = quote({ locationId: "branch", externalPrescription: { id, revision: 0 }, invoiceDiscountPaise: 0, roundOffPaise: 0, lines: [{ lineId: "line-123", medicineId, quantity: 2, expectedUnitVersion: 1, discountPaise: 0 }] }).issueInput;
  await journal.save({ key: "stable-operation-key", input: { ...input, patientName: "Private patient", sourceReference: "Private document" } as CounterIssueInput });
  const restored = (await createSaleJournal(scope, "branch", "external-prescription-sale").load()).value;
  expect(restored?.input.externalPrescription).toEqual({ id, revision: 0 }); expect(JSON.stringify(restored)).not.toMatch(/Private|patientName|sourceReference/);
  expect((await createSaleJournal(scope, "branch").load()).value).toBeNull();
});
