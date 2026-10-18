import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import BillingPage from "@/app/(dashboard)/dashboard/billing/page";
import { ToastProvider } from "@/components/ui/Toast";
import { useAuthStore } from "@/store/authStore";

const fixture = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), fetchLocations: vi.fn(), locations: [{ id: "clinic", name: "Sample clinic", city: "Surat" }, { id: "branch", name: "Branch clinic", city: "Valsad" }] }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get, post: fixture.post, put: fixture.put } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/store/locationStore", () => ({ useLocationStore: Object.assign(() => ({ locations: fixture.locations, fetchLocations: fixture.fetchLocations }), { getState: () => ({ reset: () => {} }) }) }));
const invoice = { id: "invoice-a", invoiceNumber: "INV-001", patientId: { id: "patient", name: "Sample walk-in", phone: "9876543210" }, locationId: fixture.locations[0], doctorId: { id: "doctor", name: "Sample doctor" }, items: [{ description: "Consultation", amount: 500, quantity: 1 }], subtotal: 500, tax: 0, discount: 0, totalAmount: 500, amountPaid: 100, balanceDue: 400, currency: "INR", status: "partially_paid", createdAt: "2026-10-18T08:00:00Z" };
const appointment = (id: string) => ({ id, tokenNumber: id === "a" ? 1 : 2, patientId: { name: "Patient " + id }, status: "completed", locationId: fixture.locations[0], paymentStatus: "unpaid" });
const preview = (id: string, extra = {}) => ({ appointment: appointment(id), items: [{ description: "Charges for " + id, category: "consultation", amount: 500, quantity: 1, gstRate: 0 }], subtotal: 500, totalAmount: 500, cgstTotal: 0, sgstTotal: 0, consultationFee: 500, isAlreadyPaid: false, ...extra });
const summary = (locationId: string) => ({ locationId, date: "2026-10-18", systemTotals: { cash: 500, upi: 200, card: 100, other: 0, total: 800, invoiceCount: 3 } });
const response = (data: unknown, count = 1, pages = 1) => ({ data: { data }, headers: { "x-total-count": String(count), "x-total-pages": String(pages) } });
const deferred = () => { let resolve!: (value: unknown) => void; let reject!: (reason: unknown) => void; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const changeSelect = (element: HTMLElement, value: string) => { const select = element instanceof HTMLSelectElement ? element : document.getElementById(element.id.replace(/-trigger$/, "")); if (!select) throw new Error("Native select missing"); fireEvent.change(select, { target: { value } }); };
const mount = () => render(<ToastProvider><BillingPage /></ToastProvider>);
async function rowPayment() { fireEvent.click((await screen.findAllByRole("button", { name: "Record payment" }))[0]); return screen.getByRole("dialog", { name: "Record payment" }); }
async function tools(label: string) { fireEvent.click(screen.getByRole("button", { name: "Billing tools" })); fireEvent.click(await screen.findByRole("menuitem", { name: label })); }

beforeEach(() => {
  useAuthStore.setState({ user: { id: "cashier", name: "Sample cashier", email: "cashier@example.test", role: "cashier", organization_id: "org", permissions: ["VIEW_BILLING", "MANAGE_BILLING"] } });
  fixture.post.mockReset().mockImplementation(async (url: string) => response(url === "/billing/till/close" ? { ...summary("branch"), cashVariance: -50, actualCashCounted: 450, shiftDate: "2026-10-18", endedAt: "2026-10-18T12:00:00Z" } : { invoiceNumber: "INV-NEW" })); fixture.put.mockReset().mockResolvedValue(response({})); fixture.fetchLocations.mockReset();
  fixture.get.mockReset().mockImplementation(async (url: string) => {
    if (url.startsWith("/invoices")) return response([invoice]);
    if (url.startsWith("/appointments")) return response([appointment("a"), appointment("b")]);
    if (url.startsWith("/billing/checkout/preview/")) return response(preview(url.includes("/preview/b") ? "b" : "a"));
    if (url.startsWith("/billing/till/summary")) return response(summary(new URLSearchParams(url.split("?")[1]).get("locationId") || "clinic"));
    if (url.startsWith("/patients")) return response([invoice.patientId]);
    if (url.startsWith("/onboarding/doctors/assignments")) return response([{ doctorId: invoice.doctorId, consultationFee: 0 }]);
    return response([]);
  });
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("shows unlinked patient identities, paginates server invoices, and resets pagination when tabs change", async () => {
  fixture.get.mockResolvedValue(response([invoice], 41, 3)); mount(); await screen.findAllByText("Sample walk-in");
  expect(screen.getByText("41 invoices")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(fixture.get).toHaveBeenCalledWith("/invoices?page=2&limit=20", expect.objectContaining({ signal: expect.any(AbortSignal) })));
  await screen.findByText("Page 2 / 3");
  fireEvent.click(screen.getByRole("tab", { name: "Part paid" }));
  await waitFor(() => expect(fixture.get).toHaveBeenCalledWith("/invoices?page=1&limit=20&status=partially_paid", expect.anything()));
  expect(screen.getByRole("tab", { name: "Part paid" })).toHaveAttribute("aria-selected", "true");
  fireEvent.change(screen.getByRole("textbox", { name: "Search invoices on this page" }), { target: { value: "missing" } });
  expect(screen.getAllByText(/No matches on this page/).length).toBeGreaterThan(0);
});

it("ignores stale status results and recovers a failed request without showing the previous scope", async () => {
  mount(); await screen.findAllByText("Sample walk-in");
  const old = deferred(); const current = deferred();
  fixture.get.mockImplementation((url: string) => url.includes("status=paid") ? current.promise : old.promise);
  fireEvent.click(screen.getByRole("tab", { name: "Unpaid" }));
  expect(screen.queryByText("Sample walk-in")).not.toBeInTheDocument();
  await waitFor(() => expect(fixture.get).toHaveBeenCalledWith(expect.stringContaining("status=unpaid"), expect.anything()));
  fireEvent.click(screen.getByRole("tab", { name: "Paid", exact: true }));
  await act(async () => old.resolve(response([{ ...invoice, patientId: { name: "Old result" } }])));
  expect(screen.queryByText("Old result")).not.toBeInTheDocument();
  await act(async () => current.reject(new Error("offline")));
  expect(await screen.findByText("Unable to load results")).toBeInTheDocument();
  fixture.get.mockResolvedValue(response([{ ...invoice, status: "paid" }])); fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findAllByText("Sample walk-in");
});

it("submits the pinned payment form for the correct invoice, with a partial amount and reference", async () => {
  mount(); const dialog = await rowPayment(); const submit = within(dialog).getByRole("button", { name: "Record payment" });
  expect((submit as HTMLButtonElement).form?.id).toBe("record-payment");
  expect(within(dialog).getByLabelText("Amount (INR) *")).toHaveValue(400);
  fireEvent.change(within(dialog).getByLabelText("Amount (INR) *"), { target: { value: "125.25" } });
  fireEvent.change(within(dialog).getByLabelText("Reference (optional)"), { target: { value: "UPI-TEST" } });
  fireEvent.click(submit);
  await waitFor(() => expect(fixture.post).toHaveBeenCalledExactlyOnceWith("/invoices/invoice-a/payments", { amount: 125.25, paymentMethod: "cash", referenceNumber: "UPI-TEST", notes: "" }));
});

it("rejects overpayment, retains a failed payment for retry, and prevents dismissal during submission", async () => {
  mount(); const dialog = await rowPayment();
  const amount = within(dialog).getByLabelText("Amount (INR) *");
  fireEvent.change(amount, { target: { value: "401" } }); fireEvent.submit(document.getElementById("record-payment")!);
  await screen.findAllByText(/cannot exceed remaining balance/); expect(fixture.post).not.toHaveBeenCalled();
  fireEvent.change(amount, { target: { value: "50" } }); const write = deferred(); fixture.post.mockReturnValue(write.promise);
  fireEvent.click(within(dialog).getByRole("button", { name: "Record payment" }));
  expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
  await act(async () => write.reject(new Error("offline")));
  expect(dialog).toBeInTheDocument(); expect(amount).toHaveValue(50);
  expect(within(dialog).getByRole("button", { name: "Record payment" })).toBeEnabled();
});

it("hides financial writes from readers and does not offer a receipt for an unpaid invoice", async () => {
  useAuthStore.setState({ user: { ...useAuthStore.getState().user!, permissions: ["VIEW_BILLING"] } });
  fixture.get.mockResolvedValue(response([{ ...invoice, status: "unpaid", amountPaid: 0, balanceDue: 500 }]));
  mount(); await screen.findAllByText("Sample walk-in");
  expect(screen.queryByRole("button", { name: "Record payment" })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "New invoice" })).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Actions for invoice INV-001" })[0]);
  expect(screen.queryByRole("menuitem", { name: "Collect full payment" })).not.toBeInTheDocument(); expect(screen.queryByRole("menuitem", { name: "Preview receipt" })).not.toBeInTheDocument();
});

it("offers refund reconciliation instead of collecting another payment", async () => {
  fixture.get.mockResolvedValue(response([{ ...invoice, refundPending: true, appointmentId: "a" }])); mount();
  expect((await screen.findAllByRole("button", { name: "Check refund status" })).length).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: "Record payment" })).not.toBeInTheDocument();
});

