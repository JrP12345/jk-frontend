import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PharmacyOfflineCheckoutSettings } from "@/components/pharmacy/PharmacyOfflineCheckoutSettings";
import { useAuthStore } from "@/store/authStore";

const sdk = vi.hoisted(() => ({ read: vi.fn(), open: vi.fn(), prepare: vi.fn(), start: vi.fn(), cancel: vi.fn(), synchronize: vi.fn() }));
vi.mock("@/lib/pharmacyOfflineSession", () => ({ readOfflineSession: sdk.read }));
vi.mock("@/lib/pharmacyOfflineCheckout", () => ({ openOfflineCheckout: sdk.open, prepareOfflineCheckout: sdk.prepare, startOfflineCheckout: sdk.start, cancelOfflinePreparation: sdk.cancel, synchronizePharmacyBackup: sdk.synchronize }));
const exportBackup = vi.fn(), close = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); useAuthStore.setState({ user: { id: "cashier", organization_id: "org", name: "Cashier", email: "cashier@example.test", role: "cashier" } });
  sdk.read.mockResolvedValue({ authorityId: "original-session", locationId: "branch", organizationId: "org", actorId: "cashier", phase: "active" });
  exportBackup.mockResolvedValue('{"purpose":"synthetic-encrypted-backup"}'); sdk.open.mockResolvedValue({ ledger: { exportRecoveryBackup: exportBackup }, close });
  vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:synthetic-backup"); static revokeObjectURL = vi.fn(); });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function download() {
  render(<PharmacyOfflineCheckoutSettings organizationId="org" locationId="branch" onBusyChange={vi.fn()} />);
  await screen.findByText("active"); fireEvent.change(screen.getByLabelText("Offline passphrase"), { target: { value: "Synthetic backup phrase" } });
  fireEvent.click(screen.getByRole("button", { name: "Download encrypted recovery backup" }));
}
it("reports a requested download without claiming an independently stored or verified backup", async () => {
  await download(); await screen.findByText(/Backup download requested/);
  expect(screen.getByText(/download request does not confirm a stored backup/)).toBeVisible(); expect(exportBackup).toHaveBeenCalledOnce(); expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
  await waitFor(() => expect(close).toHaveBeenCalledOnce()); expect(screen.getByLabelText("Offline passphrase")).toHaveValue("");
  expect(sdk.prepare).not.toHaveBeenCalled(); expect(sdk.synchronize).not.toHaveBeenCalled();
});
it("does not claim a download or change session ownership when export fails", async () => {
  exportBackup.mockRejectedValueOnce(new Error("Retain the original PC; recovery export failed")); await download();
  await screen.findByText(/recovery export failed/); expect(screen.queryByText(/Backup download requested/)).not.toBeInTheDocument();
  expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledOnce(); expect(sdk.cancel).not.toHaveBeenCalled();
});
it("cleans the temporary link and keeps the original session after the browser rejects the download", async () => {
  vi.mocked(HTMLAnchorElement.prototype.click).mockImplementationOnce(() => { throw new Error("Browser blocked this download"); }); await download();
  await screen.findByText("Browser blocked this download"); expect(document.querySelector('a[download]')).toBeNull();
  expect(screen.queryByText(/Backup download requested/)).not.toBeInTheDocument(); expect(close).toHaveBeenCalledOnce(); expect(sdk.cancel).not.toHaveBeenCalled();
});
