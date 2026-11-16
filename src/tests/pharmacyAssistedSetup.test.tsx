import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { OrganizationPharmacySetup } from "@/components/organization/OrganizationPharmacySetup";
import { InviteOrganizationMember } from "@/components/organization/InviteOrganizationMember";
import { CreateOrganization } from "@/components/organization/CreateOrganization";
import { ProductAccessSetup } from "@/components/billing/ProductAccessSetup";
import { useAuthStore } from "@/store/authStore";
import { pharmacyActions } from "@/lib/pharmacyCapabilities";
import { ToastProvider } from "@/components/ui";
import type { OrganizationRecord } from "@/services/organization.service";
import api from "@/lib/api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const org: OrganizationRecord = { id: "org-a", name: "Synthetic pharmacy", city: "Surat", plan: "starter", status: "active", workspaceProfile: "pharmacy", staffMfaRequired: true, primaryAdmin: { name: "Owner", twoFactorEnabled: true, isActive: true } };
const branch = { id: "branch-a", name: "Synthetic branch", organizationId: org.id, address: "Synthetic address", phone: "9876543210" };
const capabilities = { locationId: branch.id, revision: 0, enabled: false, moduleEnabled: true, mode: "configured", commercialEntitlement: "active", actions: Object.fromEntries(pharmacyActions.map(action => [action, true])) };
const issuer = { organizationId: org.id, locationId: branch.id, revision: 1, registration: "unregistered", legalName: "Synthetic issuer", address: "Synthetic address", stateCode: "24", gstin: "", drugLicenceNumbers: ["SYNTHETIC-ONLY"], authorisedSignatory: "Owner", reviewReference: "Synthetic review", pricesIncludeTax: true, electronicReportingRequired: false, minimumHsnDigits: 4, issueSupported: true };
const offer = { id: "a".repeat(24), name: "Reviewed pharmacy trial", trialDays: 7, monthlyTotalPaise: 49900, currency: "INR", maxStaff: 5, fingerprint: "b".repeat(64) };
const productPlan = { id: "product-plan", slug: "pharmacy-products", name: "Pharmacy products", trialDays: 7, commercialFamily: "location_products", commercialPricing: { revision: 1 } };
const quote = { version: 1, organizationId: org.id, planId: productPlan.id, billingCycle: "monthly", fingerprint: "c".repeat(64), currency: "INR", purchaseAvailable: true, quoteToken: "enc:v1:synthetic-review", expiresAt: new Date(Date.now() + 900000).toISOString(), subtotalPaise: 49900, taxPaise: 0, totalPaise: 49900, lines: [{ id: "pharmacy:branch-a", kind: "pharmacy", quantity: 1, amountPaise: 49900 }], entitlements: { maxLocations: 1, maxDoctors: 0, maxStaff: 5 } };
const response = (data: unknown) => ({ data: { data } });
beforeEach(() => {
  useAuthStore.setState({ user: { id: "root", name: "Root", email: "root@example.test", role: "root" }, isAuthenticated: true });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.spyOn(api, "get").mockImplementation(async path => {
    const url = String(path);
    return response(url.includes("/capabilities") ? capabilities : url.includes("/tax-profile") ? issuer : url.includes("/onboarding/options") ? { items: [offer] } : url.includes("/billing/plans") ? [productPlan] : [branch]);
  });
  vi.spyOn(api, "post").mockImplementation(async path => response(String(path).startsWith("/billing/quote") ? quote : { organization: { id: org.id } }));
  vi.spyOn(api, "put").mockResolvedValue(response({ ...org, staffMfaRequired: true }));
});
afterEach(() => vi.restoreAllMocks());