it("never settles a stale checkout preview after changing the appointment", async () => {
  const first = deferred(), second = deferred();
  const original = fixture.get.getMockImplementation()!;
  fixture.get.mockImplementation((url: string) => url.includes("/checkout/preview/a") ? first.promise : url.includes("/checkout/preview/b") ? second.promise : original(url));
  mount(); await screen.findAllByText("Sample walk-in"); await tools("OPD checkout");
  const dialog = screen.getByRole("dialog", { name: "OPD checkout" });
  const save = within(dialog).getByRole("button", { name: "Collect & issue invoice" }); expect(save).toBeDisabled();
  const select = await within(dialog).findByLabelText("Today's appointment"); changeSelect(select, "b");
  await act(async () => first.resolve(response(preview("a"))));
  expect(within(dialog).queryByText("Charges for a")).not.toBeInTheDocument(); expect(save).toBeDisabled();
  await act(async () => second.resolve(response(preview("b"))));
  expect(await within(dialog).findByText("Charges for b")).toBeInTheDocument(); expect(save).toBeEnabled();
  expect((save as HTMLButtonElement).form?.id).toBe("checkout-payment");
  fireEvent.click(save);
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/billing/checkout/consolidate", expect.objectContaining({ appointmentId: "b", amountPaid: 500, paymentMethod: "cash", discount: 0 })));
});

