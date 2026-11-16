import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { usePharmacyCatalogueSync } from "@/hooks/usePharmacyCatalogueSync";
import { createPharmacyBranchCatalogue } from "@/lib/pharmacyBranchCatalogue";
import { createPharmacyCatalogue } from "@/lib/pharmacyCatalogue";
import { clearPharmacyDrafts } from "@/lib/pharmacyDrafts";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
const product = { id: "000000000000000000000001", name: "Offline-only discovery", genericName: "Synthetic", stockQuantity: 5, eligible: true, retailPricePaise: 1500, barcodes: ["000123"], unitDefinition: { version: 1, baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10 } };
const page = { version: 1, locationId: "branch", after: null, through: product.id, hash: "a".repeat(64), count: 1, nextCursor: null, items: [product] };
const response = (data: unknown) => ({ data: { data } });
function Workspace({ online = true }: { online?: boolean }) {
  const scope = authScopeKey(useAuthStore(state => state.user)), [catalogue] = useState(() => createPharmacyCatalogue(scope, "branch"));
  const sync = usePharmacyCatalogueSync(scope, "branch", catalogue, online), [quantity, setQuantity] = useState(1);
  return <><button onClick={() => setQuantity(n => n + 1)}>Quantity {quantity}</button><button onClick={() => { void sync.refresh(); }}>Update catalogue</button><p>{sync.busy ? "Preparing" : sync.status.complete ? `Cached ${sync.status.count}` : "Recent only"}</p><p>{catalogue.find("Offline-only").items[0]?.name}</p></>;
}
beforeEach(async () => {
  vi.stubGlobal("indexedDB", undefined); sessionStorage.clear(); await clearPharmacyDrafts();
  useAuthStore.setState({ user: { id: "seller", name: "Seller", email: "seller@example.test", role: "seller", organization_id: "org", permissions: ["PHARMACY_SELL"] } });
  api.get.mockReset().mockResolvedValue(response(page));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("refreshes catalogue preparation independently of cart editing and uses the branch cache for discovery", async () => {
  let finish!: (value: unknown) => void; api.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<Workspace />); await act(async () => {}); fireEvent.click(screen.getByRole("button", { name: "Update catalogue" }));
  await screen.findByText("Preparing"); fireEvent.click(screen.getByRole("button", { name: "Quantity 1" })); expect(screen.getByRole("button", { name: "Quantity 2" })).toBeEnabled();
  await act(async () => { finish(response(page)); }); await screen.findByText("Cached 1"); expect(screen.getByText(product.name)).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith("/pharmacy/sales/catalogue?locationId=branch", expect.objectContaining({ signal: expect.any(AbortSignal) }));
});

it("cancels a late refresh on leaving the workspace without publishing a partial catalogue", async () => {
  let finish!: (value: unknown) => void; api.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const scope = authScopeKey(useAuthStore.getState().user), view = render(<Workspace />); await act(async () => {});
  fireEvent.click(screen.getByRole("button", { name: "Update catalogue" })); await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  const signal = api.get.mock.calls[0][1].signal; view.unmount(); expect(signal.aborted).toBe(true);
  await act(async () => { finish(response(page)); });
  const restored = createPharmacyBranchCatalogue(scope, "branch"); await restored.load(); expect(restored.status.complete).toBe(false);
});

it("does not start catalogue requests while offline", async () => {
  render(<Workspace online={false} />); await act(async () => {}); fireEvent.click(screen.getByRole("button", { name: "Update catalogue" }));
  expect(api.get).not.toHaveBeenCalled(); expect(screen.getByText("Recent only")).toBeInTheDocument();
});
