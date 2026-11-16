import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { PharmacyProductReview } from "@/components/pharmacy/PharmacyProductReview";
import { parseProductReview } from "@/lib/pharmacyProductReview";
import { useAuthStore } from "@/store/authStore";

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
const response = (data: unknown) => ({ data: { data }, headers: {} });
const evidence = { confirmedBy: "reviewer", confirmedAt: "2026-11-11T10:00:00.000Z" };
const product = (locationId = "branch") => ({ id: "medicine", locationId, name: "Demo Cotton Roll", scheduleType: "general", hsnCode: "9999", gstRate: 0,
  dispensingRevision: 0, taxRevision: 0, unitDefinition: { version: 1, baseUnit: "piece", packUnit: "box", unitsPerPack: 10 } });
let stored: Record<string, any>;
const changed = vi.fn(), closed = vi.fn();
const view = (locationId = "branch") => <PharmacyProductReview medicineId="medicine" locationId={locationId} onClose={closed} onReviewed={changed} />;
function fill(name: string, value: string) {
  const element = screen.getByLabelText(name);
  if (element.getAttribute("role") === "combobox") {
    const labels: Record<string, string> = { general: "General — ordinary counter sale", schedule_h: "Schedule h", schedule_h1: "Schedule h1", taxable: "Taxable", nil_rated: "Nil rated" };
    fireEvent.click(element); fireEvent.click(screen.getByRole("option", { name: labels[value], exact: true }));
  } else fireEvent.change(element, { target: { value } });
}
async function loaded() { await screen.findByRole("form", { name: "Sale classification review" }); }
function sale() { fill("Sale review reference *", "  Synthetic sale review 001  "); fireEvent.click(screen.getByLabelText("I confirm the sale classification and review reference")); fireEvent.submit(screen.getByRole("form", { name: "Sale classification review" })); }
function tax() { fill("Document unit code *", "nos"); fill("Tax treatment *", "nil_rated"); fill("Tax review reference *", "  Synthetic tax review 001  "); fireEvent.click(screen.getByLabelText("I confirm the tax classification and review reference")); fireEvent.submit(screen.getByRole("form", { name: "Tax classification review" })); }
beforeEach(() => {
  vi.clearAllMocks(); stored = product();
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  useAuthStore.setState({ user: { id: "owner", name: "Owner", email: "owner@example.test", role: "admin", organization_id: "org", permissions: ["MANAGE_ORGANIZATION", "PHARMACY_VIEW_STOCK"] } });
  api.get.mockReset().mockImplementation(async () => response([stored]));
  api.put.mockReset().mockImplementation(async (url: string, input: any) => {
    if (url.endsWith("/dispensing-classification")) {
      stored = { ...stored, scheduleType: input.scheduleType, dispensingRevision: input.expectedRevision + 1, dispensingReview: { ...evidence, scheduleType: input.scheduleType, reviewReference: input.reviewReference } };
      return response({ id: stored.id, scheduleType: stored.scheduleType, dispensingRevision: stored.dispensingRevision, dispensingReview: stored.dispensingReview });
    }
    stored = { ...stored, hsnCode: input.hsnCode, gstRate: input.gstRate, taxRevision: input.expectedRevision + 1, taxClassification: { ...input, ...evidence } };
    return response({ id: stored.id, hsnCode: stored.hsnCode, gstRate: stored.gstRate, taxRevision: stored.taxRevision, taxClassification: stored.taxClassification });
  });
});

