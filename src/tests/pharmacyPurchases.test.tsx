import { datePickerInput } from "./datePickerTestUtils";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PharmacyPurchases } from "@/components/pharmacy/PharmacyPurchases";
import { ToastProvider } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { purchaseCsvLabels } from "@/lib/pharmacyPurchaseCsv";

const fixture = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: fixture }));
const party = { id: "supplier", locationIds: ["branch"], name: "Current supplier", kinds: ["supplier", "customer"], address: "Actual supplier address", phone: "9000000000", email: "supplier@example.test", gstRegistration: "unregistered", licence: { number: "TEST-LICENCE", validUntil: "2099-12-31" }, archived: false, revision: 5 };
const product = { id: "medicine", name: "Purchase product", price: 10, hsnCode: "300490", unitDefinition: { version: 2, baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10 } };
const draft = { id: "draft", locationId: "branch", supplierId: "supplier", supplierSnapshot: { name: "Original supplier name", address: "Original supplier address", revision: 1 }, supplierInvoiceNumber: "INV-001", invoiceDate: "2026-10-20", invoiceFY: "2026-2027", statedTotalPaise: 12345, revision: 3, status: "draft", notes: "Saved note",
  lines: [{ lineId: "line-stable-0001", medicineId: "medicine", packs: 2, looseUnits: 1, freePacks: 1, freeLooseUnits: 0, billedBaseUnits: 21, freeBaseUnits: 10, baseAmountPaise: 12345, discountPaise: 0, gstRateBps: 0, hsnCode: "300490", sellingPricePaise: 1000, mrpPaise: 1200, unitSnapshot: product.unitDefinition, medicineSnapshot: { name: product.name, genericName: "Synthetic" } }] };
