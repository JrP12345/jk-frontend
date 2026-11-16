import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { PharmacyCounterCustomerHistory } from "@/components/pharmacy/PharmacyCounterCustomerHistory";
import { PharmacyCounterFilters } from "@/components/pharmacy/PharmacyCounterFilters";
import { counterCustomerHistory } from "@/lib/pharmacyCollections";
import { ToastProvider } from "@/components/ui";
const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
const customer = { id: "customer", name: "Recorded customer", address: "Actual address", revision: 0 };
const row = { id: "bill", invoiceNumber: "I00012627/000001", issuedAt: "2026-11-12T10:00:00Z", status: "partially_paid", totalAmount: 75, amountPaid: 25, balanceDue: 50, currency: "INR", customerSnapshot: { anonymous: false, partyId: customer.id, name: customer.name } };
const response = (value: unknown) => ({ data: { data: value } });
const page = (items = [row], nextCursor: string | null = null) => ({ customerId: customer.id, locationId: "branch", items, nextCursor });
beforeEach(() => { api.get.mockReset().mockResolvedValue(response(page())); });
it("shows selected-customer bills with received and remaining due, requesting older bills from the server", async () => {
  api.get.mockResolvedValueOnce(response(page([row], "older"))).mockResolvedValueOnce(response(page([], null)));
  render(<ToastProvider><PharmacyCounterCustomerHistory customer={customer} locationId="branch" onClose={vi.fn()} /></ToastProvider>);
  expect(await screen.findByText(row.invoiceNumber)).toBeInTheDocument();
  expect(screen.getByText(/Bill ₹75.00/)).toHaveTextContent(/Received ₹25.00.*Due ₹50.00/);
  expect(api.get).toHaveBeenCalledWith("/pharmacy/invoices?locationId=branch&customerId=customer", expect.any(Object));
  fireEvent.click(screen.getByRole("button", { name: "Older bills" }));
  await screen.findByText("No saved bills for this customer");
  expect(api.get).toHaveBeenCalledWith("/pharmacy/invoices?locationId=branch&customerId=customer&cursor=older", expect.any(Object));
});
it.each(["branch", "customer", "row"])("refuses a history response with the wrong %s scope", async kind => {
  const value = page();
  if (kind === "branch") value.locationId = "foreign";
  if (kind === "customer") value.customerId = "foreign";
  if (kind === "row") value.items = [{ ...row, customerSnapshot: { ...row.customerSnapshot, partyId: "foreign" } }];
  api.get.mockResolvedValue(response(value));
  await expect(counterCustomerHistory(customer.id, "branch")).rejects.toThrow(/could not be confirmed/);
});
it("distinguishes an opening balance from a new sale in customer history", async () => {
  api.get.mockResolvedValue(response({ ...page(), items: [{ ...row, documentVersion: 3 }] }));
  render(<ToastProvider><PharmacyCounterCustomerHistory customer={customer} locationId="branch" onClose={vi.fn()} /></ToastProvider>);
  expect(await screen.findByText(/Opening balance ₹75.00/)).toHaveTextContent(/Received ₹25.00.*Due ₹50.00/);
});
it("distinguishes an opening balance from a new sale in customer history", async () => {
  api.get.mockResolvedValue(response({ ...page(), items: [{ ...row, documentVersion: 3 }] }));
  render(<ToastProvider><PharmacyCounterCustomerHistory customer={customer} locationId="branch" onClose={vi.fn()} /></ToastProvider>);
  expect(await screen.findByText(/Opening balance ₹75.00/)).toHaveTextContent(/Received ₹25.00.*Due ₹50.00/);
});
it("ignores late customer history after switching customers", async () => {
  let finish!: (value: unknown) => void;
  api.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce(response({ ...page([]), customerId: "other" }));
  const view = render(<ToastProvider><PharmacyCounterCustomerHistory customer={customer} locationId="branch" onClose={vi.fn()} /></ToastProvider>);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  view.rerender(<ToastProvider><PharmacyCounterCustomerHistory customer={{ ...customer, id: "other", name: "Other customer" }} locationId="branch" onClose={vi.fn()} /></ToastProvider>);
  await screen.findByText("No saved bills for this customer");
  await act(async () => { finish(response(page())); });
  expect(screen.queryByText(row.invoiceNumber)).not.toBeInTheDocument();
});
it("fades only scrollable filter edges and clears the fades when the strip fits", () => {
  render(<PharmacyCounterFilters><button>All</button><button>Tablets</button></PharmacyCounterFilters>);
  const strip = screen.getByRole("group"), viewport = strip.parentElement!;
  Object.defineProperties(strip, { clientWidth: { configurable: true, value: 200 }, scrollWidth: { configurable: true, value: 500 }, scrollLeft: { configurable: true, value: 0, writable: true } });
  fireEvent.scroll(strip); expect(viewport).not.toHaveAttribute("data-fade-start"); expect(viewport).toHaveAttribute("data-fade-end");
  strip.scrollLeft = 300; fireEvent.scroll(strip); expect(viewport).toHaveAttribute("data-fade-start"); expect(viewport).not.toHaveAttribute("data-fade-end");
  Object.defineProperty(strip, "scrollWidth", { value: 200 }); strip.scrollLeft = 0; fireEvent.scroll(strip);
  expect(viewport).not.toHaveAttribute("data-fade-start"); expect(viewport).not.toHaveAttribute("data-fade-end");
});
