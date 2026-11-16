import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import api from "@/lib/api";
import { PharmacyPurchaseCsv } from "@/components/pharmacy/PharmacyPurchaseCsv";
import { purchaseCsvLabels, inspectPurchaseCsv, previewPurchaseCsv, type PurchaseCsvPreview } from "@/lib/pharmacyPurchaseCsv";

vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
const fields = Object.keys(purchaseCsvLabels), cells = Object.fromEntries(fields.map(field => [field, field === "source" ? "001" : "0"]));
const inspection = { locationId: "branch", supplierId: "supplier", formatKey: "f".repeat(64), profile: null, headers: fields, fields, records: [{ sourceLine: 2, cells }] };
const product = { id: "medicine", name: "Cotton", manufacturer: "Maker", price: 10, unitDefinition: { version: 2, baseUnit: "piece", packUnit: "box", unitsPerPack: 10 } };
const line = { lineId: "stable-csv-line", medicineId: "medicine", expectedUnitVersion: 2, packs: 1, looseUnits: 2, freePacks: 1, freeLooseUnits: 0,
  baseAmountPaise: 12345, discountPaise: 1, gstRateBps: 1800, hsnCode: "300490", sellingPricePaise: 1000, mrpPaise: 1200 };
const preview: PurchaseCsvPreview = { rows: [{ sourceLine: 2, sourceValue: "001", line, product: { ...product, identityHash: "a".repeat(64) }, error: null }], ignoredColumns: ["Batch", "Expiry"] };
const response = (data: unknown) => ({ data: { data } });
function file(name = "invoice.csv", bytes?: Uint8Array) {
  const value = new File(["source"], name, { type: "text/csv" });
  Object.defineProperty(value, "arrayBuffer", { value: async () => (bytes || new TextEncoder().encode("source,packs\n001,1")).buffer });
  return value;
}
function change(label: string, value: string) {
  const control = screen.getByLabelText(label), input = control.getAttribute("role") === "combobox" ? document.getElementById(control.id.replace(/-trigger$/, ""))! : control;
  fireEvent.change(input, { target: { value } });
}
const mount = (remaining = 100) => { const onApply = vi.fn(), onCancel = vi.fn(); return { ...render(<PharmacyPurchaseCsv locationId="branch" supplierId="supplier" remaining={remaining} onApply={onApply} onCancel={onCancel} />), onApply, onCancel }; };
async function choose() {
  fireEvent.change(screen.getByLabelText("Supplier invoice CSV"), { target: { files: [file()] } });
  await screen.findByText("invoice.csv · 1 lines");
}
async function match() {
  fireEvent.click(screen.getByRole("button", { name: "Match source item 1: 001" }));
  await screen.findByText(/Cotton · Maker/, { selector: "option" });
  change("Existing medicine for source item", "medicine"); fireEvent.click(screen.getByRole("button", { name: "Use selected medicine" }));
}
async function reviewed() { await choose(); await match(); fireEvent.click(screen.getByRole("button", { name: "Preview purchase lines" })); await screen.findByRole("region", { name: "Purchase CSV preview" }); }
beforeEach(() => {
  vi.clearAllMocks(); Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(api.get).mockResolvedValue(response({ items: [product], nextCursor: null }));
  vi.mocked(api.post).mockImplementation(async url => response(String(url).endsWith("/inspect") ? inspection : preview));
  vi.mocked(api.put).mockReset().mockResolvedValue(response({ locationId: "branch", supplierId: "supplier", formatKey: inspection.formatKey, revision: 1 }));
});