const response = (data: unknown) => ({ data: { data } });
const page = (items: unknown[], nextCursor: string | null = null) => response({ items, nextCursor });
const mount = (canManage = true) => render(<ToastProvider><PharmacyPurchases locationId="branch" canManage={canManage} /></ToastProvider>);
function change(label: string, value: string) {
  const control = screen.getByLabelText(label), input = control.getAttribute("aria-haspopup") === "dialog" ? datePickerInput(control) : control.getAttribute("role") === "combobox" ? document.getElementById(control.id.replace(/-trigger$/, ""))! : control;
  fireEvent.change(input, { target: { value } });
}
async function newDraft() {
  fireEvent.click(screen.getByRole("button", { name: "New purchase draft" }));
  await screen.findByText(party.name, { selector: "option" }); change("Purchase supplier *", party.id);
  await screen.findByText(product.name, { selector: "option" }); change("Purchase product", product.id);
  fireEvent.click(screen.getByRole("button", { name: "Add purchase line" }));
  change("Supplier invoice number *", "NEW-INV"); change("Supplier invoice date *", "2026-10-20"); change("Supplier stated total (INR) *", "123.45");
  change("Billed packs", "2"); change("Billed loose units", "1"); change("Free packs", "1"); change("Base amount before discount/tax (INR)", "123.45"); change("Invoice GST (%)", "0");
}
beforeEach(() => {
  sessionStorage.clear();
  useAuthStore.setState({ user: { id: "buyer", name: "Buyer", email: "buyer@example.test", role: "purchaser", organization_id: "org", permissions: ["PHARMACY_PURCHASE"] } });
  fixture.get.mockReset().mockImplementation(async (url: string) => url.startsWith("/pharmacy/parties/") ? response(party) : url.startsWith("/pharmacy/parties?") ? page([party]) : url.startsWith("/pharmacy/purchases/") ? response(draft) : url.startsWith("/pharmacy/purchase-products?") ? page([product]) : page([draft]));
  fixture.post.mockReset().mockImplementation(async (url: string) => response(url.endsWith("/parties") ? { ...party, id: "new-party", revision: 0 } : { ...draft, id: "new-draft", revision: 0 }));
  fixture.put.mockReset().mockResolvedValue(response({ ...draft, revision: 4 }));
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { vi.restoreAllMocks(); });

it("prefills shortbook packs and loose units in a supplier draft while requiring actual invoice amounts", async () => {
  const original = fixture.get.getMockImplementation()!;
  fixture.get.mockImplementation(async (url: string) => url.startsWith("/pharmacy/shortbook?") ? response({ items: [{ id: "shortage", medicineId: product.id, quantity: 21, unitVersion: 2, note: "", status: "open", revision: 1, updatedAt: "2026-11-15T10:00:00Z", product: { ...product, stockQuantity: 0 } }], nextCursor: null }) : original(url));
  mount(); fireEvent.click(screen.getByRole("tab", { name: "Shortbook" }));
  fireEvent.click(await screen.findByRole("checkbox", { name: "Include Purchase product in purchase draft" })); fireEvent.click(screen.getByRole("button", { name: "Copy selected to purchase draft" }));
  const dialog = await screen.findByRole("dialog", { name: "New purchase draft" });
  expect(within(dialog).getByLabelText("Billed packs")).toHaveValue(2); expect(within(dialog).getByLabelText("Billed loose units")).toHaveValue(1);
  expect(within(dialog).getByLabelText("Base amount before discount/tax (INR)")).toHaveValue(null);
  expect(within(dialog).getByLabelText("Invoice GST (%)")).toHaveValue(null);
  expect(within(dialog).getByLabelText("Purchase draft notes")).toHaveValue("Shortbook shortage");
  expect(fixture.post).not.toHaveBeenCalled(); expect(fixture.put).not.toHaveBeenCalled();
});

it("shows saved drafts with their captured supplier and stated amount, without posting actions", async () => {
  mount(); await screen.findByText("INV-001"); expect(screen.getByText(/Original supplier name/)).toBeInTheDocument(); expect(screen.getByText(/123\.45/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Post|Pay|Receive stock/ })).not.toBeInTheDocument(); expect(fixture.post).not.toHaveBeenCalled();
});
it("renders saved server totals and the stated difference while edits keep the saved calculation labelled", async () => {
  const calculation = { policy: "pharmacy-paise-v2", currency: "INR", priceMode: "exclusive", taxMode: "unallocated", totals: {
    amountBeforeDiscountPaise: 12000, lineDiscountPaise: 2000, invoiceDiscountPaise: 0, baseAmountPaise: 10000,
    cgstPaise: 0, sgstPaise: 0, utgstPaise: 0, igstPaise: 0, unallocatedTaxPaise: 1800, grossAmountPaise: 11800, roundOffPaise: 0, payablePaise: 11800 } };
  fixture.get.mockImplementation(async (url: string) => url.startsWith("/pharmacy/parties/") ? response(party) : url.startsWith("/pharmacy/parties?") ? page([party]) : url.startsWith("/pharmacy/purchases/") ? response({ ...draft, statedTotalPaise: 12000, calculation }) : url.startsWith("/pharmacy/purchase-products?") ? page([product]) : page([draft]));
  mount(); fireEvent.click(await screen.findByRole("button", { name: "Open draft INV-001" }));
  const summary = await screen.findByRole("region", { name: "Saved purchase calculation" });
  expect(within(summary).getByText(/Calculated total:/)).toHaveTextContent(/118\.00.*120\.00/);
  expect(within(summary).getByText(/Difference/)).toHaveTextContent(/2\.00/);
  change("Supplier stated total (INR) *", "999");
  expect(within(summary).getByText(/Calculated total:/)).toHaveTextContent(/118\.00.*120\.00/);
  expect(within(summary).getByText(/Save edits and reopen/)).toBeInTheDocument();
  expect(fixture.post).not.toHaveBeenCalled(); expect(fixture.put).not.toHaveBeenCalled();
});
it("keeps old drafts readable and rejects malformed saved calculation totals", async () => {
  mount(); fireEvent.click(await screen.findByRole("button", { name: "Open draft INV-001" }));
  await screen.findByText(/No saved calculation/); fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fixture.get.mockResolvedValueOnce(response({ ...draft, calculation: { policy: "pharmacy-paise-v2", totals: { payablePaise: "11800" } } }));
  fireEvent.click(screen.getByRole("button", { name: "Open draft INV-001" })); await screen.findByText(/Saved purchase calculation could not be loaded/);
  expect(screen.queryByRole("dialog", { name: "Purchase draft" })).not.toBeInTheDocument();
});
it("creates an unregistered supplier/customer party with real licence details", async () => {
  mount(); fireEvent.click(screen.getByRole("button", { name: "Add supplier / customer" }));
  change("Business name *", "New business"); change("Business address *", "Recorded business address"); change("Party roles", "both"); change("Supplier licence number *", "ACTUAL-LICENCE"); change("Supplier licence valid until (if recorded)", "2099-12-31");
  fireEvent.click(screen.getByRole("button", { name: "Save business party" }));
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/pharmacy/parties", expect.objectContaining({ locationId: "branch", locationIds: ["branch"], name: "New business", kinds: ["customer", "supplier"], gstRegistration: "unregistered", licence: { number: "ACTUAL-LICENCE", validUntil: "2099-12-31" } }), expect.objectContaining({ headers: { "Idempotency-Key": expect.any(String) } })));
  expect(fixture.post.mock.calls[0][1]).not.toHaveProperty("gstin");
});
it("keeps party details and the same creation reference on a save failure", async () => {
  fixture.post.mockRejectedValueOnce(new Error("offline")); mount(); fireEvent.click(screen.getByRole("button", { name: "Add supplier / customer" }));
  change("Business name *", "Retained customer"); change("Business address *", "Recorded address"); change("Party roles", "customer");
  fireEvent.click(screen.getByRole("button", { name: "Save business party" })); await screen.findByText("offline");
  expect(screen.getByLabelText("Business name *")).toHaveValue("Retained customer"); const first = fixture.post.mock.calls[0];
  fireEvent.click(screen.getByRole("button", { name: "Save business party" })); await waitFor(() => expect(fixture.post).toHaveBeenCalledTimes(2)); expect(fixture.post.mock.calls[1]).toEqual(first);
});
it("saves explicit billed/free quantities, exact paise, zero tax and stable line identity", async () => {
  mount(); await newDraft(); fireEvent.click(screen.getByRole("button", { name: "Save purchase draft" }));
  await waitFor(() => expect(fixture.post).toHaveBeenCalledTimes(1));
  const [path, body, config] = fixture.post.mock.calls[0]; expect(path).toBe("/pharmacy/purchases");
  expect(body).toMatchObject({ locationId: "branch", supplierId: "supplier", expectedSupplierRevision: 5, supplierInvoiceNumber: "NEW-INV", statedTotalPaise: 12345,
    lines: [{ lineId: expect.any(String), medicineId: "medicine", expectedUnitVersion: 2, packs: 2, looseUnits: 1, freePacks: 1, freeLooseUnits: 0, baseAmountPaise: 12345, discountPaise: 0, gstRateBps: 0, hsnCode: "300490", sellingPricePaise: 1000 }] });
  expect(config.headers["Idempotency-Key"]).toBeTruthy(); expect(body).not.toHaveProperty("status"); expect(body).not.toHaveProperty("amountPaid");
  expect(fixture.post.mock.calls.some(([url]) => url.includes("stock-receipts") || url.includes("invoice"))).toBe(false);
});
it("appends reviewed CSV lines to the existing draft and saves through the original purchase command", async () => {
  mount(); await newDraft();
  const fields = Object.keys(purchaseCsvLabels), imported = { ...draft.lines[0], lineId: "csv-stable-line-01", expectedUnitVersion: 2 };
  fixture.post.mockImplementation(async (url: string) => response(url.endsWith("/inspect") ? { locationId: "branch", supplierId: "supplier", formatKey: "f".repeat(64), profile: null, headers: fields, fields, records: [{ sourceLine: 2, cells: Object.fromEntries(fields.map(field => [field, field === "source" ? "001" : "0"])) }] } : url.endsWith("/preview") ? { rows: [{ sourceLine: 2, sourceValue: "001", error: null, line: imported, product }], ignoredColumns: [] } : { ...draft, id: "new-draft", revision: 0 }));
  fireEvent.click(screen.getByRole("button", { name: "Import purchase CSV" }));
  expect(screen.getByRole("button", { name: "Save purchase draft" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Save & continue" })).toBeDisabled();
  const file = new File(["source"], "supplier.csv", { type: "text/csv" });
  Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode("source\n001").buffer });
  fireEvent.change(screen.getByLabelText("Supplier invoice CSV"), { target: { files: [file] } }); await screen.findByText("supplier.csv · 1 lines");
  fireEvent.click(screen.getByRole("button", { name: "Match source item 1: 001" }));
  await waitFor(() => expect(screen.getAllByText(/Purchase product · 10 tablet\/strip/, { selector: "option" })).toHaveLength(1));
  change("Existing medicine for source item", product.id); fireEvent.click(screen.getByRole("button", { name: "Use selected medicine" }));
  fireEvent.click(screen.getByRole("button", { name: "Preview purchase lines" })); await screen.findByRole("checkbox"); fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Add 1 CSV lines to draft" })); await screen.findByText(/1 CSV lines added/);
  expect(screen.getByLabelText("Supplier invoice number *")).toHaveValue("NEW-INV");
  expect(screen.getAllByRole("group", { name: /Purchase line \d/ })).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Save purchase draft" }));
  await waitFor(() => expect(fixture.post.mock.calls.some(([url]) => url === "/pharmacy/purchases")).toBe(true));
  const [, body, config] = fixture.post.mock.calls.find(([url]) => url === "/pharmacy/purchases")!;
  expect(body.lines).toHaveLength(2); expect(body.lines[1]).toMatchObject({ lineId: "csv-stable-line-01", medicineId: "medicine", packs: 2, freePacks: 1, baseAmountPaise: 12345, gstRateBps: 0 });
  expect(config.headers["Idempotency-Key"]).toBeTruthy(); expect(fixture.post.mock.calls.some(([url]) => url.includes("receipts") || url.includes("/post"))).toBe(false);
});
it("reopens draft values and sends the current revision while preserving its saved source line", async () => {
  mount(); fireEvent.click(await screen.findByRole("button", { name: "Open draft INV-001" }));
  await screen.findByText(/Saved supplier snapshot: Original supplier name/);
  expect(screen.getByLabelText("Base amount before discount/tax (INR)")).toHaveValue(123.45); expect(screen.getByLabelText("Invoice GST (%)")).toHaveValue(0);
  await screen.findByText(party.name, { selector: "option" }); change("Purchase draft notes", "Edited note");
  fireEvent.click(screen.getByRole("button", { name: "Save purchase draft" }));
  await waitFor(() => expect(fixture.put).toHaveBeenCalledWith("/pharmacy/purchases/draft", expect.objectContaining({ expectedRevision: 3, expectedSupplierRevision: 5, notes: "Edited note", lines: [expect.objectContaining({ lineId: "line-stable-0001", expectedUnitVersion: 2 })] })));
});
it("retains edited draft values after a stale revision conflict", async () => {
  fixture.put.mockRejectedValueOnce({ response: { data: { message: "Purchase draft changed; reload before saving" } } });
  mount(); fireEvent.click(await screen.findByRole("button", { name: "Open draft INV-001" })); await screen.findByText(party.name, { selector: "option" });
  change("Purchase draft notes", "Retained correction"); fireEvent.click(screen.getByRole("button", { name: "Save purchase draft" }));
  await screen.findByText("Purchase draft changed; reload before saving"); expect(screen.getByLabelText("Purchase draft notes")).toHaveValue("Retained correction");
});
it("rejects fractional paise and invalid loose quantities before sending a draft", async () => {
  mount(); await newDraft(); change("Base amount before discount/tax (INR)", "0.001");
  fireEvent.click(screen.getByRole("button", { name: "Save purchase draft" })); await screen.findByText(/Check quantities, exact amounts/); expect(fixture.post).not.toHaveBeenCalled();
  change("Base amount before discount/tax (INR)", "12.34"); change("Billed loose units", "10"); fireEvent.click(screen.getByRole("button", { name: "Save purchase draft" })); expect(fixture.post).not.toHaveBeenCalled();
});
it("reads only the requested list page and offers explicit pagination", async () => {
  fixture.get.mockImplementation(async (url: string) => url.includes("cursor=next-page") ? page([]) : page([draft], "next-page"));
  mount(); await screen.findByText("INV-001"); expect(fixture.get).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Next purchase page" })); await screen.findByText("No purchase drafts match this search.");
  expect(fixture.get.mock.calls[1][0]).toContain("cursor=next-page"); expect(fixture.get.mock.calls[1][0]).toContain("limit=25");
});
it("keeps history read-only when new purchase activity is disabled", async () => {
  mount(false); fireEvent.click(await screen.findByRole("button", { name: "Open draft INV-001" }));
  const dialog = await screen.findByRole("dialog", { name: "Purchase draft" }); expect(within(dialog).getByLabelText("Supplier invoice number *")).toBeDisabled();
  expect(within(dialog).queryByRole("button", { name: "Save purchase draft" })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "New purchase draft" })).not.toBeInTheDocument();
});
it("ignores a late list response after the component leaves the branch", async () => {
  let finish!: (value: unknown) => void; fixture.get.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = mount(); await waitFor(() => expect(fixture.get).toHaveBeenCalledTimes(1)); view.unmount();
  await act(async () => { finish(page([draft])); }); expect(screen.queryByText("INV-001")).not.toBeInTheDocument();
});
it("clears the previous branch's records and draft form while the next branch loads", async () => {
  const view = mount(); fireEvent.click(await screen.findByRole("button", { name: "Open draft INV-001" })); await screen.findByRole("dialog", { name: "Purchase draft" });
  fixture.get.mockImplementation(() => new Promise(() => {}));
  view.rerender(<ToastProvider><PharmacyPurchases locationId="next-branch" canManage /></ToastProvider>);
  expect(screen.queryByRole("dialog", { name: "Purchase draft" })).not.toBeInTheDocument(); expect(screen.queryByText("INV-001")).not.toBeInTheDocument();
  await waitFor(() => expect(fixture.get.mock.calls.some(([url]) => url.includes("locationId=next-branch"))).toBe(true));
});

