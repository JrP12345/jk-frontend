import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import api from "@/lib/api";
import { ProductQuotePanel } from "@/components/billing/ProductQuotePanel";
import { billingService } from "@/services/billing.service";
import { useAuthStore } from "@/store/authStore";

vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const response = (data: unknown) => ({ data: { data } });
const productPlan = { id: "product-plan", name: "Location products", commercialFamily: "location_products", commercialPricing: { revision: 3 } };
const quote = () => ({ version: 1, organizationId: "org-a", planId: "product-plan", billingCycle: "monthly", fingerprint: "a".repeat(64), currency: "INR", purchaseAvailable: true, quoteToken: "enc:v1:reviewed-fixture",
  expiresAt: new Date(Date.now() + 15 * 60000).toISOString(), subtotalPaise: 139700, taxPaise: 0, totalPaise: 139700,
  lines: [{ id: "clinic:a", kind: "clinic", quantity: 1, amountPaise: 79900 }, { id: "addon:a", kind: "pharmacy_addon", quantity: 1, amountPaise: 29900 }, { id: "doctor", kind: "extra_doctor", quantity: 1, amountPaise: 29900 }],
  entitlements: { maxLocations: 1, maxDoctors: 2, maxStaff: 5 } });
async function chooseProduct(label: string) {
  fireEvent.click(await screen.findByRole("combobox", { name: "Products for Existing clinic" }));
  fireEvent.click(await screen.findByRole("option", { name: label, exact: true }));
}
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: { id: "admin", name: "Administrator", email: "admin@example.test", role: "admin", organization_id: "org-a", permissions: ["MANAGE_ORGANIZATION"] } });
  vi.mocked(api.get).mockImplementation(async url => response(String(url).includes("/billing/plans") ? [productPlan] : [{ id: "location-a", name: "Existing clinic" }]));
  vi.mocked(api.post).mockResolvedValue(response(quote()));
  Element.prototype.scrollIntoView = vi.fn();
});
it("previews a single-location clinic/pharmacy selection with server totals and no activation", async () => {
  render(<ProductQuotePanel />); await chooseProduct("Clinic and pharmacy at this location");
  fireEvent.change(screen.getByLabelText("Required doctor seats"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Preview product quote" }));
  await screen.findByRole("region", { name: "Product quote" });
  expect(api.post).toHaveBeenCalledWith("/billing/quote?organizationId=org-a", { planId: "product-plan", priceRevision: 3, billingCycle: "monthly", doctorSeats: 2,
    locations: [{ locationId: "location-a", clinic: true, pharmacy: true }] });
  expect(screen.getByText(/Total:.*1,397/)).toBeInTheDocument();
  expect(screen.getByText(/Review the total before checkout/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Pay|Activate|Buy/ })).not.toBeInTheDocument();
  expect(api.post).toHaveBeenCalledTimes(1);
});
it("requires an explicit product selection and clears a quote when its selection changes", async () => {
  render(<ProductQuotePanel />); await screen.findByRole("button", { name: "Preview product quote" });
  fireEvent.click(screen.getByRole("button", { name: "Preview product quote" }));
  expect(await screen.findByText(/Select products for your locations/)).toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
  await chooseProduct("Standalone pharmacy"); fireEvent.click(screen.getByRole("button", { name: "Preview product quote" }));
  await screen.findByRole("region", { name: "Product quote" });
  fireEvent.change(screen.getByLabelText("Required doctor seats"), { target: { value: "3" } });
  expect(screen.queryByRole("region", { name: "Product quote" })).not.toBeInTheDocument();
});
it("retains selections after a stale-price conflict and never retries a charge", async () => {
  vi.mocked(api.post).mockRejectedValue({ response: { status: 409, data: { message: "Commercial prices changed; reload the catalogue" } } });
  render(<ProductQuotePanel />); await chooseProduct("Standalone pharmacy");
  fireEvent.click(screen.getByRole("button", { name: "Preview product quote" }));
  await screen.findByText("Commercial prices changed; reload the catalogue");
  expect(screen.getByRole("combobox", { name: "Products for Existing clinic" })).toHaveTextContent("Standalone pharmacy");
  expect(api.post).toHaveBeenCalledTimes(1);
});
it("offers a catalogue reload after a failed read", async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error("Offline")); render(<ProductQuotePanel />);
  await screen.findByText("Product quotes unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Reload product catalogue" }));
  await screen.findByRole("button", { name: "Preview product quote" });
});
it("does not show an incomplete or expired quote as a zero-priced offer", async () => {
  vi.mocked(api.post).mockResolvedValue(response({ ...quote(), expiresAt: "2020-01-01T00:00:00Z", totalPaise: undefined }));
  render(<ProductQuotePanel />); await chooseProduct("Standalone pharmacy");
  fireEvent.click(screen.getByRole("button", { name: "Preview product quote" }));
  await screen.findByText("Quote unavailable"); expect(screen.queryByRole("region", { name: "Product quote" })).not.toBeInTheDocument();
});
it("ignores a late private quote after switching the effective organization", async () => {
  let finish!: (value: ReturnType<typeof response>) => void;
  vi.mocked(api.post).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const view = render(<ProductQuotePanel organizationId="org-a" />); await chooseProduct("Standalone pharmacy");
  fireEvent.click(screen.getByRole("button", { name: "Preview product quote" })); await waitFor(() => expect(api.post).toHaveBeenCalledOnce());
  view.rerender(<ProductQuotePanel organizationId="org-b" />);
  await act(async () => finish(response(quote())));
  expect(screen.queryByRole("region", { name: "Product quote" })).not.toBeInTheDocument();
});
it("keeps existing flat-plan clients separate from the product catalogue request", async () => {
  vi.mocked(api.get).mockResolvedValue(response([]));
  await billingService.getPlans(); await billingService.getProductPlans();
  expect(api.get).toHaveBeenCalledWith("/billing/plans");
  expect(api.get).toHaveBeenCalledWith("/billing/plans?kind=location_products", expect.anything());
});
it("passes only the reviewed quote to purchase and disables selection while checkout is busy", async () => {
  const purchase = vi.fn(), view = render(<ProductQuotePanel onPurchase={purchase} />);
  await chooseProduct("Standalone pharmacy"); fireEvent.click(screen.getByRole("button", { name: "Preview product quote" }));
  const pay = await screen.findByRole("button", { name: /Pay.*1,397/ });
  fireEvent.click(pay);
  expect(purchase).toHaveBeenCalledWith(productPlan, expect.objectContaining({ quoteToken: "enc:v1:reviewed-fixture", totalPaise: 139700 }));
  view.rerender(<ProductQuotePanel onPurchase={purchase} busy />);
  expect(screen.getByRole("button", { name: /Pay.*1,397/ })).toBeDisabled();
  expect(screen.getByLabelText("Required doctor seats")).toBeDisabled();
});
it("requires a fresh preview when a reviewed quote expires before purchase", async () => {
  const purchase = vi.fn(); render(<ProductQuotePanel onPurchase={purchase} />);
  await chooseProduct("Standalone pharmacy"); fireEvent.click(screen.getByRole("button", { name: "Preview product quote" }));
  const pay = await screen.findByRole("button", { name: /Pay.*1,397/ });
  const date = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 16 * 60000);
  try { fireEvent.click(pay); expect(purchase).not.toHaveBeenCalled(); expect(screen.getByText(/Quote expired. Preview/)).toBeInTheDocument(); } finally { date.mockRestore(); }
});
it("rejects a quote without its server-issued purchase token", async () => {
  vi.mocked(api.post).mockResolvedValue(response({ ...quote(), quoteToken: undefined }));
  render(<ProductQuotePanel onPurchase={vi.fn()} />); await chooseProduct("Standalone pharmacy");
  fireEvent.click(screen.getByRole("button", { name: "Preview product quote" }));
  await screen.findByText("Quote unavailable"); expect(screen.queryByRole("button", { name: /^Pay/ })).not.toBeInTheDocument();
});
