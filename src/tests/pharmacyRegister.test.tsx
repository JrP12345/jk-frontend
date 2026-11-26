import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PharmacyRegister } from "@/components/pharmacy/PharmacyRegister";
import { readRegister, registerCsv, type RegisterEntry } from "@/lib/pharmacyRegister";
import { useAuthStore } from "@/store/authStore";
import { ToastProvider } from "@/components/ui";
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
const locationId = "111111111111111111111111", entry = () => ({ _id: "222222222222222222222222", organizationId: "333333333333333333333333", locationId, medicineName: "Test H1 medicine", scheduleType: "schedule_h1", batchNumber: "BATCH-1", quantityDispensed: 3, dispensedAt: "2026-11-23T10:00:00Z", patientName: "Test recipient", patientAddress: "Test address", doctorName: "Test prescriber", doctorRegNumber: "REG-1", requiresReview: true, missingEvidence: ["doctorAddress"] });
const page = () => ({ data: { data: [entry()], pagination: { total: 1, page: 1, limit: 25, totalPages: 1 } } });
beforeEach(() => {
  useAuthStore.setState({ user: { id: "pharmacist", role: "pharmacist", name: "Reader", email: "reader@example.test", organization_id: "org", permissions: ["PHARMACY_EXPORT_REGISTER"] } });
  api.get.mockReset().mockImplementation(async (url: string) => url.includes("/export?") ? { data: { data: { locationId, scheduleType: "schedule_h1", generatedAt: "2026-11-23T11:00:00Z", filters: { startDate: null, endDate: null, search: "" }, totalRecords: 1, records: [entry()] } } } : page()); api.post.mockReset();
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:register"), revokeObjectURL: vi.fn() })); vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {}); Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const mount = (canExport = true) => render(<ToastProvider><PharmacyRegister locationId={locationId} canExport={canExport} /></ToastProvider>);
const load = async () => { fireEvent.click(screen.getByRole("button", { name: "Load register" })); return screen.findByRole("region", { name: "Reviewed register page" }); };
it("does not automatically read patient records and flags missing captured evidence", async () => {
  mount(); expect(api.get).not.toHaveBeenCalled(); await load(); expect(screen.getByText("Test H1 medicine")).toBeInTheDocument(); expect(screen.getByText(/Recipient: Test recipient/)).toBeInTheDocument(); expect(screen.getByText("Captured evidence needs review")).toBeInTheDocument(); expect(screen.getByText("Missing: Prescriber address")).toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
});
it("exports all matching records only after review and does not confuse a page with a full export", async () => {
  mount(); await load(); const button = screen.getByRole("button", { name: "Export all matching register records" }); expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(button); await screen.findByText(/Exported 1 records matching these filters/); expect(api.get.mock.calls[1][0]).toContain("/export?"); expect(URL.createObjectURL).toHaveBeenCalledOnce(); expect(api.post).not.toHaveBeenCalled();
});
it("clears patient records and export review immediately on filter changes", async () => {
  mount(); await load(); fireEvent.click(screen.getByRole("checkbox")); fireEvent.change(screen.getByLabelText("Search medicine, recipient, prescriber or batch"), { target: { value: "Other" } }); expect(screen.queryByText("Test H1 medicine")).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Export all matching register records" })).not.toBeInTheDocument(); expect(api.get).toHaveBeenCalledOnce();
});
it("does not expose export controls to a read-only register user", async () => { mount(false); await load(); expect(screen.queryByRole("checkbox")).not.toBeInTheDocument(); });
it("discards a slow read after branch or authority changes", async () => {
  let finish!: (value: unknown) => void; api.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); const view = mount(); fireEvent.click(screen.getByRole("button", { name: "Load register" })); view.rerender(<ToastProvider><PharmacyRegister locationId="444444444444444444444444" canExport /></ToastProvider>); await act(async () => finish(page())); expect(screen.queryByText("Test H1 medicine")).not.toBeInTheDocument();
});
it.each(["branch", "schedule", "quantity", "count", "review", "duplicates"])("refuses malformed %s register responses", async reason => {
  const result = page(); if (reason === "branch") result.data.data[0].locationId = "other"; if (reason === "schedule") result.data.data[0].scheduleType = "schedule_h"; if (reason === "quantity") result.data.data[0].quantityDispensed = -1; if (reason === "count") result.data.pagination.total = 10; if (reason === "review") result.data.data[0].requiresReview = false; if (reason === "duplicates") { result.data.data.push(result.data.data[0]); result.data.pagination.total = 2; }
  api.get.mockResolvedValue(result); await expect(readRegister({ locationId, scheduleType: "schedule_h1", startDate: "", endDate: "", search: "" }, 1)).rejects.toThrow(/could not be verified/);
});
it("keeps full evidence columns and makes spreadsheet formula content inert", () => {
  const value = { ...entry(), patientName: '=HYPERLINK("https://example.test")', doctorName: "\t=1+1", externalPrescriptionId: "source-reference" } as RegisterEntry;
  const csv = registerCsv([value]); expect(csv).toContain('"externalPrescriptionId"'); expect(csv).toContain('"source-reference"'); expect(csv).toContain('"\'=HYPERLINK('); expect(csv).toContain('"\'\t=1+1"'); expect(csv).toContain('"doctorAddress"');
});
it("applies selected range dates cleanly from the shared range picker", async () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: /^Register dates/ }));
  const dialog = screen.getByRole("dialog", { name: "Choose Register dates" });
  const pick = (value: string) => {
    const target = new Date(`${value}T12:00:00`);
    const name = target.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    for (let attempt = 0; attempt < 36 && !within(dialog).queryByRole("button", { name, exact: true }); attempt++) {
      const day = within(dialog).getAllByRole("button").find(button => /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),/.test(button.getAttribute("aria-label") || ""));
      const displayed = new Date(day!.getAttribute("aria-label")!);
      fireEvent.click(within(dialog).getByRole("button", { name: target < displayed ? "Previous Month" : "Next Month" }));
    }
    fireEvent.click(within(dialog).getByRole("button", { name, exact: true }));
  };
  pick("2026-11-01");
  pick("2026-11-20");
  await load();
  expect(api.get.mock.calls[0][0]).toContain("startDate=2026-11-01");
  expect(api.get.mock.calls[0][0]).toContain("endDate=2026-11-20");
});
