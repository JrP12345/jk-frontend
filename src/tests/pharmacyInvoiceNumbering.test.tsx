import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import api from "@/lib/api";
import { PharmacyInvoiceNumberingSettings } from "@/components/pharmacy/PharmacyInvoiceNumberingSettings";
import { parsePharmacyNumbering } from "@/lib/pharmacyInvoiceNumbering";
import { pharmacyNumberPrefix, validCapturedPharmacyNumber, type PharmacyNumberSnapshot } from "@/lib/pharmacyInvoiceNumberFormat";
import { useAuthStore } from "@/store/authStore";

vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), put: vi.fn() } }));
const response = (data: unknown) => ({ data: { data } });
const defaults = () => ({ organizationId: "org", locationId: "branch", revision: 0, financialYear: "2026-27", configuration: null, nextNumber: null, preview: null });
const configured = (revision = 1, nextNumber = 137) => ({ ...defaults(), revision, configuration: { prefixTemplate: "PJP/{FY}/", digits: 6, resetPolicy: "financial_year", reviewReference: "Reviewed series" }, nextNumber, preview: `PJP/26-27/${String(nextNumber).padStart(6, "0")}` });
const mount = (onBusyChange = vi.fn()) => render(<PharmacyInvoiceNumberingSettings locationId="branch" organizationId="org" onBusyChange={onBusyChange} />);
beforeEach(() => {
  vi.clearAllMocks();
  // jsdom does not implement the browser scrolling used by the shared Select.
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: "owner", name: "Owner", email: "owner@example.test", role: "admin", organization_id: "org", permissions: ["MANAGE_ORGANIZATION"] } });
  vi.mocked(api.get).mockResolvedValue(response(defaults())); vi.mocked(api.put).mockResolvedValue(response(configured()));
});
afterEach(cleanup);
const complete = async () => {
  await screen.findByText("This branch currently uses system numbering.");
  fireEvent.change(screen.getByLabelText("Invoice prefix *"), { target: { value: "pjp/{fy}/" } });
  fireEvent.change(screen.getByLabelText("Next invoice number *"), { target: { value: "137" } });
  fireEvent.change(screen.getByLabelText("Numbering review reference *"), { target: { value: " Reviewed series " } });
  fireEvent.click(screen.getByRole("checkbox", { name: "I confirm this branch series and next number" }));
};
it("previews owner prefix, padding and yearly format within 16 characters", () => {
  expect(pharmacyNumberPrefix({ prefixTemplate: "PJP/{FY}/", digits: 6, resetPolicy: "financial_year" }, "2026-27")).toBe("PJP/26-27/");
  expect(pharmacyNumberPrefix({ prefixTemplate: "PJP/", digits: 6, resetPolicy: "continuous" }, "2027-28")).toBe("PJP/");
  expect(() => pharmacyNumberPrefix({ prefixTemplate: "TOO-LONG/{FY}/", digits: 9, resetPolicy: "financial_year" }, "2026-27")).toThrow(/16/);
  expect(() => pharmacyNumberPrefix({ prefixTemplate: "PJP/{FY}/", digits: 6, resetPolicy: "continuous" }, "2026-27")).toThrow(/yearly/);
  expect(() => pharmacyNumberPrefix({ prefixTemplate: "PJP/{FY}/", digits: 6, resetPolicy: "financial_year" }, "2026-99")).toThrow(/Review/);
});
it("validates custom invoice numbers against immutable captured evidence, not a generic string", () => {
  const numberingSnapshot: PharmacyNumberSnapshot = { version: 1, prefixTemplate: "PJP/{FY}/", prefix: "PJP/26-27/", digits: 6, resetPolicy: "financial_year", sequence: 137, configurationRevision: 1 };
  const invoice = { invoiceNumber: "PJP/26-27/000137", invoiceSeries: "PJP/26-27/", numberingVersion: 3, financialYear: "2026-27", issuedAt: "2026-11-15T00:00:00.000Z", numberingSnapshot };
  expect(validCapturedPharmacyNumber(invoice)).toBe(true);
  expect(validCapturedPharmacyNumber({ ...invoice, numberingSnapshot: undefined })).toBe(false);
  expect(validCapturedPharmacyNumber({ ...invoice, invoiceNumber: "PJP/26-27/000138" })).toBe(false);
  expect(validCapturedPharmacyNumber({ ...invoice, numberingSnapshot: { ...numberingSnapshot, sequence: 138 } })).toBe(false);
  expect(validCapturedPharmacyNumber({ ...invoice, financialYear: "2027-28" })).toBe(false);
  expect(validCapturedPharmacyNumber({ ...invoice, numberingVersion: 2 })).toBe(false);
});
it("rejects mismatched branch responses, invalid previews and exhausted-series impostors", () => {
  expect(parsePharmacyNumbering(defaults(), "branch", "org").revision).toBe(0);
  expect(() => parsePharmacyNumbering(configured(), "other", "org")).toThrow(/branch/);
  expect(() => parsePharmacyNumbering({ ...configured(), preview: "wrong" }, "branch", "org")).toThrow(/confirmed/);
  expect(() => parsePharmacyNumbering({ ...configured(), nextNumber: 1000001, preview: null }, "branch", "org")).toThrow(/confirmed/);
  expect(parsePharmacyNumbering({ ...configured(), nextNumber: 1000000, preview: null }, "branch", "org").preview).toBeNull();
});
it("loads the scoped existing branch, requires review and saves only the intended fields", async () => {
  const busy = vi.fn(); mount(busy); await complete();
  expect(screen.getByText("Preview (2026-27): PJP/26-27/000137")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save invoice numbering" }));
  await screen.findByText(/Numbering saved. Next available invoice: PJP\/26-27\/000137/);
  expect(api.get).toHaveBeenCalledWith("/pharmacy/locations/branch/invoice-numbering?organizationId=org", expect.anything());
  expect(api.put).toHaveBeenCalledWith("/pharmacy/locations/branch/invoice-numbering?organizationId=org", { expectedRevision: 0, expectedFinancialYear: "2026-27", prefixTemplate: "PJP/{FY}/", digits: 6, resetPolicy: "financial_year", nextNumber: 137, reviewReference: "Reviewed series" });
  expect(busy.mock.calls).toEqual([[true], [false]]);
  expect(screen.getByRole("button", { name: "Save invoice numbering" })).toBeDisabled();
});
it("resets confirmation when any series value changes and blocks invalid or oversized input", async () => {
  mount(); await complete(); expect(screen.getByRole("button", { name: "Save invoice numbering" })).toBeEnabled();
  fireEvent.click(screen.getByRole("combobox", { name: "Number of digits" })); fireEvent.click(await screen.findByRole("option", { name: "2" }));
  expect(screen.getByRole("checkbox")).not.toBeChecked(); expect(screen.getByRole("button", { name: "Save invoice numbering" })).toBeDisabled();
  expect(screen.getByText("Enter a next number that fits the selected digits.")).toBeInTheDocument(); expect(api.put).not.toHaveBeenCalled();
});
it("locks editing after an uncertain/conflicting save, then reloads the actual revision and next number", async () => {
  vi.mocked(api.put).mockRejectedValueOnce({ response: { data: { message: "Next number has already been used. Reload." } } });
  mount(); await complete(); fireEvent.click(screen.getByRole("button", { name: "Save invoice numbering" }));
  await screen.findByText("Next number has already been used. Reload."); expect(screen.getByLabelText("Next invoice number *")).toBeDisabled();
  vi.mocked(api.get).mockResolvedValue(response(configured(3, 140)));
  fireEvent.click(screen.getByRole("button", { name: "Reload invoice numbering" }));
  await waitFor(() => expect(screen.getByLabelText("Next invoice number *")).toHaveValue("140"));
  fireEvent.change(screen.getByLabelText("Numbering review reference *"), { target: { value: "Reviewed newer state" } }); fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Save invoice numbering" }));
  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
  expect(vi.mocked(api.put).mock.calls[1][1]).toMatchObject({ expectedRevision: 3, nextNumber: 140 });
});
it("blocks double submission and propagates busy state until the server confirms the settings", async () => {
  let finish: (value: unknown) => void = () => {};
  vi.mocked(api.put).mockReturnValue(new Promise(resolve => { finish = resolve; }) as never);
  const busy = vi.fn(); mount(busy); await complete();
  fireEvent.submit(screen.getByRole("form", { name: "Branch invoice numbering" })); fireEvent.submit(screen.getByRole("form", { name: "Branch invoice numbering" }));
  expect(api.put).toHaveBeenCalledOnce(); expect(busy).toHaveBeenCalledWith(true);
  await act(async () => finish(response(configured()))); expect(busy).toHaveBeenLastCalledWith(false);
});
it("does not load or save numbering after losing owner authority", async () => {
  mount(); await complete();
  await act(async () => useAuthStore.setState({ user: { ...useAuthStore.getState().user!, permissions: [] } }));
  fireEvent.submit(screen.getByRole("form", { name: "Branch invoice numbering" })); expect(api.put).not.toHaveBeenCalled();
});