it("loads only the selected branch/product, requires explicit reviews and preserves a zero rate", async () => {
  render(view()); await loaded();
  expect(api.get).toHaveBeenCalledWith(expect.stringContaining("locationId=branch"), expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(api.get.mock.calls[0][0]).toContain("medicineIds=medicine");
  expect(screen.getByLabelText("Reviewed GST rate (%) *")).toHaveValue(0);
  expect(screen.getByLabelText("Document unit code *")).toHaveValue("");
  expect(screen.getByRole("combobox", { name: "Tax treatment *" })).toHaveTextContent("Choose tax treatment");
  expect(screen.getByRole("button", { name: "Save sale review" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Save tax review" })).toBeDisabled();
  expect(api.put).not.toHaveBeenCalled();
});
it("saves sale and tax separately using their own current revisions, without submitting response metadata", async () => {
  stored = { ...stored, dispensingRevision: 3, taxRevision: 5 };
  render(view()); await loaded(); sale(); await screen.findByText("Sale classification review saved.");
  expect(api.put.mock.calls[0]).toEqual(["/pharmacy/medicines/medicine/dispensing-classification", { expectedRevision: 3, scheduleType: "general", reviewReference: "Synthetic sale review 001" }]);
  expect(stored.taxRevision).toBe(5); tax(); await screen.findByText("Tax classification review saved.");
  expect(api.put.mock.calls[1]).toEqual(["/pharmacy/medicines/medicine/tax-classification", { expectedRevision: 5, hsnCode: "9999", unitCode: "NOS", gstRate: 0, treatment: "nil_rated", reviewReference: "Synthetic tax review 001" }]);
  expect(changed).toHaveBeenCalledTimes(2);
  expect(screen.getByText(/Both product reviews are recorded/)).toBeInTheDocument();
});
it("invalidates confirmation when fields change and rejects a contradictory tax rate without a write", async () => {
  render(view()); await loaded(); fill("Sale review reference *", "Synthetic review"); fireEvent.click(screen.getByLabelText("I confirm the sale classification and review reference"));
  fill("Sale classification *", "schedule_h"); expect(screen.getByRole("button", { name: "Save sale review" })).toBeDisabled();
  fill("Document unit code *", "NOS"); fill("Tax treatment *", "taxable"); fill("Tax review reference *", "Synthetic review");
  fireEvent.click(screen.getByLabelText("I confirm the tax classification and review reference")); fireEvent.submit(screen.getByRole("form", { name: "Tax classification review" }));
  expect(await screen.findByText("Check tax rate")).toBeInTheDocument(); expect(api.put).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Tax review reference *")).toHaveValue("Synthetic review");
});
it("records restricted classification without presenting it as eligible for counter checkout", async () => {
  render(view()); await loaded(); fill("Sale classification *", "schedule_h1"); sale();
  await screen.findByText("Sale classification review saved.");
  expect(screen.getByText(/This classification remains unavailable in ordinary Counter sale/)).toBeInTheDocument();
  expect(api.put.mock.calls[0][1]).toMatchObject({ scheduleType: "schedule_h1" });
});
it("preserves a saved sale review when tax review conflicts and requires a fresh read", async () => {
  render(view()); await loaded(); sale(); await screen.findByText("Sale classification review saved.");
  api.put.mockRejectedValueOnce({ response: { status: 409, data: { message: "Medicine tax classification changed; reload before saving" } } }); tax();
  await screen.findByText(/Reload product details to check the saved result/); expect(screen.queryByRole("button", { name: "Save tax review" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reload product details" })); await loaded();
  expect(stored.dispensingRevision).toBe(1); expect(stored.taxRevision).toBe(0);
  expect(within(screen.getByRole("form", { name: "Sale classification review" })).getByText(/Previous reference/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save tax review" })).toBeDisabled();
});
it("reconciles a committed but lost response by reloading and never automatically repeats the write", async () => {
  const put = api.put.getMockImplementation()!;
  api.put.mockImplementationOnce(async (...args: unknown[]) => { await put(...args); throw new Error("Connection lost"); });
  render(view()); await loaded(); sale(); await screen.findByText(/Reload product details to check the saved result/);
  expect(api.put).toHaveBeenCalledTimes(1); expect(changed).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Reload product details" })); await loaded();
  expect(screen.getByText(/Previous reference: Synthetic sale review 001/)).toBeInTheDocument();
  expect(api.put).toHaveBeenCalledTimes(1); expect(screen.getByRole("button", { name: "Save sale review" })).toBeDisabled();
});
it("does not claim success for a malformed mutation acknowledgement", async () => {
  api.put.mockResolvedValueOnce(response({ id: "another-product", dispensingRevision: 1 })); render(view()); await loaded(); sale();
  await screen.findByText(/Sale review save could not be confirmed/); expect(changed).not.toHaveBeenCalled();
  expect(screen.queryByText("Sale classification review saved.")).not.toBeInTheDocument();
});
it("blocks foreign-branch and malformed revision reads", async () => {
  expect(() => parseProductReview({ ...product(), taxRevision: null }, "medicine", "branch")).toThrow();
  expect(() => parseProductReview({ ...product(), dispensingRevision: -1 }, "medicine", "branch")).toThrow();
  stored = product("other-branch"); render(view()); await screen.findByText(/Product review details could not be confirmed/);
  expect(screen.queryByLabelText("Sale review reference *")).not.toBeInTheDocument(); expect(api.put).not.toHaveBeenCalled();
});
it("does not read or write review data for a cashier", async () => {
  useAuthStore.setState({ user: { ...useAuthStore.getState().user!, role: "cashier", permissions: ["PHARMACY_SELL"] } });
  render(view()); await screen.findByText("Administrator review required"); expect(api.get).not.toHaveBeenCalled(); expect(api.put).not.toHaveBeenCalled();
});
it("drops private data on authority revocation and ignores a previous-branch response", async () => {
  let finish!: (value: unknown) => void; api.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const mounted = render(view()); stored = { ...product("branch-b"), name: "Second branch product" }; mounted.rerender(view("branch-b"));
  await screen.findByText("Second branch product"); await act(async () => { finish(response([{ ...product(), name: "Old branch product" }])); });
  expect(screen.queryByText("Old branch product")).not.toBeInTheDocument();
  await act(async () => useAuthStore.setState({ user: { ...useAuthStore.getState().user!, permissions: [] } }));
  expect(screen.queryByText("Second branch product")).not.toBeInTheDocument(); expect(screen.queryByLabelText("Sale review reference *")).not.toBeInTheDocument();
});
it("locks duplicate submissions and ignores a save acknowledgement after branch change", async () => {
  let finish!: (value: unknown) => void; api.put.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const mounted = render(view()); await loaded(); sale(); fireEvent.submit(screen.getByRole("form", { name: "Sale classification review" }));
  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1)); expect(screen.getByRole("button", { name: "Close product review" })).toBeDisabled();
  stored = product("branch-b"); mounted.rerender(view("branch-b")); await loaded();
  await act(async () => { finish(response({ id: "medicine", scheduleType: "general", dispensingRevision: 1, dispensingReview: { ...evidence, scheduleType: "general", reviewReference: "Synthetic sale review 001" } })); });
  expect(changed).not.toHaveBeenCalled(); expect(screen.queryByText("Sale classification review saved.")).not.toBeInTheDocument();
});
