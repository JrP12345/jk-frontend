import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { PharmacyShortbook } from "@/components/pharmacy/PharmacyShortbook";
import { useAuthStore } from "@/store/authStore";
const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
const product = { id: "medicine", name: "Shortbook medicine", price: 15, stockQuantity: 0, rackLocation: "A3", unitDefinition: { version: 2, baseUnit: "piece", packUnit: "box", unitsPerPack: 10 } };
const entry = { id: "entry", medicineId: "medicine", quantity: 21, unitVersion: 2, note: "Supplier delivery pending", status: "open", revision: 3, updatedAt: "2026-11-15T10:00:00Z", product };
const response = (items: unknown[], nextCursor: string | null = null) => ({ data: { data: { items, nextCursor } } });
const onDraft = vi.fn();
const mount = (initialProduct = product) => render(<PharmacyShortbook locationId="branch" canManage initialProduct={initialProduct} onDraft={onDraft} />);
beforeEach(() => {
  vi.clearAllMocks(); useAuthStore.setState({ user: { id: "buyer", name: "Buyer", role: "pharmacy_manager", email: "test@example.test", organization_id: "org", permissions: ["PHARMACY_PURCHASE"] } });
  api.get.mockResolvedValue(response([entry])); api.put.mockResolvedValue({ data: { data: { id: entry.id, revision: 4 } } });
});
it("loads the existing shortage before editing and saves with its revision and current base unit", async () => {
  mount(); const quantity = await screen.findByLabelText("Shortbook quantity (piece)"); expect(quantity).toHaveValue(21);
  fireEvent.change(quantity, { target: { value: "31" } }); fireEvent.click(screen.getByRole("button", { name: "Save shortbook entry" }));
  await screen.findByText("Shortbook saved. Stock and supplier balances are unchanged.");
  expect(api.put).toHaveBeenCalledWith("/pharmacy/shortbook/medicine", { locationId: "branch", quantity: 31, note: entry.note, status: "open", expectedRevision: 3, expectedUnitVersion: 2 });
});
it("retains a conflicting edit until the operator explicitly reloads the newer shortage", async () => {
  api.put.mockRejectedValue({ response: { data: { message: "Shortbook changed" } } });
  mount(); fireEvent.change(await screen.findByLabelText("Shortbook quantity (piece)"), { target: { value: "31" } }); fireEvent.click(screen.getByRole("button", { name: "Save shortbook entry" }));
  await screen.findByText("Shortbook changed"); expect(screen.getByLabelText("Shortbook quantity (piece)")).toHaveValue(31);
  api.get.mockResolvedValue(response([{ ...entry, quantity: 40, revision: 4 }]));
  fireEvent.click(screen.getByRole("button", { name: "Reload current shortbook entry" }));
  await waitFor(() => expect(screen.getByLabelText("Shortbook quantity (piece)")).toHaveValue(40)); expect(api.put).toHaveBeenCalledTimes(1);
});
it("requires re-entry after unit changes and never copies an incompatible shortage into a purchase", async () => {
  api.get.mockResolvedValue(response([{ ...entry, unitVersion: 1 }])); mount();
  expect(await screen.findByText("Units changed. Re-enter the quantity in the current base unit.")).toBeInTheDocument();
  expect(screen.getByLabelText("Shortbook quantity (piece)")).toHaveValue(null);
  expect(screen.getByRole("button", { name: "Copy selected to purchase draft" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Save shortbook entry" })); await screen.findByText("Enter 1 to 1,000,000 whole base units."); expect(api.put).not.toHaveBeenCalled();
});
it("copies selected quantities to the existing draft form without resolving shortages or creating stock", async () => {
  mount(); fireEvent.click(await screen.findByRole("checkbox", { name: "Include Shortbook medicine in purchase draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Copy selected to purchase draft" }));
  expect(onDraft).toHaveBeenCalledWith({ lines: [{ product, quantity: 21 }], notes: "Shortbook entry" }); expect(api.put).not.toHaveBeenCalled();
});
it("can resolve an archived product's original shortage without assigning a replacement medicine", async () => {
  api.get.mockResolvedValue(response([{ ...entry, product: null }]));
  render(<PharmacyShortbook locationId="branch" canManage onDraft={onDraft} />);
  fireEvent.click(await screen.findByRole("button", { name: "Resolve shortage medicine" }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith("/pharmacy/shortbook/medicine", expect.objectContaining({ status: "resolved", quantity: 21, expectedUnitVersion: 2, expectedRevision: 3 })));
  expect(onDraft).not.toHaveBeenCalled();
});
it("does not expose old branch entries after a scope switch while a read is pending", async () => {
  let finish!: (value: unknown) => void;
  api.get.mockImplementation((url: string) => url.includes("locationId=branch") ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(response([])));
  const view = render(<PharmacyShortbook locationId="branch" canManage onDraft={onDraft} />);
  view.rerender(<PharmacyShortbook locationId="other" canManage={false} onDraft={onDraft} />);
  await act(async () => { finish(response([entry])); });
  expect(screen.queryByText(product.name)).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Save shortbook entry" })).not.toBeInTheDocument();
});
