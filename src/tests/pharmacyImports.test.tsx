import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import api from "@/lib/api";
import { PharmacyImports } from "@/components/pharmacy/PharmacyImports";
import { parseImportView, type ImportView } from "@/lib/pharmacyImports";
import { useAuthStore } from "@/store/authStore";

vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const locationId = "a".repeat(24), importId = "b".repeat(24);
const fields = ["sourceId", "name", "genericName", "category", "scheduleType", "baseUnit", "packUnit", "unitsPerPack", "sellingPrice"];
const response = (data: unknown) => ({ data: { data } });
function fixture(count = 1, posted = 0): ImportView {
  const rows = Array.from({ length: count }, (_, index) => ({ sourceLine: index + 2, sourceId: `source-${index}`, sourceKey: (index + 1).toString(16).padStart(64, "0"), fields: { sourceId: `source-${index}`, name: "Reviewed product" }, error: null }));
  return { id: importId, locationId, kind: "catalogue", digest: "d".repeat(64), fileHash: "e".repeat(64), sourceReference: "Actual source file", reviewReference: "Reviewed source count",
    rows, units: rows.map((row, index) => ({ sourceKey: row.sourceKey, sourceLines: [row.sourceLine], status: index < posted ? "posted" : "unprocessed", error: null, result: index < posted ? { medicineId: "f".repeat(24), stockQuantity: 0 } : null })),
    counts: { posted, invalid: 0, failed: 0, unprocessed: count - posted }, totals: { basis: "valid_preview_rows", validRows: count, invalidRows: 0, acquisitionPaise: 0, duesPaise: 0, baseQuantities: [] } };
}
function sourceFile(bytes?: Uint8Array) {
  const text = fields.join(",") + "\n001,Product,Formulation,tablet,general,tablet,strip,10,0.29";
  const file = new File(["source"], "actual-source.csv", { type: "text/csv" });
  Object.defineProperty(file, "arrayBuffer", { value: async () => (bytes || new TextEncoder().encode(text)).buffer });
  return file;
}
beforeEach(() => {
  vi.clearAllMocks(); Element.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: "owner", name: "Owner", email: "owner@example.test", role: "admin", organization_id: "org", permissions: ["MANAGE_ORGANIZATION"] } });
  vi.mocked(api.get).mockResolvedValue(response({ items: [], nextCursor: null }));
  vi.mocked(api.post).mockImplementation(async url => response(String(url).endsWith("/inspect") ? { headers: fields, fields, optionalFields: [], rowCount: 1 } : fixture()));
});
async function reviewed() {
  fireEvent.change(screen.getByLabelText("UTF-8 source CSV"), { target: { files: [sourceFile()] } });
  await screen.findByText("actual-source.csv: 1 source rows.");
  fireEvent.change(screen.getByLabelText("Actual source/count reference *"), { target: { value: "Actual source file" } });
  fireEvent.change(screen.getByLabelText("Source review reference *"), { target: { value: "Reviewed source count" } });
  fireEvent.click(screen.getByRole("button", { name: "Preview source import" }));
  await screen.findByRole("button", { name: /Post next/ });
}
const renderImport = () => render(<PharmacyImports locationId={locationId} allowedKinds={["catalogue"]} onCommitted={vi.fn()} />);

