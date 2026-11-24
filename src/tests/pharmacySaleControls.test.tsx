import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import api from "@/lib/api";
import { PharmacySaleControls } from "@/components/pharmacy/PharmacySaleControls";
import { useAuthStore } from "@/store/authStore";
import { readPharmacySaleControls } from "@/lib/pharmacySaleControls";

vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), put: vi.fn() } }));
const medicineId = "a".repeat(24), locationId = "b".repeat(24), userId = "c".repeat(24);
const row = { medicineId, locationId, name: "Synthetic product", saleControl: null, batches: [], nextCursor: null };
const response = (data: unknown) => ({ data: { data } });
beforeEach(() => {
  vi.clearAllMocks(); Element.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: userId, name: "Owner", email: "owner@example.test", role: "admin", organization_id: "org", permissions: ["MANAGE_ORGANIZATION"] } });
  vi.mocked(api.get).mockResolvedValue(response(row));
});
it("requires explicit evidence and confirmation and sends only the reviewed revision", async () => {
  const control = { revision: 1, blocked: true, reason: "Exact product review", reviewReference: "Reviewed source", changedAt: new Date().toISOString(), changedBy: userId };
  vi.mocked(api.put).mockResolvedValue(response({ id: medicineId, locationId, saleControl: control, offlineNotice: null }));
  const onChanged = vi.fn(); render(<PharmacySaleControls medicineId={medicineId} locationId={locationId} onClose={vi.fn()} onChanged={onChanged} />);
  const save = await screen.findByRole("button", { name: "Stop selling selection" }); expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Reason for this action"), { target: { value: control.reason } });
  fireEvent.change(screen.getByLabelText("Source / review reference"), { target: { value: control.reviewReference } });
  expect(save).toBeDisabled(); fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(save);
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
  expect(api.put).toHaveBeenCalledWith(`/pharmacy/medicines/${medicineId}/sale-control`, { locationId, expectedRevision: 0, blocked: true, reason: control.reason, reviewReference: control.reviewReference, confirmed: true });
});
it("keeps uncertain writes behind a reload and never blindly repeats the action", async () => {
  vi.mocked(api.put).mockRejectedValue(new Error("Connection lost after commit"));
  render(<PharmacySaleControls medicineId={medicineId} locationId={locationId} onClose={vi.fn()} onChanged={vi.fn()} />);
  const save = await screen.findByRole("button", { name: "Stop selling selection" });
  fireEvent.change(screen.getByLabelText("Reason for this action"), { target: { value: "Exact reviewed selection" } });
  fireEvent.change(screen.getByLabelText("Source / review reference"), { target: { value: "Reviewed source" } });
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(save);
  await screen.findByText(/Reload its current result before retrying/);
  expect(screen.queryByRole("button", { name: "Stop selling selection" })).not.toBeInTheDocument(); expect(api.put).toHaveBeenCalledOnce();
});
it("denies mismatched branch read results and provides no write action to a cashier", async () => {
  vi.mocked(api.get).mockResolvedValueOnce(response({ ...row, locationId: "d".repeat(24) }));
  await expect(readPharmacySaleControls(medicineId, locationId)).rejects.toThrow(/could not be confirmed/);
  useAuthStore.setState({ user: { id: userId, role: "counter_sales", permissions: ["PHARMACY_VIEW_STOCK"] } as never });
  render(<PharmacySaleControls medicineId={medicineId} locationId={locationId} onClose={vi.fn()} onChanged={vi.fn()} />);
  await screen.findByText("An organization administrator must change sale holds.");
  expect(screen.queryByRole("button", { name: "Stop selling selection" })).not.toBeInTheDocument(); expect(api.put).not.toHaveBeenCalled();
});

it("loads recall impact without automatically applying a hold and opens the existing review form for another branch", async () => {
  const linked = "d".repeat(24), branch = "e".repeat(24), original = vi.mocked(api.get).getMockImplementation()!;
  vi.mocked(api.get).mockImplementation(async (url, config) => String(url).endsWith("recall-impact") ? response({ medicineId, locationId, batchNumber: null, canTraceBills: true, coverage: "Barcode candidates need manual review", products: [{ medicineId: linked, locationId: branch, branch: "Other pharmacy", name: "Candidate product", match: "barcode candidate: verify identity", physicalUnits: 10, blocked: false, batchCount: 1 }], nextCursor: null, supplies: [], nextSupplyCursor: null }) : String(url).includes(linked) ? response({ ...row, medicineId: linked, locationId: branch, name: "Candidate product" }) : original(url, config));
  render(<PharmacySaleControls medicineId={medicineId} locationId={locationId} onClose={vi.fn()} onChanged={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Review recall impact across branches" })); await screen.findByText("Other pharmacy | Candidate product");
  expect(api.put).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole("button", { name: "Review exact product / batch holds" }));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining(linked + "/sale-controls?locationId=" + branch), expect.any(Object))); expect(api.put).not.toHaveBeenCalled();
});
