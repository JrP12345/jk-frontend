import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PharmacyReports } from "@/components/pharmacy/PharmacyReports";
import { ToastProvider } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { readPharmacyReport, downloadReport } from "@/lib/pharmacyReports";
import { reportFixture, stockReportRow } from "./fixtures/pharmacyReport";
const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
const response = (data: unknown) => ({ data: { data } }), filters = { locationId: "branch", limit: 25, days: 90 };
const mount = () => render(<ToastProvider><PharmacyReports locationId="branch" /></ToastProvider>);
const load = async () => { fireEvent.click(await screen.findByRole("button", { name: "Load report" })); return screen.findByRole("region", { name: "Reviewed report page" }); };
function select(label: string, value: string) { const control = screen.getByLabelText(label); fireEvent.change(control.getAttribute("role") === "combobox" ? document.getElementById(control.id.replace(/-trigger$/, ""))! : control, { target: { value } }); }
beforeEach(() => {
  useAuthStore.setState({ user: { id: "reporter", name: "Reporter", role: "stock", email: "reporter@example.test", organization_id: "org", permissions: ["PHARMACY_VIEW_REPORTS", "PHARMACY_VIEW_STOCK"] } });
  api.get.mockReset().mockImplementation(async (url: string, config: any) => url === "/pharmacy/reports" ? response({ locationId: "branch", items: [{ kind: "stock", label: "Stock and eligible units" }, { kind: "movements", label: "Stock movements" }] }) : response(reportFixture(url.endsWith("movements") ? "movements" : "stock", "branch", [stockReportRow], { ...config.params, cursor: config.params.cursor || null })));
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:reviewed-report"), revokeObjectURL: vi.fn() })); vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {}); Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("loads only allowed report choices and clearly labels source page scope and unknown cells", async () => {
  mount(); expect(await screen.findByLabelText("Operational report")).toBeInTheDocument(); expect(api.get).toHaveBeenCalledOnce(); const region = await load(); expect(within(region).getByText("Sample medicine")).toBeInTheDocument(); expect(within(region).getByText(/Amount subtotals cover this page only/)).toBeInTheDocument(); expect(screen.queryByText("Captured stock cost")).not.toBeInTheDocument();
});
it("clears stale rows when a filter changes and ignores an earlier slow report", async () => {
  let finish!: (value: unknown) => void; mount(); await load(); const original = api.get.getMockImplementation()!; api.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); fireEvent.click(screen.getByRole("button", { name: "Load report" })); await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3));
  select("Operational report", "movements"); expect(screen.queryByText("Sample medicine")).not.toBeInTheDocument(); await act(async () => { finish(response(reportFixture("stock"))); }); expect(screen.queryByText("Sample medicine")).not.toBeInTheDocument(); api.get.mockImplementation(original); await load(); expect(screen.getByText("Sample medicine")).toBeInTheDocument();
});
it("paginates source cursors and keeps a filtered empty page distinct from a complete empty result", async () => {
  const original = api.get.getMockImplementation()!; api.get.mockImplementation(async (url: string, config: any) => url === "/pharmacy/reports" ? original(url, config) : response(reportFixture("stock", "branch", config.params.cursor ? [{ ...stockReportRow, id: "later", product: "Later source product" }] : [], { scanned: 25, cursor: config.params.cursor || null, nextCursor: config.params.cursor ? null : "b".repeat(24) })));
  mount(); await load(); expect(screen.getByText("No matches on this source page. Continue to the next page.")).toBeInTheDocument(); fireEvent.click(screen.getByRole("button", { name: "Next report page" })); await screen.findByText("Later source product"); expect(api.get.mock.calls.at(-1)?.[1].params.cursor).toBe("b".repeat(24));
});
it("downloads only the reviewed page and checks the returned digest without another financial mutation", async () => {
  mount(); await load(); api.get.mockResolvedValueOnce({ data: new Blob(["source,amount\r\n"], { type: "text/csv" }), headers: { "content-type": "text/csv; charset=utf-8", "x-report-digest": "a".repeat(64) } }); fireEvent.click(screen.getByRole("button", { name: "Export reviewed page CSV" })); await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledOnce()); expect(api.get.mock.calls.at(-1)?.[1]).toMatchObject({ params: { ...filters, expectedDigest: "a".repeat(64) }, responseType: "blob" }); expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:reviewed-report");
});
it("shows a changed-source export rejection, keeps the reviewed data and permits refresh", async () => {
  mount(); await load(); api.get.mockRejectedValueOnce({ response: { data: { message: "Report changed; reload and review this page before exporting" } } }); fireEvent.click(screen.getByRole("button", { name: "Export reviewed page CSV" })); await screen.findByText("Report changed; reload and review this page before exporting"); expect(URL.createObjectURL).not.toHaveBeenCalled(); expect(screen.getByText("Sample medicine")).toBeInTheDocument();
});
it("ignores late export results after authorization changes", async () => {
  let finish!: (value: unknown) => void; mount(); await load(); api.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); fireEvent.click(screen.getByRole("button", { name: "Export reviewed page CSV" })); await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3)); act(() => useAuthStore.setState({ user: { ...useAuthStore.getState().user!, permissions: [] } }));
  await act(async () => { finish({ data: new Blob(["sensitive source"], { type: "text/csv" }), headers: { "content-type": "text/csv", "x-report-digest": "a".repeat(64) } }); }); expect(URL.createObjectURL).not.toHaveBeenCalled(); expect(screen.queryByText("Sample medicine")).not.toBeInTheDocument();
});
it("shows an access failure as unavailable and supports an explicit retry", async () => {
  api.get.mockRejectedValueOnce(new Error("Synthetic report access unavailable")); mount(); await screen.findByText("Synthetic report access unavailable"); expect(screen.queryByRole("button", { name: "Load report" })).not.toBeInTheDocument(); fireEvent.click(screen.getByRole("button", { name: "Recheck report access" })); await screen.findByRole("button", { name: "Load report" });
});
it("rejects mismatched scope, malformed columns and inconsistent monetary subtotals", async () => {
  api.get.mockResolvedValueOnce(response(reportFixture("stock", "other"))); await expect(readPharmacyReport("stock", filters)).rejects.toThrow(/branch/);
  api.get.mockResolvedValueOnce(response(reportFixture("stock", "branch", [stockReportRow], { columns: [{ key: "constructor", label: "Unsafe", format: "text" }] }))); await expect(readPharmacyReport("stock", filters)).rejects.toThrow(/column/);
  api.get.mockResolvedValueOnce(response(reportFixture("stock", "branch", [{ id: "value", amountPaise: 101 }], { columns: [{ key: "amountPaise", label: "Known value", format: "paise" }], totals: { amountPaise: 100 } }))); await expect(readPharmacyReport("stock", filters)).rejects.toThrow(/subtotal/);
  api.get.mockResolvedValueOnce({ data: new Blob(["not reviewed"]), headers: { "content-type": "text/csv", "x-report-digest": "b".repeat(64) } }); await expect(downloadReport(reportFixture("stock"), filters)).rejects.toThrow(/reviewed report/);
});
it("renders large exact paise and unknown costs without a floating-point cent loss or invented zero", async () => {
  api.get.mockImplementation(async (url: string) => url === "/pharmacy/reports" ? response({ locationId: "branch", items: [{ kind: "valuation", label: "Captured stock cost" }] }) : response(reportFixture("valuation", "branch", [{ id: "known", amountPaise: Number.MAX_SAFE_INTEGER }, { id: "unknown", amountPaise: null }], { columns: [{ key: "amountPaise", label: "Remaining cost (INR)", format: "paise" }], totals: { amountPaise: null } })));
  mount(); await load(); expect(screen.getByText("₹9,00,71,99,25,47,409.91")).toBeInTheDocument(); expect(screen.getAllByText("Needs review")).toHaveLength(2);
});