it("saves a new draft and continues directly to posting without reopening it or posting automatically", async () => {
  mount(); await newDraft(); fireEvent.click(screen.getByRole("button", { name: "Save & continue" }));
  await screen.findByRole("dialog", { name: "Post saved supplier invoice" });
  expect(fixture.post).toHaveBeenCalledTimes(1);
  expect(fixture.post.mock.calls[0][0]).toBe("/pharmacy/purchases");
  expect(fixture.get.mock.calls.some(([url]) => url.startsWith("/pharmacy/purchases/"))).toBe(false);
  expect(screen.queryByRole("dialog", { name: "New purchase draft" })).not.toBeInTheDocument();
  const count = fixture.get.mock.calls.filter(([url]) => url.startsWith("/pharmacy/purchases?")).length;
  fireEvent.click(screen.getByRole("button", { name: "Close purchase" }));
  await waitFor(() => expect(fixture.get.mock.calls.filter(([url]) => url.startsWith("/pharmacy/purchases?")).length).toBe(count + 1));
});

it("saves current edits before continuing and posts the returned saved revision", async () => {
  fixture.put.mockImplementation(async (_url: string, body: { notes: string }) => response({ ...draft, notes: body.notes, revision: 4 }));
  mount(); fireEvent.click(await screen.findByRole("button", { name: "Open draft INV-001" }));
  await screen.findByText(party.name, { selector: "option" }); change("Purchase draft notes", "Latest edited note");
  fireEvent.click(screen.getByRole("button", { name: "Save & continue" }));
  await screen.findByRole("dialog", { name: "Post saved supplier invoice" });
  expect(fixture.put.mock.calls[0][1]).toMatchObject({ expectedRevision: 3, notes: "Latest edited note" });
  await waitFor(() => expect(screen.getByRole("button", { name: "Post saved supplier invoice" })).not.toBeDisabled());
  change("Reviewed supplier state code", "27"); change("Reviewed supplier GST split", "sgst"); change("Reviewed acquisition cost treatment", "exclude_tax"); change("Supplier eligibility and tax review reference", "Recorded supplier review");
  fireEvent.click(screen.getByRole("button", { name: "Post saved supplier invoice" }));
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/pharmacy/purchases/draft/post", expect.objectContaining({ expectedRevision: 4 }), expect.anything()));
  expect(fixture.get.mock.calls.filter(([url]) => url.startsWith("/pharmacy/purchases/draft?"))).toHaveLength(1);
});