it("blocks already-paid checkout and exposes a retry for failed charge reads", async () => {
  const original = fixture.get.getMockImplementation()!;
  fixture.get.mockImplementation((url: string) => url.includes("/checkout/preview/") ? Promise.reject(new Error("offline")) : original(url));
  mount(); await screen.findAllByText("Sample walk-in"); await tools("OPD checkout"); const dialog = screen.getByRole("dialog", { name: "OPD checkout" });
  await within(dialog).findByText("Charges could not be loaded. Try again.");
  expect(within(dialog).getByRole("button", { name: "Collect & issue invoice" })).toBeDisabled();
  fixture.get.mockImplementation((url: string) => url.includes("/checkout/preview/") ? Promise.resolve(response(preview("a", { isAlreadyPaid: true }))) : original(url));
  fireEvent.click(within(dialog).getByRole("button", { name: "Try again" }));
  await within(dialog).findByText("Already paid"); expect(within(dialog).getByRole("button", { name: "Collect & issue invoice" })).toBeDisabled(); expect(fixture.post).not.toHaveBeenCalled();
});

it("waits for a location-specific till summary and requires a reason for a difference", async () => {
  mount(); await screen.findAllByText("Sample walk-in"); await tools("Close till / daily report");
  const dialog = screen.getByRole("dialog", { name: "Close till" }); const save = within(dialog).getByRole("button", { name: "Close till & save report" });
  await within(dialog).findByLabelText(/Actual Physical Cash Counted/);
  const original = fixture.get.getMockImplementation()!;
  const read = deferred(); fixture.get.mockImplementation((url: string) => url.includes("/till/summary") ? read.promise : original(url));
  changeSelect(within(dialog).getByLabelText("Location *"), "branch"); expect(save).toBeDisabled();
  await act(async () => read.reject(new Error("offline"))); expect(save).toBeDisabled();
  expect(await within(dialog).findByText("Till totals could not be loaded. Try again.")).toBeInTheDocument();
  fixture.get.mockImplementation((url: string) => url.includes("/till/summary") ? Promise.resolve(response(summary("branch"))) : original(url)); fireEvent.click(within(dialog).getByRole("button", { name: "Try again" }));
  const cash = await within(dialog).findByLabelText(/Actual Physical Cash Counted/); fireEvent.change(cash, { target: { value: "450" } });
  fireEvent.submit(document.getElementById("close-till")!); expect(fixture.post).not.toHaveBeenCalled();
  fireEvent.change(within(dialog).getByLabelText("Reason for difference *"), { target: { value: "Verified shortage" } });
  expect((save as HTMLButtonElement).form?.id).toBe("close-till"); fireEvent.click(save);
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/billing/till/close", expect.objectContaining({ locationId: "branch", actualCashCounted: 450, varianceReason: "Verified shortage" })));
});