it("maps exact columns and explicit medicines, reviews source amounts and applies without saving stock or money", async () => {
  const view = mount(); await reviewed();
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.post).toHaveBeenLastCalledWith("/pharmacy/purchase-csv/preview", expect.objectContaining({ locationId: "branch", mapping: Object.fromEntries(fields.map(field => [field, field])),
    matches: [{ sourceValue: "001", medicineId: "medicine", expectedUnitVersion: 2 }] }), expect.anything());
  expect(within(screen.getByRole("region", { name: "Purchase CSV preview" })).getByText(/1 box = 10 piece/)).toBeInTheDocument(); expect(screen.getByText(/Unused columns: Batch, Expiry/)).toBeInTheDocument();
  const apply = screen.getByRole("button", { name: "Add 1 CSV lines to draft" }); expect(apply).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(apply);
  expect(view.onApply).toHaveBeenCalledWith(preview.rows); expect(api.post).toHaveBeenCalledTimes(2); expect(api.put).not.toHaveBeenCalled();
});
it("invalidates the reviewed preview and confirmation when column mapping or a medicine changes", async () => {
  mount(); await reviewed(); fireEvent.click(screen.getByRole("checkbox"));
  change("Free packs", ""); expect(screen.queryByRole("region", { name: "Purchase CSV preview" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Preview purchase lines" })); await screen.findByRole("checkbox");
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  await match(); expect(screen.queryByRole("region", { name: "Purchase CSV preview" })).not.toBeInTheDocument();
});
it("sends the explicit price basis and invalidates the old per-unit preview when it changes", async () => {
  mount(); await reviewed(); fireEvent.click(screen.getByRole("checkbox"));
  change("CSV selling price / MRP basis", "pack");
  expect(screen.queryByRole("region", { name: "Purchase CSV preview" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Preview purchase lines" })); await screen.findByRole("region", { name: "Purchase CSV preview" });
  expect(api.post).toHaveBeenLastCalledWith("/pharmacy/purchase-csv/preview", expect.objectContaining({ priceBasis: "pack" }), expect.anything());
  expect(screen.getByRole("checkbox")).not.toBeChecked();
});
it("recovers a failed medicine lookup with an explicit retry", async () => {
  mount(); await choose(); vi.mocked(api.get).mockRejectedValueOnce(new Error("Search unavailable"));
  fireEvent.click(screen.getByRole("button", { name: "Match source item 1: 001" })); await screen.findByText("Search unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Retry medicine match search" }));
  await screen.findByText(/Cotton · Maker/, { selector: "option" });
  expect(screen.queryByText("Search unavailable")).not.toBeInTheDocument();
});
it("keeps invalid rows visible and prevents partial application", async () => {
  vi.mocked(api.post).mockImplementation(async url => response(String(url).endsWith("/inspect") ? inspection : { rows: [{ sourceLine: 2, sourceValue: "001", line: null, product: null, error: "GST needs an explicit value" }], ignoredColumns: [] }));
  const view = mount(); await reviewed();
  expect(screen.getByText("GST needs an explicit value")).toBeInTheDocument(); expect(screen.getByRole("checkbox")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Add 1 CSV lines to draft" })).toBeDisabled(); expect(view.onApply).not.toHaveBeenCalled();
});
it("shows preview failure without mutating the draft and supports an explicit retry", async () => {
  mount(); await choose(); await match(); vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { message: "Preview unavailable" } } });
  fireEvent.click(screen.getByRole("button", { name: "Preview purchase lines" })); await screen.findByText("Preview unavailable");
  expect(screen.queryByRole("button", { name: "Add 1 CSV lines to draft" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Preview purchase lines" })); await screen.findByRole("region", { name: "Purchase CSV preview" });
});
it("bounds line budget, rejects non-CSV/invalid UTF-8 before sending data and keeps quantities literal", async () => {
  mount(0);
  fireEvent.change(screen.getByLabelText("Supplier invoice CSV"), { target: { files: [file("invoice.xlsx")] } });
  await screen.findByText(/Choose a UTF-8 .csv file/); expect(api.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Supplier invoice CSV"), { target: { files: [file("invoice.csv", new Uint8Array([0xff]))] } });
  await screen.findByText("Save the file as UTF-8 CSV before importing."); expect(api.post).not.toHaveBeenCalled();
  await choose(); expect(screen.getByRole("button", { name: "Preview purchase lines" })).toBeDisabled();
});
it("ignores a late private file inspection after the editor closes", async () => {
  let finish!: (value: unknown) => void; vi.mocked(api.post).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = mount(); fireEvent.change(screen.getByLabelText("Supplier invoice CSV"), { target: { files: [file()] } });
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1)); view.unmount();
  await act(async () => finish(response(inspection))); expect(view.onApply).not.toHaveBeenCalled(); expect(screen.queryByText("invoice.csv · 1 lines")).not.toBeInTheDocument();
});
it("discards stale product matches as search text changes", async () => {
  mount(); await choose(); fireEvent.click(screen.getByRole("button", { name: "Match source item 1: 001" }));
  await screen.findByText(/Cotton · Maker/, { selector: "option" });
  change("Existing medicine for source item", "medicine");
  let finish!: (value: unknown) => void; vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  change("Search medicines for CSV match", "old"); await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  change("Search medicines for CSV match", "new");
  expect(screen.getByRole("button", { name: "Use selected medicine" })).toBeDisabled();
  await act(async () => finish(response({ items: [{ ...product, name: "Old match" }], nextCursor: null })));
  expect(screen.queryByText(/Old match/)).not.toBeInTheDocument();
});
it("refuses a preview whose product identity or stable references do not match the requested selection", async () => {
  const input = { locationId: "branch", supplierId: "supplier", csv: "source\n001", priceBasis: "base_unit" as const, mapping: {}, matches: [{ sourceValue: "001", medicineId: "medicine", expectedUnitVersion: 2 }] };
  for (const changed of [{ ...line, medicineId: "another" }, { ...line, lineId: "invalid!" }, { ...line, looseUnits: 10 }, { ...line, sellingPricePaise: 1201 }]) {
    vi.mocked(api.post).mockResolvedValueOnce(response({ ...preview, rows: [{ ...preview.rows[0], line: changed }] }));
    await expect(previewPurchaseCsv(input, new AbortController().signal)).rejects.toThrow();
  }
});
it("restores saved columns, pack-price basis and validated matches without repeating medicine searches", async () => {
  const profile = { revision: 4, mapping: Object.fromEntries(fields.map(field => [field, field])), priceBasis: "pack", matches: [{ sourceValue: "001", product: preview.rows[0].product, error: null }] };
  vi.mocked(api.post).mockImplementation(async url => response(String(url).endsWith("/inspect") ? { ...inspection, profile } : preview));
  mount(); await choose(); await screen.findByText(/Saved supplier format loaded/);
  expect(api.get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Preview purchase lines" })); await screen.findByRole("region", { name: "Purchase CSV preview" });
  expect(api.post).toHaveBeenLastCalledWith("/pharmacy/purchase-csv/preview", expect.objectContaining({ supplierId: "supplier", priceBasis: "pack", matches: [{ sourceValue: "001", medicineId: "medicine", expectedUnitVersion: 2, expectedIdentityHash: "a".repeat(64) }] }), expect.anything());
  expect(screen.getByRole("checkbox")).not.toBeChecked();
});
it("leaves stale saved identities unmatched and clearly asks for a new selection", async () => {
  const profile = { revision: 1, mapping: Object.fromEntries(fields.map(field => [field, field])), priceBasis: "base_unit", matches: [{ sourceValue: "001", product: null, error: "Saved pack changed; match this item again" }] };
  vi.mocked(api.post).mockImplementation(async url => response(String(url).endsWith("/inspect") ? { ...inspection, profile } : { rows: [{ sourceLine: 2, sourceValue: "001", line: null, product: null, error: "Choose a current medicine" }], ignoredColumns: [] }));
  mount(); await choose(); expect(screen.getByText("Saved pack changed; match this item again")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Preview purchase lines" })); await screen.findByText("Choose a current medicine");
  expect(api.post).toHaveBeenLastCalledWith("/pharmacy/purchase-csv/preview", expect.objectContaining({ matches: [] }), expect.anything());
  expect(screen.getByRole("button", { name: "Add 1 CSV lines to draft" })).toBeDisabled();
});
it("remembers only explicitly confirmed preview identities and does not save the purchase draft", async () => {
  const view = mount(); await reviewed();
  const remember = screen.getByRole("button", { name: "Remember mappings for this supplier" }); expect(remember).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(remember);
  await screen.findByText(/Mappings saved for this supplier and branch/);
  expect(api.put).toHaveBeenCalledWith("/pharmacy/purchase-csv/profile", expect.objectContaining({ locationId: "branch", supplierId: "supplier", confirmedMappings: true, expectedRevision: 0,
    matches: [{ sourceValue: "001", medicineId: "medicine", expectedUnitVersion: 2, expectedIdentityHash: "a".repeat(64) }] }));
  expect(view.onApply).not.toHaveBeenCalled(); expect(api.post).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Add 1 CSV lines to draft" })); expect(view.onApply).toHaveBeenCalledWith(preview.rows);
});
it("retries the same unconfirmed mapping save and keeps preview application available after a conflict", async () => {
  mount(); await reviewed(); fireEvent.click(screen.getByRole("checkbox"));
  vi.mocked(api.put).mockRejectedValueOnce(new Error("Connection lost"));
  fireEvent.click(screen.getByRole("button", { name: "Remember mappings for this supplier" })); await screen.findByText("Connection lost");
  const first = vi.mocked(api.put).mock.calls[0];
  vi.mocked(api.put).mockRejectedValueOnce({ response: { data: { message: "Saved mappings changed; choose the file again" } } });
  fireEvent.click(screen.getByRole("button", { name: "Remember mappings for this supplier" })); await screen.findByText("Saved mappings changed; choose the file again");
  expect(vi.mocked(api.put).mock.calls[1]).toEqual(first);
  expect(screen.getByRole("button", { name: "Add 1 CSV lines to draft" })).toBeEnabled();
});
it("sends the loaded mapping revision and does not announce an unexpected save revision as confirmed", async () => {
  const profile = { revision: 4, mapping: Object.fromEntries(fields.map(field => [field, field])), priceBasis: "base_unit", matches: [{ sourceValue: "001", product: preview.rows[0].product, error: null }] };
  vi.mocked(api.post).mockImplementation(async url => response(String(url).endsWith("/inspect") ? { ...inspection, profile } : preview));
  mount(); await choose(); fireEvent.click(screen.getByRole("button", { name: "Preview purchase lines" })); await screen.findByRole("checkbox"); fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Remember mappings for this supplier" }));
  await screen.findByText(/Supplier mapping save could not be confirmed/);
  expect(api.put).toHaveBeenCalledWith("/pharmacy/purchase-csv/profile", expect.objectContaining({ expectedRevision: 4 }));
  expect(screen.queryByText(/Mappings saved for this supplier and branch/)).not.toBeInTheDocument();
});
it("ignores a mapping save response after the editor leaves without cancelling or replaying its mutation", async () => {
  let finish!: (value: unknown) => void; vi.mocked(api.put).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = mount(); await reviewed(); fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Remember mappings for this supplier" }));
  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1)); view.unmount();
  await act(async () => finish(response({ locationId: "branch", supplierId: "supplier", formatKey: inspection.formatKey, revision: 1 })));
  expect(view.onApply).not.toHaveBeenCalled(); expect(api.put).toHaveBeenCalledTimes(1); expect(vi.mocked(api.put).mock.calls[0]).toHaveLength(2);
});
it("rejects saved profiles returned for another supplier and malformed saved medicine identities", async () => {
  vi.mocked(api.post).mockResolvedValueOnce(response({ ...inspection, supplierId: "another" }));
  await expect(inspectPurchaseCsv("branch", "supplier", "source\n001", new AbortController().signal)).rejects.toThrow();
  const profile = { revision: 1, mapping: { source: "source" }, priceBasis: "base_unit", matches: [{ sourceValue: "001", product: { ...product, identityHash: "invalid" }, error: null }] };
  vi.mocked(api.post).mockResolvedValueOnce(response({ ...inspection, profile }));
  await expect(inspectPurchaseCsv("branch", "supplier", "source\n001", new AbortController().signal)).rejects.toThrow();
});
