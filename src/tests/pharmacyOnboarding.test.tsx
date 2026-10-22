import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import api from "@/lib/api";
import { useAuthStore, type User } from "@/store/authStore";
import { PharmacyOnboarding } from "@/components/pharmacy/PharmacyOnboarding";
import { PharmacyHome } from "@/components/pharmacy/PharmacyHome";
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav";
import StaffWorkspaceSwitcher from "@/components/auth/StaffWorkspaceSwitcher";
import { InviteOrganizationMember } from "@/components/organization/InviteOrganizationMember";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui";
import { authScopeKey } from "@/lib/authScope";
import { isPharmacyWorkspace, pharmacyWorkspaceRoute } from "@/lib/workspaceProfile";
import { readPharmacyTrials, parseStoredPharmacySetup } from "@/lib/pharmacyOnboarding";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const plan = { id: "1".repeat(24), name: "Reviewed synthetic trial", fingerprint: "a".repeat(64), currency: "INR", monthlyTotalPaise: 49900, maxStaff: 5, trialDays: 7 };
const proof = { requestId: "2".repeat(24), setupToken: "b".repeat(64), completionKey: "saved-completion-key" };
const owner: User = { id: "3".repeat(24), name: "Owner", email: "owner@example.test", organization_id: "4".repeat(24), role: "admin", workspaceProfile: "pharmacy", mfaEnrollmentRequired: true, permissions: ["MANAGE_ORGANIZATION", "MANAGE_STAFF", "VIEW_LOCATIONS", "PHARMACY_SELL"] };
const storageKey = "ekavyu:pharmacy-onboarding:anonymous";
const response = (data: unknown) => ({ data: { data } });
const checkAuth = vi.fn(async () => useAuthStore.setState({ user: owner, isAuthenticated: true }));
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  useAuthStore.setState({ user: null, isLoading: false, isAuthenticated: false, checkAuth });
  vi.mocked(api.get).mockResolvedValue(response({ items: [plan] }));
  vi.mocked(api.post).mockImplementation(async (url) => response(url.endsWith("/start") ? { ...proof, state: "pending", deliveryAvailable: true } : url.endsWith("/status") ? { state: "verified" } : url.endsWith("/verify") ? { state: "verified" } : { user: owner }));
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
async function details() {
  render(<PharmacyOnboarding />); const button = await screen.findByRole("button", { name: "Send business verification code" }); await waitFor(() => expect(button).toBeEnabled());
  for (const [label, value] of [["Owner name *", "Business owner"], ["Business account email *", "owner@example.test"], ["Password for a new account", "StrongPassword123!"], ["Business name *", "Actual business"], ["City *", "Pune"], ["Branch address *", "Actual branch address"]]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.submit(screen.getByRole("form", { name: "Pharmacy business details" })); await screen.findByRole("form", { name: "Verify business account email" });
}
async function verify() { fireEvent.change(screen.getByLabelText("Business email verification code"), { target: { value: "123456" } }); fireEvent.submit(screen.getByRole("form", { name: "Verify business account email" })); await screen.findByRole("button", { name: "Create or resume pharmacy workspace" }); }
it("uses the published offer and verified owner flow, retaining only opaque recovery proof before MFA enrollment", async () => {
  await details(); const saved = JSON.parse(sessionStorage.getItem(storageKey)!); expect(saved).toMatchObject({ requestId: proof.requestId, setupToken: proof.setupToken }); expect(Object.keys(saved).sort()).toEqual(["completionKey", "requestId", "setupToken"]);
  expect(screen.queryByDisplayValue("StrongPassword123!")).not.toBeInTheDocument();
  expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({ planId: plan.id, planFingerprint: plan.fingerprint, city: "Pune", password: "StrongPassword123!" });
  await verify(); fireEvent.click(screen.getByRole("button", { name: "Create or resume pharmacy workspace" })); await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard"));
  expect(checkAuth).toHaveBeenCalledOnce(); expect(sessionStorage.getItem(storageKey)).toBeNull(); expect(useAuthStore.getState().user?.mfaEnrollmentRequired).toBe(true);
});
it("resumes a recorded business after connection loss using the original completion key", async () => {
  sessionStorage.setItem(storageKey, JSON.stringify(proof)); vi.mocked(api.post).mockImplementation(async url => { if (url.endsWith("/status")) return response({ state: "provisioned", organizationId: owner.organization_id }); throw Error("Connection lost"); });
  render(<PharmacyOnboarding />); fireEvent.click(await screen.findByRole("button", { name: "Create or resume pharmacy workspace" })); await screen.findByText("Connection lost");
  fireEvent.click(screen.getByRole("button", { name: "Create or resume pharmacy workspace" })); await waitFor(() => expect(vi.mocked(api.post).mock.calls.filter(([url]) => url.endsWith("/complete"))).toHaveLength(2));
  for (const [, body, config] of vi.mocked(api.post).mock.calls.filter(([url]) => url.endsWith("/complete"))) { expect(body).toEqual({ requestId: proof.requestId, setupToken: proof.setupToken }); expect(config?.headers).toEqual({ "Idempotency-Key": proof.completionKey }); }
  expect(sessionStorage.getItem(storageKey)).toBe(JSON.stringify(proof)); expect(checkAuth).not.toHaveBeenCalled();
});
it("requires an existing account authenticator before adopting its pharmacy session", async () => {
  sessionStorage.setItem(storageKey, JSON.stringify(proof)); vi.mocked(api.post).mockImplementation(async url => response(url.endsWith("/status") ? { state: "verified" } : url.endsWith("/complete") ? { twoFactorRequired: true, twoFactorToken: "server-bound-business-challenge" } : { user: owner }));
  render(<PharmacyOnboarding />); fireEvent.click(await screen.findByRole("button", { name: "Create or resume pharmacy workspace" })); await screen.findByRole("form", { name: "Verify account authenticator" }); expect(checkAuth).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Authenticator code"), { target: { value: "123456" } }); fireEvent.submit(screen.getByRole("form", { name: "Verify account authenticator" })); await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard"));
  expect(api.post).toHaveBeenCalledWith("/auth/login/verify-2fa", { twoFactorToken: "server-bound-business-challenge", otp: "123456" });
});
it("allows explicit recovery from a malformed saved proof without submitting it", async () => {
  sessionStorage.setItem(storageKey, "malformed"); render(<PharmacyOnboarding />); await screen.findByText("Saved business setup reference needs review"); expect(screen.getByRole("button", { name: "Send business verification code" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Begin new verification" })); await waitFor(() => expect(screen.getByRole("button", { name: "Send business verification code" })).toBeEnabled()); expect(sessionStorage.getItem(storageKey)).toBeNull(); expect(api.post).not.toHaveBeenCalled();
});
it("does not fabricate offers or start a business when no trial is published", async () => {
  vi.mocked(api.get).mockResolvedValue(response({ items: [] })); render(<PharmacyOnboarding />); await screen.findByText(/No reviewed pharmacy trial/); expect(screen.getByRole("button", { name: "Send business verification code" })).toBeDisabled(); expect(api.post).not.toHaveBeenCalled();
});
it("ignores a setup response after the account changes", async () => {
  let resolve!: (value: unknown) => void; vi.mocked(api.post).mockImplementationOnce(() => new Promise(yes => { resolve = yes; }));
  render(<PharmacyOnboarding />); await waitFor(() => expect(screen.getByRole("button", { name: "Send business verification code" })).toBeEnabled()); fireEvent.submit(screen.getByRole("form", { name: "Pharmacy business details" }));
  await act(async () => useAuthStore.setState({ user: owner })); await act(async () => resolve(response({ ...proof, state: "pending", deliveryAvailable: true })));
  expect(sessionStorage.getItem(storageKey)).toBeNull(); expect(screen.queryByRole("form", { name: "Verify business account email" })).not.toBeInTheDocument(); expect(router.replace).not.toHaveBeenCalled();
});
it("rejects unsafe offer and proof contracts", async () => {
  vi.mocked(api.get).mockResolvedValue(response({ items: [{ ...plan, monthlyTotalPaise: -1 }] })); await expect(readPharmacyTrials()).rejects.toThrow("could not be confirmed"); expect(() => parseStoredPharmacySetup(JSON.stringify({ ...proof, setupToken: "bad" }))).toThrow("needs review");
});
it("opens a pharmacy home and mobile navigation without clinical data calls", () => {
  useAuthStore.setState({ user: owner }); render(<><PharmacyHome /><MobileBottomNav user={owner} pathname="/dashboard" onOpenMenu={vi.fn()} isMenuOpen={false} /></>);
  expect(screen.getByRole("heading", { name: "Pharmacy workspace" })).toBeInTheDocument(); expect(screen.getByRole("link", { name: "Pharmacy" })).toHaveAttribute("href", "/dashboard/pharmacy"); expect(screen.queryByRole("link", { name: "Patients" })).not.toBeInTheDocument(); expect(api.get).not.toHaveBeenCalled();
  expect(isPharmacyWorkspace({ ...owner, role: "patient" })).toBe(false); expect(pharmacyWorkspaceRoute("/dashboard/patients")).toBe(false); expect(pharmacyWorkspaceRoute("/dashboard/settings/billing")).toBe(true);
  expect(authScopeKey({ ...owner, workspaceProfile: "clinic" })).not.toBe(authScopeKey(owner)); expect(pharmacyWorkspaceRoute("/dashboard/security")).toBe(true);
});
it("lets an existing patient open their one authorized business workspace", async () => {
  const switchOrg = vi.fn(async () => {}); useAuthStore.setState({ user: { ...owner, role: "patient", organization_id: undefined, workspaceProfile: undefined, hasStaffWorkspaces: true }, switchOrg }); vi.mocked(api.get).mockResolvedValue(response([{ organizationId: owner.organization_id, name: "Verified pharmacy", role: "admin" }]));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ToastProvider><StaffWorkspaceSwitcher /></ToastProvider></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("combobox", { name: "Organization workspace" })); fireEvent.click(screen.getByRole("option", { name: "Verified pharmacy" })); await waitFor(() => expect(switchOrg).toHaveBeenCalledWith(owner.organization_id));
});
it("defaults pharmacy invitations to pharmacists and omits clinical roles", () => {
  useAuthStore.setState({ user: owner }); render(<ToastProvider><InviteOrganizationMember organizationId={owner.organization_id!} onClose={vi.fn()} /></ToastProvider>);
  expect(screen.getByRole("combobox", { name: "Role" })).toHaveTextContent("pharmacist"); fireEvent.click(screen.getByRole("combobox", { name: "Role" })); expect(screen.queryByRole("option", { name: "doctor" })).not.toBeInTheDocument(); expect(screen.getByRole("option", { name: "cashier" })).toBeInTheDocument();
});
