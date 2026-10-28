import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Directory from "@/app/(dashboard)/dashboard/patients/page";
import { ToastProvider } from "@/components/ui/Toast";
const fixture = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), push: vi.fn(), permissions: ["MANAGE_PATIENTS", "VIEW_PATIENTS"] }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get, post: fixture.post } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: fixture.push }) }));
vi.mock("@/store/authStore", () => ({ useAuthStore: (selector?: (state: unknown) => unknown) => { const state = { user: { id: "desk", role: "receptionist", organization_id: "org", permissions: fixture.permissions } }; return selector ? selector(state) : state; } }));
const patient = { id: "patient", name: "Registered patient", phone: "9876543210", gender: "male", allergies: [], conditions: [] };
const response = (data: unknown) => ({ data: { data }, headers: { "x-total-count": "1", "x-total-pages": "1" } });
function mount() { return render(<ToastProvider><Directory /></ToastProvider>); }
async function registration() {
  fireEvent.click(screen.getByRole("button", { name: "Register patient" }));
  const dialog = await screen.findByRole("dialog", { name: "Register patient" });
  fireEvent.change(within(dialog).getByLabelText("Full Name *"), { target: { value: "New patient" } });
  fireEvent.change(within(dialog).getByLabelText("Primary Phone Number"), { target: { value: "9876543211" } });
  return dialog;
}
beforeEach(() => {
  fixture.permissions = ["MANAGE_PATIENTS", "VIEW_PATIENTS"];
  fixture.get.mockReset().mockResolvedValue(response([patient])); fixture.post.mockReset().mockResolvedValue(response({ id: "new-patient" }));
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("does not fabricate an MRN and removes the empty table toolbar", async () => {
  mount(); await screen.findAllByText(patient.name);
  expect(screen.getAllByText(/Not assigned/).length).toBeGreaterThan(0);
  expect(document.body.textContent).not.toContain("MRN-PATIEN");
  expect(screen.queryByRole("button", { name: /column/i })).not.toBeInTheDocument();
  for (const link of screen.getAllByRole("link", { name: patient.name })) {
    expect(link).toHaveAttribute("href", "/dashboard/patients/patient");
    expect(link.closest('[role="button"]')).toBeNull();
  }
});

it("hides old search results immediately and recovers from a failed read", async () => {
  mount(); await screen.findAllByText(patient.name);
  let reject!: (reason: unknown) => void;
  fixture.get.mockImplementation(() => new Promise((_resolve, fail) => { reject = fail; }));
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Different person" } });
  expect(screen.queryByText(patient.name)).not.toBeInTheDocument();
  expect(screen.queryByText("No patient profiles found matching your search criteria.")).not.toBeInTheDocument();
  await waitFor(() => expect(reject).toBeDefined());
  await act(async () => reject(new Error("offline")));
  expect(await screen.findByText("Unable to load results")).toBeInTheDocument();
  fixture.get.mockResolvedValue(response([patient]));
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect((await screen.findAllByText(patient.name)).length).toBeGreaterThan(0);
});

it("submits the pinned registration action with its original request identifier", async () => {
  mount(); const dialog = await registration();
  const save = within(dialog).getByRole("button", { name: "Register patient" });
  expect((save as HTMLButtonElement).form?.id).toBe("patient-registration");
  fireEvent.click(save);
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/patients", expect.objectContaining({ name: "New patient", phone: "9876543211", ignoreDuplicate: false, clientRequestId: expect.any(String) })));
  expect(fixture.post).toHaveBeenCalledTimes(1);
});

it("requires a reviewed reason for a separate patient after a duplicate and retains the request identifier", async () => {
  fixture.post.mockRejectedValueOnce({ response: { status: 409, data: { details: { highConfidenceMatches: [{ id: "existing", name: "Existing patient" }] } } } }).mockResolvedValue(response({ id: "new-patient" }));
  mount(); const dialog = await registration();
  const normalSave = within(dialog).getByRole("button", { name: "Register patient" });
  fireEvent.click(normalSave);
  expect(await within(dialog).findByText("Existing Matching Patient Detected")).toBeInTheDocument();
  const override = within(dialog).getByRole("button", { name: "Create separate patient after review" });
  expect(normalSave).toBeDisabled(); expect(override).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText("Why this is a different patient"), { target: { value: "Verified different family member" } });
  fireEvent.click(override);
  await waitFor(() => expect(fixture.post).toHaveBeenCalledTimes(2));
  const first = fixture.post.mock.calls[0][1], second = fixture.post.mock.calls[1][1];
  expect(second).toMatchObject({ clientRequestId: first.clientRequestId, ignoreDuplicate: true, distinctPersonReason: "Verified different family member" });
});

it("keeps registration, association, booking and clinical actions unavailable to a directory reader", async () => {
  fixture.permissions = ["VIEW_PATIENTS"];
  mount();
  expect(screen.queryByRole("button", { name: "Register patient" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Patient directory options" })).not.toBeInTheDocument();
  fireEvent.click((await screen.findAllByRole("button", { name: "Actions for Registered patient" }))[0]);
  expect(screen.queryByRole("menuitem", { name: /book appointment/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("menuitem", { name: /medical ehr timeline/i })).not.toBeInTheDocument();
});
