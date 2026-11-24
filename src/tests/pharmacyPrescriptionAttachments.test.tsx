import { webcrypto } from "node:crypto";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PharmacyPrescriptionAttachments } from "@/components/pharmacy/PharmacyPrescriptionAttachments";
import { preparePrescriptionFile, prescriptionFileDownload, readPrescriptionFiles } from "@/lib/pharmacyPrescriptionAttachments";
import { useAuthStore } from "@/store/authStore";
import { ToastProvider } from "@/components/ui";
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
const locationId = "111111111111111111111111", prescriptionId = "222222222222222222222222", documentId = "333333333333333333333333";
const doc = () => ({ id: documentId, name: "original.pdf", contentType: "application/pdf", size: 50, sha256: "a".repeat(64), state: "attached", attachedAt: "2026-11-23T10:00:00Z", custody: { revision: 2, state: "retained", retainUntil: null, legalHold: false, pendingUploads: 0, purgedAt: null } });
const list = () => ({ sourceKind: "outside", locationId, prescriptionId, uploadsAvailable: true, items: [doc()] });
const response = (value: unknown) => ({ data: { data: value } });
beforeEach(() => {
  useAuthStore.setState({ user: { id: "pharmacist", role: "pharmacist", name: "Reader", email: "reader@example.test", organization_id: "org", permissions: ["PHARMACY_DISPENSE_RESTRICTED"] } });
  vi.stubGlobal("crypto", webcrypto); api.get.mockReset().mockResolvedValue(response(list())); api.post.mockReset().mockResolvedValue(response(doc())); vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const mount = (canUpload = true) => render(<ToastProvider><PharmacyPrescriptionAttachments locationId={locationId} prescriptionId={prescriptionId} canUpload={canUpload} /></ToastProvider>);
async function load() { fireEvent.click(screen.getByRole("button", { name: "Load prescription files" })); await screen.findByText("original.pdf"); }
it("loads private metadata only on request and requires explicit recipient confirmation before uploading", async () => {
  mount(); expect(api.get).not.toHaveBeenCalled(); await load(); const upload = screen.getByRole("button", { name: "Upload original prescription file" }); expect(upload).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Original signed prescription PDF or image"), { target: { files: [new File(["%PDF-1.4"], "original.pdf", { type: "application/pdf" })] } }); expect(upload).toBeDisabled(); fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(upload);
  await screen.findByText("Original file retained: original.pdf"); expect(api.post).toHaveBeenCalledOnce(); expect(api.post.mock.calls[0][1]).toMatchObject({ locationId, name: "original.pdf", confirmed: true }); expect(api.post.mock.calls[0][2].headers["Idempotency-Key"]).toMatch(/^rxfile-[a-f\d]{64}$/); expect(sessionStorage.length).toBe(0);
});
it("reuses the exact file and original request after a timeout", async () => {
  api.post.mockRejectedValueOnce(Error("Storage outcome pending")); mount(); await load(); fireEvent.change(screen.getByLabelText("Original signed prescription PDF or image"), { target: { files: [new File(["%PDF-1.4"], "original.pdf", { type: "application/pdf" })] } }); fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Upload original prescription file" })); await screen.findByText("Storage outcome pending");
  fireEvent.click(screen.getByRole("button", { name: "Upload original prescription file" })); await screen.findByText("Original file retained: original.pdf"); expect(api.post.mock.calls[1]).toEqual(api.post.mock.calls[0]);
});
it("does not expose upload controls to read-only users and labels unresolved files", async () => {
  const data = list(); data.items[0].state = "pending"; Object.assign(data.items[0], { attachedAt: null }); api.get.mockResolvedValue(response(data)); mount(false); await load(); expect(screen.getByText(/Pending — retry with the original file/)).toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Download original.pdf" })).not.toBeInTheDocument(); expect(screen.queryByLabelText("Original signed prescription PDF or image")).not.toBeInTheDocument();
});
it("does not apply a late file list to a different prescription", async () => {
  let finish!: (value: unknown) => void; api.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); const view = mount(); fireEvent.click(screen.getByRole("button", { name: "Load prescription files" })); view.rerender(<ToastProvider><PharmacyPrescriptionAttachments locationId={locationId} prescriptionId="444444444444444444444444" canUpload /></ToastProvider>); await act(async () => finish(response(list()))); expect(screen.queryByText("original.pdf")).not.toBeInTheDocument();
});
it("rejects wrong-source metadata and unsafe download URLs", async () => {
  api.get.mockResolvedValue(response({ ...list(), prescriptionId: "other" })); await expect(readPrescriptionFiles(locationId, prescriptionId)).rejects.toThrow(/could not be loaded/);
  api.get.mockResolvedValue(response({ url: "https://attacker.example/file", name: "original.pdf", expiresInSeconds: 60 })); await expect(prescriptionFileDownload(locationId, prescriptionId, documentId)).rejects.toThrow(/could not be verified/);
});
it("rejects unsupported files before sending bytes and derives stable private references", async () => {
  await expect(preparePrescriptionFile(new File(["html"], "unsafe.html", { type: "text/html" }))).rejects.toThrow(/Choose a PDF/);
  const file = new File(["%PDF-1.4"], "recipient-original.pdf", { type: "application/pdf" }); const first = await preparePrescriptionFile(file), second = await preparePrescriptionFile(file); expect(first.key).toBe(second.key); expect(first.key).not.toContain("recipient"); expect(api.post).not.toHaveBeenCalled();
});
it("uses the clinic source explicitly and clears outside files when switching source kinds", async () => {
  const view = mount(false); await load();
  view.rerender(<ToastProvider><PharmacyPrescriptionAttachments locationId={locationId} prescriptionId={prescriptionId} sourceKind="clinic" canUpload={false} /></ToastProvider>);
  expect(screen.queryByText("original.pdf")).not.toBeInTheDocument(); api.get.mockResolvedValue(response({ ...list(), sourceKind: "clinic" })); await load();
  expect(api.get).toHaveBeenLastCalledWith(`/pharmacy/clinic-prescriptions/${prescriptionId}/files`, expect.objectContaining({ params: { locationId } })); expect(screen.queryByRole("button", { name: "Upload original prescription file" })).not.toBeInTheDocument();
  api.get.mockResolvedValue(response(list())); await expect(readPrescriptionFiles(locationId, prescriptionId, undefined, "clinic")).rejects.toThrow(/could not be loaded/);
});
