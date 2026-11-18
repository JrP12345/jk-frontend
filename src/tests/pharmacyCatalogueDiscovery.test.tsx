import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PharmacyCatalogueDiscovery } from "@/components/pharmacy/PharmacyCatalogueDiscovery";
import { datePickerInput } from "./datePickerTestUtils";

vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const id = "a".repeat(24), medicineId = "b".repeat(24), locationId = "c".repeat(24);
const reference = { id, name: "Synthetic reference", genericName: "Synthetic salt", composition: "Salt", strength: "500 mg", dosageForm: "Tablet", manufacturer: "Synthetic maker", packSize: "10 tablets", barcodes: ["000123456"], provider: "reviewed", sourceId: "TEST-ONLY", release: "synthetic", revision: 2, alreadyAdded: false };
const medicine = { id: medicineId, name: reference.name, price: 1.29, unitDefinition: { version: 1, baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10 } };
const response = (data: unknown) => ({ data: { data } });
beforeEach(() => {
  vi.clearAllMocks(); Element.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: "operator", name: "Owner", email: "owner@example.test", role: "admin", organization_id: "org", permissions: ["MANAGE_ORGANIZATION"] } });
  vi.mocked(api.get).mockResolvedValue(response({ items: [reference], nextCursor: null, sourceNotice: "Rights-reviewed fixture only" }));
  vi.mocked(api.post).mockResolvedValue(response({ medicine, reused: false }));
});
const mount = () => { const onAdded = vi.fn(), onCreateLocal = vi.fn(); render(<PharmacyCatalogueDiscovery locationId={locationId} onClose={vi.fn()} onAdded={onAdded} onCreateLocal={onCreateLocal} />); return { onAdded, onCreateLocal }; };
function change(label: string, value: string) {
  const control = screen.getByLabelText(label), input = control.getAttribute("aria-haspopup") === "dialog" ? datePickerInput(control) : control.getAttribute("role") === "combobox" ? document.getElementById(control.id.replace(/-trigger$/, ""))! : control;
  fireEvent.change(input, { target: { value } });
}
it("adds only after explicit identity, pack and branch-price confirmation; sends no inventory facts", async () => {
  const view = mount(); fireEvent.click(await screen.findByRole("button", { name: "Review & add" }));
  change("Medicine form", "tablet"); change("Base unit", "tablet"); change("Pack unit", "strip"); change("Base units per pack", "10"); change("Branch selling price per base unit (INR)", "1.29");
  expect(screen.getByRole("button", { name: "Add empty product" })).toBeDisabled(); expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Add empty product" }));
  await waitFor(() => expect(view.onAdded).toHaveBeenCalledWith(medicine));
  expect(api.post).toHaveBeenCalledWith(`/pharmacy/catalogue/global/${id}/adopt`, { locationId, expectedRevision: 2, category: "tablet", unitDefinition: { baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10 }, sellingPricePaise: 129, confirmedIdentity: true });
});
it("reuses already linked products without asking to overwrite branch prices", async () => {
  vi.mocked(api.get).mockResolvedValue(response({ items: [{ ...reference, alreadyAdded: true }], nextCursor: null }));
  const view = mount(); fireEvent.click(await screen.findByRole("button", { name: "Use branch product" }));
  expect(screen.queryByLabelText("Branch selling price per base unit (INR)")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Use existing branch product" }));
  await waitFor(() => expect(view.onAdded).toHaveBeenCalled()); expect(api.post).toHaveBeenCalledWith(expect.any(String), { locationId, expectedRevision: 2, confirmedIdentity: true });
});
it("captures actual printed supply evidence for billing-only branches without creating stock", async () => {
  const onAdded = vi.fn(); render(<PharmacyCatalogueDiscovery locationId={locationId} inventoryMode="billing_only" onClose={vi.fn()} onAdded={onAdded} />);
  fireEvent.click(await screen.findByRole("button", { name: "Review & add" }));
  change("Medicine form", "tablet"); change("Base unit", "tablet"); change("Pack unit", "strip"); change("Base units per pack", "10"); change("Branch selling price per base unit (INR)", "1.29");
  change("Printed batch number", "ACTUAL-PRINTED-1"); change("Printed expiry month", "2099-12"); change("Printed MRP per base unit (INR)", "2.00");
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Add empty product" }));
  await waitFor(() => expect(onAdded).toHaveBeenCalled());
  expect(api.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ billingSupply: { batchNumber: "ACTUAL-PRINTED-1", expiry: { precision: "month", value: "2099-12" }, mrpPaise: 200 } }));
  expect(vi.mocked(api.post).mock.calls[0][1]).not.toHaveProperty("stockQuantity");
});
it("keeps source failure visible and preserves local creation fallback", async () => {
  vi.mocked(api.get).mockRejectedValue(new Error("Provider unavailable")); const view = mount();
  await screen.findByText("Provider unavailable"); fireEvent.click(screen.getByRole("button", { name: "Create local medicine instead" })); expect(view.onCreateLocal).toHaveBeenCalled(); expect(api.post).not.toHaveBeenCalled();
});
it("credits CDCI and labels its supplier separately without inventing a manufacturer or pack conversion", async () => {
  vi.mocked(api.get).mockResolvedValue(response({ items: [{ ...reference, provider: "cdci", manufacturer: "", supplierName: "Source supplier only", packSize: "" }], nextCursor: null }));
  mount(); await screen.findByText("Source supplier: Source supplier only");
  expect(screen.getByRole("link", { name: "Common Drug Codes for India, NRCeS / C-DAC Pune" })).toHaveAttribute("href", "https://www.nrces.in/services/national-releases");
  fireEvent.click(screen.getByRole("button", { name: "Review & add" }));
  expect(screen.getByText(/Confirm the actual manufacturer/)).toBeInTheDocument();
  expect(screen.getByLabelText("Base units per pack")).toHaveValue(null);
  expect(screen.getByRole("link", { name: "CC BY 4.0" })).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/");
  expect(api.post).not.toHaveBeenCalled();
});
it("does not use a search response that arrives after the query changed", async () => {
  let resolveOld!: (value: unknown) => void;
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })); mount();
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  change("Search brand, generic, salt, manufacturer or barcode", "000123456");
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  await act(async () => resolveOld(response({ items: [{ ...reference, name: "Wrong stale result" }], nextCursor: null })));
  expect(screen.queryByText("Wrong stale result")).not.toBeInTheDocument(); expect(String(vi.mocked(api.get).mock.calls[1][0])).toContain("barcode=000123456");
});
