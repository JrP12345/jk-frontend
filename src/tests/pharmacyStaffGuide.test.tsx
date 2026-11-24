import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PharmacyStaffGuide } from "@/components/pharmacy/PharmacyStaffGuide";
import { pharmacyActions, type PharmacyCapabilities } from "@/lib/pharmacyCapabilities";
import { pharmacyStaffGuideText } from "@/lib/pharmacyStaffGuide";
const capabilities = (actions: Partial<PharmacyCapabilities["actions"]> = {}, mode: "tracked" | "billing_only" = "tracked"): PharmacyCapabilities => ({ locationId: "branch", organizationId: "org", enabled: true, moduleEnabled: true, mode: "configured", inventoryMode: mode, revision: 1, actions: { ...Object.fromEntries(pharmacyActions.map(action => [action, false])) as Record<typeof pharmacyActions[number], boolean>, ...actions } });
afterEach(() => vi.restoreAllMocks());
function openGuide() { fireEvent.click(screen.getByText("First-day and daily staff guide")); return screen.getByRole("region", { name: "Pharmacy daily staff guide" }); }

it("guides a cashier to the permitted counter and preserves original-save and restricted-supply boundaries", () => {
  const navigate = vi.fn(); render(<PharmacyStaffGuide capabilities={capabilities({ sell: true, collect: true, viewTill: true })} onNavigate={navigate} />);
  const guide = openGuide(); fireEvent.click(within(guide).getByText("Busy counter: five medicines and three loose tablets"));
  expect(within(guide).getByText(/exactly three loose units/)).toBeInTheDocument(); expect(within(guide).getByText(/uploaded file alone does not authorize/)).toBeInTheDocument();
  expect(within(guide).getByText(/keep the cart and original pending reference/)).toBeInTheDocument();
  fireEvent.click(within(guide).getByRole("button", { name: "Open Counter sale" })); expect(navigate).toHaveBeenCalledExactlyOnceWith("counter");
  expect(within(guide).queryByText(/review 50 medicines/)).not.toBeInTheDocument(); expect(within(guide).queryByText(/owner's 10 PM/)).not.toBeInTheDocument();
  fireEvent.click(within(guide).getByText("Internet failure: recover safely")); expect(within(guide).getByText(/Shared LAN offline billing across two counters is not available/)).toBeInTheDocument();
});
it("routes authorized supplier-return operators to source-based finance preparation", () => {
  const navigate = vi.fn(); render(<PharmacyStaffGuide capabilities={capabilities({ viewStock: true, viewPurchases: true, processReturn: true, viewReports: true })} onNavigate={navigate} />);
  const guide = openGuide(); fireEvent.click(within(guide).getByText("Expiry return: 20 strips across three suppliers"));
  fireEvent.click(within(guide).getByRole("button", { name: "Open Finance & dues" })); expect(navigate).toHaveBeenCalledExactlyOnceWith("finance");
  expect(within(guide).getByText(/packing draft does not move goods/)).toBeInTheDocument(); fireEvent.click(within(guide).getByText("End of day: the owner's 10 PM check"));
  expect(within(guide).getByText(/It is not net profit/)).toBeInTheDocument(); expect(within(guide).getByText(/older debt is a collection today/)).toBeInTheDocument();
});
it("keeps stock-only guidance read-only and does not link to purchase-return authority", () => {
  const navigate = vi.fn(); render(<PharmacyStaffGuide capabilities={capabilities({ viewStock: true })} onNavigate={navigate} />); const guide = openGuide();
  fireEvent.click(within(guide).getByText("Expiry return: 20 strips across three suppliers")); expect(within(guide).getByText(/does not grant return access/)).toBeInTheDocument();
  expect(within(guide).queryByRole("button", { name: "Open Finance & dues" })).not.toBeInTheDocument(); fireEvent.click(within(guide).getByRole("button", { name: "Open Alerts" })); expect(navigate).toHaveBeenCalledExactlyOnceWith("alerts");
});
it("does not promise tracked quantities or expiry receiving in a billing-only branch", () => {
  const config = capabilities({ sell: true, collect: false, viewPurchases: true, viewReports: true }, "billing_only"); render(<PharmacyStaffGuide capabilities={config} onNavigate={vi.fn()} />); const guide = openGuide();
  fireEvent.click(within(guide).getByText("Busy counter: five medicines and three loose tablets")); expect(within(guide).getByText(/does not track stock or batches/)).toBeInTheDocument(); expect(within(guide).getByText(/billing access does not grant collection access/)).toBeInTheDocument();
  expect(within(guide).queryByText(/20 strips across three suppliers/)).not.toBeInTheDocument();
  const text = pharmacyStaffGuideText(config); expect(text).toContain("no stock balance is claimed"); expect(text).not.toContain("enter stock once"); expect(text).not.toContain("20 strips");
});
it("removes new-sale instructions on disablement or permission change while retaining relevant read guidance", () => {
  const config = capabilities({ sell: true, viewReports: true }); const view = render(<PharmacyStaffGuide capabilities={config} onNavigate={vi.fn()} />); openGuide();
  view.rerender(<PharmacyStaffGuide capabilities={{ ...config, enabled: false }} onNavigate={vi.fn()} />); expect(screen.queryByText(/Busy counter:/)).not.toBeInTheDocument();
  expect(screen.getByText(/owner's 10 PM check/)).toBeInTheDocument(); view.rerender(<PharmacyStaffGuide capabilities={capabilities()} onNavigate={vi.fn()} />); expect(screen.queryByText("First-day and daily staff guide")).not.toBeInTheDocument();
});
it("downloads a compact role-specific checklist without clinical or branch identifiers", async () => {
  vi.useFakeTimers();
  const create = vi.fn().mockReturnValue("blob:staff-guide"), click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const original = URL.createObjectURL, originalRevoke = URL.revokeObjectURL, revoke = vi.fn(); Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create }); Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
  try { render(<PharmacyStaffGuide capabilities={capabilities({ viewReports: true })} onNavigate={vi.fn()} />); openGuide(); fireEvent.click(screen.getByRole("button", { name: "Download your daily staff guide" })); expect(click).toHaveBeenCalledOnce(); expect(create).toHaveBeenCalledOnce(); const text = pharmacyStaffGuideText(capabilities({ viewReports: true })); expect(text).toContain("DAILY STAFF CHECKLIST"); expect(text).not.toContain("branch\""); expect(text).not.toContain("Busy counter"); expect(text).not.toContain("Internet failure"); expect(text.split(/\s+/).length).toBeLessThan(400); }
  finally { vi.runOnlyPendingTimers(); expect(revoke).toHaveBeenCalledWith("blob:staff-guide"); vi.useRealTimers(); Object.defineProperty(URL, "createObjectURL", { configurable: true, value: original }); Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevoke }); }
});