it("keeps the edited form and creation reference when Save & continue fails", async () => {
  fixture.post.mockRejectedValueOnce(new Error("offline")); mount(); await newDraft();
  fireEvent.click(screen.getByRole("button", { name: "Save & continue" })); await screen.findByText("offline");
  expect(screen.getByLabelText("Supplier invoice number *")).toHaveValue("NEW-INV");
  expect(screen.queryByRole("dialog", { name: "Post saved supplier invoice" })).not.toBeInTheDocument();
  const first = fixture.post.mock.calls[0]; fireEvent.click(screen.getByRole("button", { name: "Save & continue" }));
  await screen.findByRole("dialog", { name: "Post saved supplier invoice" }); expect(fixture.post.mock.calls[1]).toEqual(first);
});

it("does not continue a late save after leaving its branch", async () => {
  let finish!: (value: unknown) => void; fixture.post.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = mount(); await newDraft(); fireEvent.click(screen.getByRole("button", { name: "Save & continue" }));
  await waitFor(() => expect(fixture.post).toHaveBeenCalledTimes(1));
  view.rerender(<ToastProvider><PharmacyPurchases locationId="next-branch" canManage /></ToastProvider>);
  await act(async () => { finish(response({ ...draft, id: "new-draft", revision: 0 })); });
  expect(screen.queryByRole("dialog", { name: "Post saved supplier invoice" })).not.toBeInTheDocument();
});