it("requires review and explicit confirmation before posting only the server-selected source keys", async () => {
  renderImport(); await reviewed();
  expect(api.post).toHaveBeenCalledTimes(2);
  const post = screen.getByRole("button", { name: "Post next 1 source units" }); expect(post).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  vi.mocked(api.post).mockResolvedValueOnce(response(fixture(1, 1))); fireEvent.click(post);
  await screen.findByText(/1 posted, 0 invalid/);
  expect(api.post).toHaveBeenLastCalledWith(`/pharmacy/imports/${importId}/commit`, { locationId, expectedDigest: "d".repeat(64), sourceKeys: [fixture().units[0].sourceKey], confirmedSource: true }, expect.anything());
  expect(screen.getByRole("button", { name: "Post next 0 source units" })).toBeDisabled();
});
it("keeps the reviewed source after an uncertain post and retries identical source identities", async () => {
  renderImport(); await reviewed(); fireEvent.click(screen.getByRole("checkbox"));
  vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { message: "Source result uncertain; check the saved import" } } });
  fireEvent.click(screen.getByRole("button", { name: "Post next 1 source units" })); await screen.findByText("Source result uncertain; check the saved import");
  const original = vi.mocked(api.post).mock.calls[2][1];
  vi.mocked(api.post).mockResolvedValueOnce(response(fixture(1, 1))); fireEvent.click(screen.getByRole("button", { name: "Post next 1 source units" }));
  await screen.findByText(/1 posted, 0 invalid/); expect(vi.mocked(api.post).mock.calls[3][1]).toEqual(original);
});
it("posts at most ten units and leaves remaining sources explicit for the next chunk", async () => {
  vi.mocked(api.post).mockImplementation(async url => response(String(url).endsWith("/inspect") ? { headers: fields, fields, optionalFields: [], rowCount: 1 } : fixture(11)));
  renderImport(); await reviewed(); fireEvent.click(screen.getByRole("checkbox"));
  vi.mocked(api.post).mockResolvedValueOnce(response(fixture(11, 10))); fireEvent.click(screen.getByRole("button", { name: "Post next 10 source units" }));
  await screen.findByText(/10 posted, 0 invalid, 0 failed or needing review, 1 unprocessed/);
  expect((vi.mocked(api.post).mock.calls[2][1] as { sourceKeys: string[] }).sourceKeys).toHaveLength(10);
  vi.mocked(api.post).mockResolvedValueOnce(response(fixture(11, 11))); fireEvent.click(screen.getByRole("button", { name: "Post next 1 source units" }));
  await screen.findByText(/11 posted/); expect((vi.mocked(api.post).mock.calls[3][1] as { sourceKeys: string[] }).sourceKeys).toEqual([fixture(11).units[10].sourceKey]);
});
it("recovers an existing actor-bound manifest after reload through saved history", async () => {
  vi.mocked(api.get).mockImplementation(async url => response(String(url).includes(`/imports/${importId}`) ? fixture(1, 1) : { items: [{ id: importId, kind: "catalogue", createdAt: "2026-10-21T12:00:00Z" }], nextCursor: null }));
  renderImport();
  fireEvent.click(await screen.findByRole("button", { name: /Empty catalogue products/ }));
  await screen.findByText(/1 posted, 0 invalid/); expect(api.post).not.toHaveBeenCalled();
  expect(api.get).toHaveBeenCalledWith(`/pharmacy/imports/${importId}?locationId=${locationId}`, expect.anything());
});
it("discards a late private preview on branch changes", async () => {
  let finish!: (value: ReturnType<typeof response>) => void;
  vi.mocked(api.post).mockImplementation(async url => String(url).endsWith("/inspect") ? response({ headers: fields, fields, optionalFields: [], rowCount: 1 }) : new Promise(resolve => { finish = resolve; }));
  const view = renderImport();
  fireEvent.change(screen.getByLabelText("UTF-8 source CSV"), { target: { files: [sourceFile()] } }); await screen.findByText("actual-source.csv: 1 source rows.");
  fireEvent.change(screen.getByLabelText("Actual source/count reference *"), { target: { value: "Actual source file" } }); fireEvent.change(screen.getByLabelText("Source review reference *"), { target: { value: "Reviewed source count" } });
  fireEvent.click(screen.getByRole("button", { name: "Preview source import" })); await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  view.rerender(<PharmacyImports locationId={"c".repeat(24)} allowedKinds={["catalogue"]} onCommitted={vi.fn()} />);
  await act(async () => finish(response(fixture())));
  expect(screen.queryByRole("button", { name: /Post next/ })).not.toBeInTheDocument(); expect(screen.getByLabelText("Actual source/count reference *")).toHaveValue("");
});
it("clears the previous valid file before rejecting invalid UTF-8 or an oversized replacement", async () => {
  renderImport(); fireEvent.change(screen.getByLabelText("UTF-8 source CSV"), { target: { files: [sourceFile()] } }); await screen.findByText("actual-source.csv: 1 source rows.");
  fireEvent.change(screen.getByLabelText("UTF-8 source CSV"), { target: { files: [sourceFile(new Uint8Array([0xff, 0xff]))] } });
  await screen.findByText("Save the source as UTF-8 CSV before importing."); expect(screen.queryByText("actual-source.csv: 1 source rows.")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Preview source import" })).toBeDisabled();
});
it("shows export failure without losing source review or starting another posting", async () => {
  renderImport(); await reviewed(); vi.mocked(api.get).mockRejectedValueOnce({ response: { data: { message: "Import export permission changed" } } });
  fireEvent.click(screen.getByRole("button", { name: "Download reconciliation CSV" }));
  await screen.findByText("Import export permission changed"); expect(screen.getByText("Actual source file")).toBeInTheDocument(); expect(api.post).toHaveBeenCalledTimes(2);
});
it("rejects branch mismatches, missing units and inconsistent reconciliation counts", () => {
  expect(() => parseImportView({ ...fixture(), locationId: "c".repeat(24) }, locationId)).toThrow();
  expect(() => parseImportView({ ...fixture(), units: [] }, locationId)).toThrow();
  expect(() => parseImportView({ ...fixture(), counts: { posted: 1, invalid: 0, failed: 0, unprocessed: 1 } }, locationId)).toThrow();
});
