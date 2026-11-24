import { webcrypto } from "node:crypto";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { PharmacyFileHistory } from "@/components/pharmacy/PharmacyFileHistory";
import { ToastProvider } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { readPrescriptionFileHistory } from "@/lib/pharmacyFileHistory";
import { verifiedFileCustody, retentionTimestamp } from "@/lib/pharmacyFileCustody";
import { datePickerInput } from "./datePickerTestUtils";
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
const locationId = "1".repeat(24), fileId = "2".repeat(24), sourceId = "3".repeat(24);
const custody = () => ({ revision: 2, state: "retained", retainUntil: null as string | null, legalHold: false, pendingUploads: 0, purgedAt: null as string | null });
const record = () => ({ ...custody(), fileId, locationId, policyReference: "", reviewReference: "", holdReason: "", removal: null as { key: string; input: object } | null });
const file = () => ({ id: fileId, name: "original.pdf", contentType: "application/pdf", size: 1000, sha256: "a".repeat(64), state: "attached", attachedAt: "2026-11-23T10:00:00.000Z", sourceKind: "clinic", prescriptionId: sourceId, createdAt: "2026-11-23T10:00:00.000Z", custody: custody() });
const page = () => ({ locationId, uploadsAvailable: true, items: [file()], nextCursor: null as string | null });
const response = (data: unknown) => ({ data: { data } });
beforeEach(() => { vi.stubGlobal("crypto", webcrypto); Element.prototype.scrollIntoView = vi.fn(); sessionStorage.clear(); useAuthStore.setState({ user: { id: "records-officer", name: "Records officer", email: "records@example.test", role: "records", organization_id: "org", permissions: ["PHARMACY_READ_PRESCRIPTION_FILES", "PHARMACY_MANAGE_RECORDS"] } }); api.get.mockReset().mockImplementation(async (path: string) => response(path.endsWith("/custody") ? record() : page())); api.post.mockReset(); api.put.mockReset(); vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const mount = (canManage = true) => render(<ToastProvider><PharmacyFileHistory locationId={locationId} canManage={canManage} /></ToastProvider>);
async function load() { fireEvent.click(screen.getByRole("button", { name: "Load prescription file history" })); await screen.findByRole("heading", { name: "original.pdf" }); }
async function controls() { fireEvent.click(screen.getByText("Retention, legal hold and file removal")); fireEvent.click(screen.getByRole("button", { name: "Load file custody" })); await screen.findByText(/State: retained|State: purging/); }
it("loads history explicitly, keeps management separate and clears old branch/account evidence", async () => {
  mount(false); expect(api.get).not.toHaveBeenCalled(); await load(); expect(screen.getByText(/Historical files do not authorize/)).toBeInTheDocument(); expect(screen.queryByText("Retention, legal hold and file removal")).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled(); await act(async () => { useAuthStore.setState({ user: null }); }); expect(screen.queryByRole("heading", { name: "original.pdf" })).not.toBeInTheDocument();
});
it("requires a reviewed policy and confirms legal holds without deleting files", async () => {
  const next = { ...record(), revision: 3, legalHold: true, policyReference: "Approved policy 2026", holdReason: "Actual dispute hold", reviewReference: "Records review 2026" }; api.put.mockResolvedValue(response(next));
  mount(); await load(); await controls(); expect(screen.queryByRole("button", { name: "Remove retained file bytes" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Legal hold prevents file removal")); fireEvent.change(screen.getByLabelText("Actual legal hold reason"), { target: { value: next.holdReason } }); fireEvent.change(screen.getByLabelText("Approved retention policy/reference"), { target: { value: next.policyReference } }); fireEvent.change(screen.getByLabelText("Records review or removal approval/reference"), { target: { value: next.reviewReference } });
  expect(screen.getByRole("button", { name: "Save reviewed file custody" })).toBeDisabled(); fireEvent.click(screen.getByLabelText("I checked this retention policy and actual hold status")); fireEvent.click(screen.getByRole("button", { name: "Save reviewed file custody" })); await screen.findByText("Reviewed retention and legal hold saved.");
  expect(api.put).toHaveBeenCalledWith(expect.stringContaining(`${fileId}/custody`), expect.objectContaining({ locationId, expectedRevision: 2, retainUntil: null, legalHold: true, holdReason: next.holdReason, confirmed: true })); expect(api.post).not.toHaveBeenCalled();
});
it("blocks downloads when file bytes are removed or removal is pending", async () => {
  const value = page(); value.items[0].custody = { ...custody(), state: "purging", retainUntil: "2026-01-01T00:00:00.000Z" }; api.get.mockResolvedValue(response(value)); mount(false); await load(); expect(screen.getByText("File removal pending; access blocked")).toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Download historical file original.pdf" })).not.toBeInTheDocument();
});
it("requires both reviewed UTC date and time before saving a finite retention period", async () => {
  api.put.mockResolvedValue(response({ ...record(), revision: 3, retainUntil: "2099-12-31T23:45:00.000Z", policyReference: "Actual approved records policy", reviewReference: "Actual records review" }));
  mount(); await load(); await controls(); fireEvent.click(screen.getByLabelText("Retain this file indefinitely"));
  fireEvent.change(datePickerInput(screen.getByLabelText("Retain until (UTC date)")), { target: { value: "2099-12-31" } }); fireEvent.change(screen.getByLabelText("Approved retention policy/reference"), { target: { value: "Actual approved records policy" } }); fireEvent.change(screen.getByLabelText("Records review or removal approval/reference"), { target: { value: "Actual records review" } });
  fireEvent.click(screen.getByLabelText("I checked this retention policy and actual hold status")); fireEvent.click(screen.getByRole("button", { name: "Save reviewed file custody" })); await screen.findByText(/Enter the reviewed UTC date and time/); expect(api.put).not.toHaveBeenCalled();
  fireEvent.change(datePickerInput(screen.getByLabelText("Retain until (UTC time)")), { target: { value: "23:45" } }); fireEvent.click(screen.getByLabelText("I checked this retention policy and actual hold status")); fireEvent.click(screen.getByRole("button", { name: "Save reviewed file custody" })); await screen.findByText("Reviewed retention and legal hold saved."); expect(api.put.mock.calls[0][1].retainUntil).toBe("2099-12-31T23:45:00.000Z");
});
it("recovers a pending removal with its exact original request, key and explicit confirmation", async () => {
  const input = { locationId, expectedRevision: 3, confirmedIrreversibleRemoval: true, reviewReference: "Original actual removal approval" }, key = "original-file-removal-key";
  let finished = false; const pending = { ...record(), revision: 4, state: "purging", retainUntil: "2026-01-01T00:00:00.000Z", policyReference: "Approved records policy", reviewReference: "Reviewed policy", removal: { key, input } };
  api.get.mockImplementation(async (path: string) => response(path.endsWith("/custody") ? finished ? { ...pending, state: "purged", revision: 5, purgedAt: "2026-11-23T11:00:00.000Z" } : pending : page()));
  api.post.mockRejectedValueOnce({ response: { status: 503, data: { message: "Removal outcome pending" } } }).mockImplementationOnce(async () => { finished = true; return response({ ...pending, state: "purged", revision: 5, purgedAt: "2026-11-23T11:00:00.000Z", requestKey: key }); });
  mount(); await load(); await controls(); expect(api.post).not.toHaveBeenCalled(); expect(screen.getByRole("button", { name: "Retry original file removal" })).toBeDisabled();
  fireEvent.click(screen.getByLabelText("I approve irreversible removal of this original file's bytes")); fireEvent.click(screen.getByRole("button", { name: "Retry original file removal" })); await screen.findByText("Removal outcome pending"); await waitFor(() => expect(screen.getByRole("button", { name: "Retry original file removal" })).toBeDisabled());
  fireEvent.click(screen.getByLabelText("I approve irreversible removal of this original file's bytes")); fireEvent.click(screen.getByRole("button", { name: "Retry original file removal" })); await screen.findByText("File bytes removed from active storage. The original audit record is retained.");
  expect(api.post.mock.calls[0]).toEqual(api.post.mock.calls[1]); expect(api.post.mock.calls[0][1]).toEqual(input); expect(api.post.mock.calls[0][2]).toEqual({ headers: { "Idempotency-Key": key } }); expect(sessionStorage.length).toBe(0);
});
it("rejects mismatched scope, incomplete custody and impossible retention timestamps", async () => {
  const value = page(); value.locationId = "4".repeat(24); api.get.mockResolvedValue(response(value)); await expect(readPrescriptionFileHistory(locationId, "", "")).rejects.toThrow(/verified/);
  for (const change of [{ pendingUploads: -1 }, { legalHold: "yes" }, { state: "purged" }, { state: "purging", legalHold: true }]) expect(() => verifiedFileCustody({ ...custody(), ...change })).toThrow(/verified/);
  expect(retentionTimestamp("2028-02-29T23:59")).toBe("2028-02-29T23:59:00.000Z"); expect(() => retentionTimestamp("2026-02-29T23:59")).toThrow(); expect(() => retentionTimestamp("")).toThrow();
});
it("ignores file history that arrives after the view closes", async () => {
  let finish!: (value: unknown) => void; api.get.mockImplementation(() => new Promise(resolve => { finish = resolve; })); const view = mount(false); fireEvent.click(screen.getByRole("button", { name: "Load prescription file history" })); await waitFor(() => expect(api.get).toHaveBeenCalledOnce()); view.unmount(); await act(async () => { finish(response(page())); }); expect(screen.queryByRole("heading", { name: "original.pdf" })).not.toBeInTheDocument();
});