it("uses the configured zero fee without inventing a charge and preserves manual invoice creation", async () => {
  mount(); await screen.findAllByText("Sample walk-in"); fireEvent.click(screen.getByRole("button", { name: "New invoice" }));
  const dialog = screen.getByRole("dialog", { name: "New invoice" });
  changeSelect(within(dialog).getByLabelText("Location *"), "clinic");
  await waitFor(() => expect(dialog.querySelector("select option[value=doctor]")).toBeInTheDocument());
  changeSelect(within(dialog).getByLabelText("Doctor *"), "doctor");
  expect(within(dialog).getByLabelText("Charge 1 amount")).toHaveValue(0);
  fireEvent.change(within(dialog).getByLabelText("Find a patient"), { target: { value: "Sample" } }); fireEvent.click(within(dialog).getByRole("button", { name: "Search", exact: true }));
  fireEvent.click(await within(dialog).findByRole("button", { name: "Select", exact: true }));
  fireEvent.change(within(dialog).getByLabelText("Charge 1 amount"), { target: { value: "75" } });
  const save = within(dialog).getByRole("button", { name: "Create invoice" }); expect((save as HTMLButtonElement).form?.id).toBe("create-invoice"); fireEvent.click(save);
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/invoices", expect.objectContaining({ patientId: "patient", locationId: "clinic", doctorId: "doctor", items: [{ description: "General Consultation Fee", amount: 75, quantity: 1 }], tax: 0, discount: 0 })));
});

it("keeps currencies separate and counts the remaining partial balance in the page summary", async () => {
  fixture.get.mockResolvedValue(response([invoice, { ...invoice, id: "usd", currency: "USD", totalAmount: 20, balanceDue: 20, amountPaid: 0 }]));
  mount(); await screen.findAllByText("Sample walk-in");
  fireEvent.click(screen.getByText("Page summary"));
  expect(screen.getByText(/Invoiced.*INR/)).toBeInTheDocument(); expect(screen.getByText(/Invoiced.*USD/)).toBeInTheDocument();
  expect(screen.getByText("Totals for invoices on this page, grouped by currency. These are not daily collection totals.")).toBeInTheDocument();
  expect(screen.getAllByText(/400/).length).toBeGreaterThan(0);
});

it("uses the pinned full-payment action without changing the collection endpoint", async () => {
  fixture.get.mockResolvedValue(response([{ ...invoice, status: "unpaid", amountPaid: 0, balanceDue: 500 }])); mount();
  fireEvent.click((await screen.findAllByRole("button", { name: "Actions for invoice INV-001" }))[0]);
  fireEvent.click(await screen.findByRole("menuitem", { name: "Collect full payment" }));
  const dialog = screen.getByRole("dialog", { name: "Collect full payment" });
  const save = within(dialog).getByRole("button", { name: "Record payment" }); expect((save as HTMLButtonElement).form?.id).toBe("collect-payment");
  fireEvent.click(save); await waitFor(() => expect(fixture.put).toHaveBeenCalledExactlyOnceWith("/invoices/invoice-a/pay", { paymentMethod: "cash" }));
});

it("shows the actual partial amount on a receipt and keeps the full invoice amount separate", async () => {
  mount(); fireEvent.click((await screen.findAllByRole("button", { name: "Actions for invoice INV-001" }))[0]);
  fireEvent.click(await screen.findByRole("menuitem", { name: "Preview receipt" }));
  const dialog = screen.getByRole("dialog", { name: "Payment receipt" });
  expect(within(dialog).getByText("Sample walk-in")).toBeInTheDocument();
  expect(within(dialog).getByText("Recorded payments").parentElement).toHaveTextContent("100");
  expect(within(dialog).getByText("Invoice total").parentElement).toHaveTextContent("500");
  expect(within(dialog).getByText("Balance due").parentElement).toHaveTextContent("400");
  expect(fixture.post).not.toHaveBeenCalled();
});

