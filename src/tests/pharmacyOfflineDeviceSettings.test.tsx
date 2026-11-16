import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as device from "@/lib/pharmacyOfflineDevice";
import { PharmacyOfflineDeviceSettings } from "@/components/pharmacy/PharmacyOfflineDeviceSettings";
import { useAuthStore } from "@/store/authStore";
vi.mock("@/components/pharmacy/PharmacyOfflineCheckoutSettings", () => ({ PharmacyOfflineCheckoutSettings: () => <div>Protected checkout settings</div> }));
vi.mock("@/lib/pharmacyOfflineDevice", () => ({ browserDevice: vi.fn(), readOfflineDevice: vi.fn(), readPendingEnrollment: vi.fn(), confirmEnrollmentLocally: vi.fn(), enrollOfflineDevice: vi.fn(), requestDeviceChallenge: vi.fn(), proveDeviceEnrollment: vi.fn(), savePendingEnrollment: vi.fn(), revokeOfflineDevice: vi.fn(), cancelDeviceEnrollment: vi.fn(), clearCancelledEnrollment: vi.fn() }));
const scope = { organizationId: "org", locationId: "branch" }, initial = () => ({ status: { ...scope, checkoutEnabled: false, financialYear: "2026-27", numberingRevision: 1, signingKey: { id: "key", jwk: {} }, device: null }, evidence: null });
const identity = { ...scope, id: "id", deviceId: "device", privateKey: {} as CryptoKey, publicKey: { kty: "EC", crv: "P-256", x: "x", y: "y" } };
const saved = () => ({ ...initial(), status: { ...initial().status, device: { deviceId: "device", deviceName: "Main PC", enrollmentId: "enrollment", revision: 1, status: "enrolled", keyFingerprint: "hash", payload: "grant", signature: "signature", signingKeyId: "key" } } });
const request = { expectedRevision: 0, expectedNumberingRevision: 1, expectedFinancialYear: "2026-27", count: 3, deviceName: "Main PC", reviewReference: "Review", confirmed: true, challengeId: "enrollment", proof: "proof" };
const mount = (busy = vi.fn()) => render(<PharmacyOfflineDeviceSettings {...scope} onBusyChange={busy} />);
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: { id: "owner", name: "Owner", email: "owner@example.test", role: "admin", organization_id: "org", permissions: ["MANAGE_ORGANIZATION"] } });
  vi.mocked(device.readOfflineDevice).mockResolvedValue(initial() as never); vi.mocked(device.browserDevice).mockResolvedValue(identity as never);
  vi.mocked(device.readPendingEnrollment).mockResolvedValue(null); vi.mocked(device.enrollOfflineDevice).mockResolvedValue(saved() as never);
  vi.mocked(device.proveDeviceEnrollment).mockResolvedValue(request as never); vi.mocked(device.requestDeviceChallenge).mockResolvedValue({ challengeId: "enrollment" } as never);
});
afterEach(cleanup);
async function fill() {
  await screen.findByLabelText("Billing PC name *");
  fireEvent.change(screen.getByLabelText("Billing PC name *"), { target: { value: "Main PC" } });
  fireEvent.change(screen.getByLabelText("Invoice numbers to reserve *"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("Enrollment review reference *"), { target: { value: "Review" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "I confirm this is the branch's designated billing PC" }));
}
it("enrolls only after review and persists the exact request before sending it", async () => {
  const busy = vi.fn(); mount(busy); await fill();
  fireEvent.click(screen.getByRole("button", { name: "Enroll this PC & reserve numbers" }));
  await screen.findByText(/This browser is enrolled/);
  expect(device.savePendingEnrollment).toHaveBeenCalledWith(scope, { actorId: "owner", request });
  expect(vi.mocked(device.savePendingEnrollment).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(device.enrollOfflineDevice).mock.invocationCallOrder[0]);
  expect(device.enrollOfflineDevice).toHaveBeenCalledOnce(); expect(device.confirmEnrollmentLocally).toHaveBeenCalledWith(scope, saved().status);
  expect(busy.mock.calls).toEqual([[true], [false]]);
});
it("uses the revoked enrollment revision when requesting a reviewed replacement PC", async () => {
  vi.mocked(device.readOfflineDevice).mockResolvedValue({ ...saved(), status: { ...saved().status, device: { ...saved().status.device, deviceId: "old-device", status: "revoked", revision: 2 } } } as never);
  mount(); await fill(); fireEvent.click(screen.getByRole("button", { name: "Enroll replacement PC & reserve numbers" }));
  await waitFor(() => expect(device.proveDeviceEnrollment).toHaveBeenCalledWith(identity, { challengeId: "enrollment" }, expect.objectContaining({ expectedRevision: 2 })));
  expect(device.revokeOfflineDevice).not.toHaveBeenCalled();
});
it("blocks double submission while identity/challenge/POST is pending", async () => {
  let finish!: (value: never) => void; vi.mocked(device.enrollOfflineDevice).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  mount(); await fill(); const button = screen.getByRole("button", { name: "Enroll this PC & reserve numbers" });
  fireEvent.click(button); fireEvent.click(button); await waitFor(() => expect(device.enrollOfflineDevice).toHaveBeenCalledOnce());
  await act(async () => finish(saved() as never)); await screen.findByText(/This browser is enrolled/);
});
it("locks uncertain outcomes and recovers using the original request after reload", async () => {
  vi.mocked(device.enrollOfflineDevice).mockRejectedValueOnce(new Error("Lost response")); mount(); await fill();
  fireEvent.click(screen.getByRole("button", { name: "Enroll this PC & reserve numbers" })); await screen.findByText("Lost response");
  expect(screen.queryByRole("button", { name: "Enroll this PC & reserve numbers" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry original enrollment" })); await screen.findByText(/This browser is enrolled/);
  expect(vi.mocked(device.enrollOfflineDevice).mock.calls.map(call => call[1])).toEqual([request, request]);
});
it("keeps enrollment unsent if durable pending storage fails", async () => {
  vi.mocked(device.savePendingEnrollment).mockRejectedValueOnce(new Error("Disk full")); mount(); await fill();
  fireEvent.click(screen.getByRole("button", { name: "Enroll this PC & reserve numbers" })); await screen.findByText("Disk full"); expect(device.enrollOfflineDevice).not.toHaveBeenCalled();
});
it("shows another enrolled browser without silently replacing it and revokes against its revision", async () => {
  vi.mocked(device.readOfflineDevice).mockResolvedValue(saved() as never); vi.mocked(device.browserDevice).mockResolvedValue(null);
  vi.mocked(device.revokeOfflineDevice).mockResolvedValue({ ...saved(), status: { ...saved().status, device: { ...saved().status.device, status: "revoked", revision: 2 } } } as never);
  mount(); await screen.findByText(/Another browser is enrolled/);
  expect(screen.queryByLabelText("Billing PC name *")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Revocation review reference *"), { target: { value: "Actual review" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /I confirm revocation/ })); fireEvent.click(screen.getByRole("button", { name: "Revoke PC enrollment" }));
  await screen.findByText(/Revoked/); expect(device.revokeOfflineDevice).toHaveBeenCalledWith(scope, 1, "Actual review");
  expect(screen.queryByRole("button", { name: "Enroll this PC & reserve numbers" })).not.toBeInTheDocument();
});
it("does not create/load owner enrollment for staff without organization management", async () => {
  useAuthStore.setState({ user: { ...useAuthStore.getState().user!, permissions: ["PHARMACY_MANAGE_SETTINGS"] } }); mount();
  expect(device.readOfflineDevice).not.toHaveBeenCalled(); expect(screen.getByRole("button", { name: "Check PC enrollment" })).toBeDisabled();
});
it("cancels only after server confirmation before clearing durable pending evidence", async () => {
  vi.mocked(device.readPendingEnrollment).mockResolvedValue({ actorId: "owner", request } as never); vi.mocked(device.cancelDeviceEnrollment).mockResolvedValue(initial() as never);
  mount(); fireEvent.click(await screen.findByRole("button", { name: "Cancel uncommitted enrollment" }));
  await screen.findByLabelText("Billing PC name *"); expect(device.clearCancelledEnrollment).toHaveBeenCalledWith(scope, "enrollment");
  expect(vi.mocked(device.cancelDeviceEnrollment).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(device.clearCancelledEnrollment).mock.invocationCallOrder[0]);
});
it("resolves a losing device's pending attempt while retaining the other PC's enrollment", async () => {
  vi.mocked(device.readOfflineDevice).mockResolvedValue(saved() as never); vi.mocked(device.browserDevice).mockResolvedValue(null);
  vi.mocked(device.readPendingEnrollment).mockResolvedValue({ actorId: "owner", request: { ...request, challengeId: "losing-attempt" } } as never);
  vi.mocked(device.cancelDeviceEnrollment).mockResolvedValue(saved() as never); mount();
  fireEvent.click(await screen.findByRole("button", { name: "Cancel uncommitted enrollment" }));
  await screen.findByRole("button", { name: "Revoke PC enrollment" });
  expect(device.clearCancelledEnrollment).toHaveBeenCalledWith(scope, "losing-attempt"); expect(device.confirmEnrollmentLocally).not.toHaveBeenCalled();
  expect(screen.getByText(/Another browser is enrolled/)).toBeInTheDocument();
});