it("checks actual pharmacy branch settings without doctor or public booking requests", async () => {
  const navigate = vi.fn();
  render(<OrganizationPharmacySetup organization={org} onNavigate={navigate} />);
  const checklist = await screen.findByRole("list", { name: "Pharmacy setup checklist" });
  expect(within(checklist).getByText("Pharmacy enabled at this branch").parentElement).toHaveTextContent("Needs attention");
  expect(within(checklist).getByText("Commercial pharmacy access").parentElement).toHaveTextContent("Complete");
  expect(screen.queryByText("Public booking setup")).not.toBeInTheDocument();
  expect(vi.mocked(api.get).mock.calls.every(([url]) => !String(url).startsWith("/public/"))).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Review pharmacy subscription" }));
  expect(navigate).toHaveBeenCalledWith("subscription");
  expect(api.post).not.toHaveBeenCalled();
  expect(api.put).not.toHaveBeenCalled();
});
it("requires branch selection and never accepts a foreign capability response", async () => {
  vi.mocked(api.get).mockImplementation(async path => response(String(path).includes("capabilities") ? { ...capabilities, locationId: "foreign" } : String(path).includes("tax-profile") ? issuer : [branch, { ...branch, id: "branch-b", name: "Second branch" }]));
  render(<OrganizationPharmacySetup organization={org} onNavigate={vi.fn()} />);
  fireEvent.click(await screen.findByRole("combobox", { name: "Review pharmacy branch" }));
  fireEvent.click(screen.getByRole("option", { name: branch.name }));
  await screen.findByText("Branch checks unavailable");
  expect(screen.queryByRole("list", { name: "Pharmacy setup checklist" })).not.toBeInTheDocument();
});
it("does not expose branch settings without location permission", () => {
  useAuthStore.setState({ user: { id: "staff", name: "Staff", email: "staff@example.test", role: "cashier", organization_id: org.id, permissions: [] } });
  render(<OrganizationPharmacySetup organization={org} onNavigate={vi.fn()} />);
  expect(api.get).not.toHaveBeenCalled();
  expect(screen.queryByText("Pharmacy setup")).not.toBeInTheDocument();
});
it("offers an explicit Root MFA-policy repair without marking stock or security complete", async () => {
  const saved = vi.fn();
  render(<OrganizationPharmacySetup organization={{ ...org, staffMfaRequired: false, primaryAdmin: { name: "Owner", twoFactorEnabled: false } }} onNavigate={vi.fn()} onOrganizationSaved={saved} />);
  fireEvent.click(await screen.findByRole("button", { name: "Require staff authenticator setup" }));
  await waitFor(() => expect(api.put).toHaveBeenCalledExactlyOnceWith("/organizations/org-a", { staffMfaRequired: true }));
  expect(saved).toHaveBeenCalledOnce();
  expect(screen.getByText(/operational steps are not verified/)).toBeInTheDocument();
});
it("uses target pharmacy roles while Root is managing another organization", async () => {
  render(<ToastProvider><InviteOrganizationMember organizationId={org.id} workspaceProfile="pharmacy" onClose={vi.fn()} /></ToastProvider>);
  const role = screen.getByRole("combobox", { name: "Role" });
  expect(role).toHaveTextContent("pharmacist");
  fireEvent.click(role);
  expect(screen.getByRole("option", { name: "cashier" })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "doctor" })).not.toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "nurse" })).not.toBeInTheDocument();
});
it("creates an assisted pharmacy using reviewed trial terms instead of flat tier defaults", async () => {
  render(<CreateOrganization open onClose={vi.fn()} onCreated={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Organization name"), { target: { value: org.name } });
  fireEvent.change(screen.getByLabelText("City"), { target: { value: "Surat" } });
  fireEvent.click(screen.getByRole("combobox", { name: "Primary location type" }));
  fireEvent.click(screen.getByRole("option", { name: "Pharmacy", exact: true }));
  await screen.findByText(/7-day trial/);
  expect(screen.queryByRole("combobox", { name: "Subscription tier" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Branch address"), { target: { value: branch.address } });
  fireEvent.change(screen.getByLabelText("Branch contact number"), { target: { value: branch.phone } });
  fireEvent.click(screen.getByRole("button", { name: "Configure administrator" }));
  fireEvent.change(screen.getByLabelText("Administrator name"), { target: { value: "Owner" } });
  fireEvent.change(screen.getByLabelText("Administrator email"), { target: { value: "owner@example.test" } });
  fireEvent.change(screen.getByLabelText("Administrator password"), { target: { value: "SyntheticOwner123!" } });
  fireEvent.click(screen.getByRole("button", { name: "Create organization" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith("/onboarding/organization", expect.objectContaining({ pharmacyPlanId: offer.id, pharmacyPlanFingerprint: offer.fingerprint, address: branch.address, org_phone: branch.phone, facilityType: "pharmacy" }), { timeout: 60000 }));
  const payload = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>;
  expect(payload).not.toHaveProperty("trialDays");
  expect(payload).not.toHaveProperty("plan");
});
async function previewGrant() {
  fireEvent.click(await screen.findByRole("combobox", { name: `Products for ${branch.name}` }));
  fireEvent.click(screen.getByRole("option", { name: "Standalone pharmacy", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Preview product quote" }));
  await screen.findByRole("form", { name: "Reviewed product access grant" });
}
it("sends a reviewed trial token and reason without initiating a payment", async () => {
  const saved = vi.fn();
  render(<ProductAccessSetup organizationId={org.id} subscriptionId="sub-a" onSaved={saved} />);
  await previewGrant();
  expect(document.querySelector("form form")).toBeNull();
  fireEvent.click(screen.getByRole("combobox", { name: "Access grant type" }));
  fireEvent.click(screen.getByRole("option", { name: "7-day configured trial" }));
  fireEvent.change(screen.getByLabelText("Reason for product access grant"), { target: { value: "Reviewed synthetic pharmacy pilot" } });
  fireEvent.click(screen.getByRole("button", { name: "Grant configured product trial" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(api.post).toHaveBeenCalledWith("/admin/billing/subscriptions/sub-a/activate", { planSlug: productPlan.slug, billingCycle: "monthly", reason: "Reviewed synthetic pharmacy pilot", quoteToken: quote.quoteToken, grantKind: "trial" });
  expect(vi.mocked(api.post).mock.calls.some(([url]) => String(url).includes("checkout"))).toBe(false);
});
it("clears grant confirmation when the reviewed product selection changes", async () => {
  render(<ProductAccessSetup organizationId={org.id} subscriptionId="sub-a" onSaved={vi.fn()} />);
  await previewGrant();
  fireEvent.change(screen.getByLabelText("Reason for product access grant"), { target: { value: "Reviewed previous selection" } });
  fireEvent.change(screen.getByLabelText("Required doctor seats"), { target: { value: "1" } });
  expect(screen.queryByRole("form", { name: "Reviewed product access grant" })).not.toBeInTheDocument();
  expect(vi.mocked(api.post).mock.calls).toHaveLength(1);
});
it("blocks a repeated grant when its result is uncertain", async () => {
  vi.mocked(api.post).mockImplementation(async path => {
    if (String(path).startsWith("/billing/quote")) return response(quote);
    throw new Error("Synthetic response lost");
  });
  const saved = vi.fn();
  render(<ProductAccessSetup organizationId={org.id} subscriptionId="sub-a" onSaved={saved} />);
  await previewGrant();
  fireEvent.change(screen.getByLabelText("Reason for product access grant"), { target: { value: "Reviewed synthetic manual grant" } });
  fireEvent.click(screen.getByRole("button", { name: "Grant reviewed product access" }));
  await screen.findByText("Access grant unavailable");
  expect(screen.getByRole("button", { name: "Grant reviewed product access" })).toBeDisabled();
  expect(vi.mocked(api.post).mock.calls.filter(([url]) => String(url).includes("/activate"))).toHaveLength(1);
  expect(saved).not.toHaveBeenCalled();
});
it("does not expose Root product grants to organization administrators", async () => {
  useAuthStore.setState({ user: { id: "owner", name: "Owner", email: "owner@example.test", role: "admin", organization_id: org.id, permissions: ["MANAGE_BILLING"] } });
  render(<ProductAccessSetup organizationId={org.id} subscriptionId="sub-a" onSaved={vi.fn()} />);
  await screen.findByRole("button", { name: "Preview product quote" });
  expect(screen.queryByRole("form", { name: "Reviewed product access grant" })).not.toBeInTheDocument();
});
it("discards a late branch check after the organization changes", async () => {
  let finish!: (value: ReturnType<typeof response>) => void;
  vi.mocked(api.get).mockImplementation(async path => String(path).includes("capabilities") ? new Promise(resolve => { finish = resolve; }) : response(String(path).includes("tax-profile") ? issuer : [branch]));
  const view = render(<OrganizationPharmacySetup organization={org} onNavigate={vi.fn()} />);
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  vi.mocked(api.get).mockResolvedValue(response([]));
  view.rerender(<OrganizationPharmacySetup organization={{ ...org, id: "org-b" }} onNavigate={vi.fn()} />);
  await screen.findByText("Create an active pharmacy branch");
  await act(async () => finish(response({ ...capabilities, enabled: true })));
  expect(screen.queryByRole("list", { name: "Pharmacy setup checklist" })).not.toBeInTheDocument();
});