it("requires an adjusted consultation fee to be applied before settling", async () => {
  const original = fixture.get.getMockImplementation()!;
  fixture.get.mockImplementation((url: string) => url.includes("/checkout/preview/") ? Promise.resolve(response(preview("a", { isFeeEditable: true, consultationFee: url.includes("customConsultFee=600") ? 600 : 500, totalAmount: url.includes("customConsultFee=600") ? 600 : 500 }))) : original(url));
  mount(); await screen.findAllByText("Sample walk-in"); await tools("OPD checkout"); const dialog = screen.getByRole("dialog", { name: "OPD checkout" });
  const fee = await within(dialog).findByLabelText("Consultation fee"); const save = within(dialog).getByRole("button", { name: "Collect & issue invoice" });
  fireEvent.change(fee, { target: { value: "600" } }); expect(save).toBeDisabled();
  fireEvent.submit(document.getElementById("checkout-payment")!); expect(fixture.post).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Apply" }));
  expect(within(dialog).getByLabelText("Consultation fee")).toHaveValue(600);
  expect(save).toBeDisabled();
  await waitFor(() => expect(save).toBeEnabled()); fireEvent.click(save);
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/billing/checkout/consolidate", expect.objectContaining({ appointmentId: "a", customConsultationFee: 600, amountPaid: 600 })));
});

it("loads every appointment page for checkout and clears patient-specific payment details when switching", async () => {
  const original = fixture.get.getMockImplementation()!;
  fixture.get.mockImplementation((url: string) => url.startsWith("/appointments?") ? Promise.resolve(response([appointment(url.includes("page=2") ? "b" : "a")], 2, 2)) : original(url));
  mount(); await screen.findAllByText("Sample walk-in"); await tools("OPD checkout");
  const dialog = screen.getByRole("dialog", { name: "OPD checkout" });
  await within(dialog).findByText("Charges for a");
  expect(fixture.get).toHaveBeenCalledWith(expect.stringContaining("page=2&limit=100"), expect.anything());
  fireEvent.change(within(dialog).getByLabelText(/Discount \/ Waiver/), { target: { value: "100" } });
  fireEvent.change(within(dialog).getByLabelText(/Transaction \/ UTR Reference/), { target: { value: "First patient reference" } });
  changeSelect(within(dialog).getByLabelText("Today's appointment"), "b");
  await within(dialog).findByText("Charges for b");
  expect(within(dialog).getByLabelText(/Discount \/ Waiver/)).toHaveValue(null);
  expect(within(dialog).getByLabelText(/Transaction \/ UTR Reference/)).toHaveValue("");
});

it("removes patient invoices and open payment forms when the authorized workspace changes", async () => {
  mount(); await rowPayment(); const old = deferred(); fixture.get.mockReturnValue(old.promise);
  act(() => useAuthStore.setState({ user: { ...useAuthStore.getState().user!, organization_id: "other-org" } }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(screen.queryByText("Sample walk-in")).not.toBeInTheDocument();
  await act(async () => old.resolve(response([])));
  expect(screen.queryByText("Sample walk-in")).not.toBeInTheDocument(); expect(fixture.post).not.toHaveBeenCalled();
});

it("retries a failed doctor lookup inside the invoice dialog without creating a charge", async () => {
  const original = fixture.get.getMockImplementation()!; let fail = true;
  fixture.get.mockImplementation((url: string) => url.startsWith("/onboarding/doctors/assignments") && fail ? Promise.reject(new Error("offline")) : original(url));
  mount(); await screen.findAllByText("Sample walk-in"); fireEvent.click(screen.getByRole("button", { name: "New invoice" }));
  const dialog = screen.getByRole("dialog", { name: "New invoice" });
  changeSelect(within(dialog).getByLabelText("Location *"), "clinic");
  expect(await within(dialog).findByText("Doctors could not be loaded. Try again.")).toBeInTheDocument();
  fail = false; fireEvent.click(within(dialog).getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(dialog.querySelector("select option[value=doctor]")).toBeInTheDocument());
  expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument(); expect(fixture.post).not.toHaveBeenCalled();
});
