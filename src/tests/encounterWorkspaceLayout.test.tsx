import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EncounterWorkspace } from "@/components/clinical/EncounterWorkspace";
import { ToastProvider } from "@/components/ui";

const fixture = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn(), get: vi.fn(), refresh: vi.fn(), orders: [] as unknown[], ordersError: null as string | null, canManageOrders: true, loading: false }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api", () => ({ default: { post: fixture.post, put: fixture.put, get: fixture.get } }));
vi.mock("@/providers/EncounterProvider", () => ({ useEncounterContext: () => ({ encounterId: "encounter", locationId: "clinic", doctorId: "doctor", orders: fixture.orders, error: fixture.ordersError, loading: fixture.loading, refreshOrders: fixture.refresh }) }));
vi.mock("@/store/authStore", () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: { permissions: ["MANAGE_BILLING", "MANAGE_QUEUE", ...(fixture.canManageOrders ? ["MANAGE_ORDERS"] : [])] } }) }));
vi.mock("@/components/clinical/SOAPNoteEditor", async () => { const React = await import("react"); return { SOAPNoteEditor: function Editor() { const [text, setText] = React.useState(""); return <input aria-label="Clinical draft" value={text} onChange={event => setText(event.target.value)} />; } }; });
vi.mock("@/components/clinical/PatientSearchModal", () => ({ PatientSearchModal: () => null }));
vi.mock("@/components/ehr/PatientTimeline", () => ({ PatientTimeline: () => null }));
vi.mock("@/components/clinical/NEWS2Calculator", () => ({ NEWS2Calculator: () => null }));
beforeEach(() => { fixture.post.mockReset().mockResolvedValue({ data: { data: {} } }); fixture.get.mockReset().mockResolvedValue({ data: { data: [{ id: "test-id", name: "Recorded test", code: "RT" }] }, headers: {} }); fixture.refresh.mockReset(); fixture.orders = []; fixture.ordersError = null; fixture.canManageOrders = true; fixture.loading = false; Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() }); });
afterEach(cleanup);
function mount() { return render(<ToastProvider><EncounterWorkspace patient={{ id: "patient", name: "Sample patient" }} appointmentId="visit" /></ToastProvider>); }

it("retains an unsaved note when switching to another workspace tab", () => {
  mount(); fireEvent.change(screen.getByRole("textbox", { name: "Clinical draft" }), { target: { value: "Unsaved clinical text" } });
  fireEvent.click(screen.getByRole("tab", { name: /Orders/ }));
  expect(screen.getByDisplayValue("Unsaved clinical text")).not.toBeVisible();
  fireEvent.click(screen.getByRole("tab", { name: "Notes" }));
  expect(screen.getByDisplayValue("Unsaved clinical text")).toBeVisible();
});

it("submits the lab order from the pinned action with the same encounter and patient references", async () => {
  mount(); fireEvent.click(screen.getByRole("tab", { name: /Orders/ })); fireEvent.click(screen.getByRole("button", { name: /Order test/ }));
  const dialog = await screen.findByRole("dialog", { name: "Order test" });
  await waitFor(() => expect(within(dialog).getByRole("combobox", { name: "Lab test *" })).toBeEnabled());
  fireEvent.click(within(dialog).getByRole("combobox", { name: "Lab test *" }));
  fireEvent.click(await screen.findByRole("option", { name: "Recorded test (RT)" }));
  const submit = within(dialog).getByRole("button", { name: "Place order" });
  expect((submit as HTMLButtonElement).form?.id).toBe("encounter-lab-order"); fireEvent.click(submit);
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/encounters/encounter/orders", { encounterId: "encounter", patientId: "patient", locationId: "clinic", doctorId: "doctor", testId: "test-id", priority: "routine", clinicalReason: "" }));
});

it("shows an actual zero laboratory result instead of hiding it", () => {
  fixture.orders = [{ id: "lab", testId: { name: "Recorded result" }, status: "completed", result: { value: 0, unit: "units" } }];
  mount(); fireEvent.click(screen.getByRole("tab", { name: /Orders/ }));
  expect(screen.getAllByText(/^0/).length).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: "Record Result" })).not.toBeInTheDocument();
});

it("distinguishes unavailable orders from an empty order history and exposes retry", () => {
  fixture.ordersError = "Unable to load diagnostic orders. Please retry.";
  mount(); fireEvent.click(screen.getByRole("tab", { name: /Orders/ }));
  expect(screen.getByText("Lab orders unavailable")).toBeInTheDocument();
  expect(screen.queryByText("No diagnostic orders placed yet for this encounter.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" })); expect(fixture.refresh).toHaveBeenCalledOnce();
});

it("cancels the next-patient arrival dialog without confirming a second request", async () => {
  fixture.post.mockRejectedValue({ response: { data: { details: "ARRIVAL_CONFIRMATION_REQUIRED", data: { id: "candidate", tokenNumber: 8 } } } });
  mount(); fireEvent.click(screen.getByRole("button", { name: "Next patient" }));
  const dialog = await screen.findByRole("dialog", { name: "Confirm patient arrival" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(fixture.post).toHaveBeenCalledTimes(1);
});

it("keeps order management actions unavailable without the server's order-management permission", () => {
  fixture.canManageOrders = false;
  fixture.orders = [{ id: "lab", testId: { name: "Processing test" }, status: "processing" }];
  mount(); fireEvent.click(screen.getByRole("tab", { name: /Orders/ }));
  expect(screen.queryByRole("button", { name: /Order test|Record Result|Cancel Order/ })).not.toBeInTheDocument();
});

it.each(["High", "Normal", "Critical"])("requires an explicit result interpretation and preserves the selected %s classification", async interpretation => {
  fixture.put.mockReset().mockResolvedValue({ data: { data: {} } });
  fixture.orders = [{ id: "processing-lab", testId: { name: "Pending test" }, status: "processing" }];
  mount(); fireEvent.click(screen.getByRole("tab", { name: /Orders/ }));
  fireEvent.click(screen.getAllByRole("button", { name: "Record Result" })[0]);
  const dialog = await screen.findByRole("dialog", { name: "Record result" });
  const save = within(dialog).getByRole("button", { name: "Save result" }); expect(save).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText("Result Value *"), { target: { value: "0" } }); expect(save).toBeDisabled();
  fireEvent.click(within(dialog).getByRole("combobox", { name: "Interpretation *" }));
  fireEvent.click(await screen.findByRole("option", { name: interpretation, exact: true }));
  expect((save as HTMLButtonElement).form?.id).toBe("encounter-lab-result"); fireEvent.click(save);
  await waitFor(() => expect(fixture.put).toHaveBeenCalledWith("/orders/processing-lab/result", { value: "0", unit: "", referenceRange: "", interpretation: interpretation.toLowerCase() }));
});

it("opens clinical notes immediately while only diagnostic orders are still loading", () => {
  fixture.loading = true; mount();
  expect(screen.getByRole("textbox", { name: "Clinical draft" })).toBeVisible();
  expect(screen.queryByRole("status", { name: "Loading encounter" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: /Orders/ }));
  expect(screen.getByRole("status", { name: "Loading lab orders" })).toBeInTheDocument();
  expect(screen.queryByText("No diagnostic orders placed yet for this encounter.")).not.toBeInTheDocument();
});
