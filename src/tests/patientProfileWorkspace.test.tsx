import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Profile from "@/app/(dashboard)/dashboard/patients/[id]/page";
import { ToastProvider } from "@/components/ui/Toast";
const fixture = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), patientId: "patient-one", permissions: ["MANAGE_PATIENTS", "VIEW_EHR", "VIEW_BILLING"], accessMounts: 0, accessUnmounts: 0 }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get, patch: fixture.patch } }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: fixture.patientId }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/store/authStore", () => ({ useAuthStore: () => ({ user: { id: "desk", role: "receptionist", organization_id: "org", permissions: fixture.permissions } }) }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/components/patients/PatientIdentityControls", () => ({ PatientIdentityControls: () => null }));
vi.mock("@/components/patients/PatientPrivacyControls", () => ({ PatientPrivacyControls: () => null }));
vi.mock("@/components/patients/PatientRelationshipPanel", () => ({ PatientRelationshipPanel: () => null }));
vi.mock("@/components/ehr/PatientHistoryAccess", async () => {
  const React = await import("react");
  return { default: function HistoryAccessFixture() { React.useEffect(() => { fixture.accessMounts++; return () => { fixture.accessUnmounts++; }; }, []); return <p>History authorization controls</p>; } };
});
const patient = { id: "patient-one", name: "Recorded patient", phone: "9876543210", gender: "female", organizationId: "org", allergies: [], conditions: [] };
const response = (data: unknown) => ({ data: { data } });
function defaultGet(url: string) { return Promise.resolve(response(url.startsWith("/patients/") ? { patient, appointments: [] } : [])); }
function mount() { return render(<ToastProvider><Profile /></ToastProvider>); }
beforeEach(() => {
  fixture.patientId = "patient-one"; fixture.permissions = ["MANAGE_PATIENTS", "VIEW_EHR", "VIEW_BILLING"];
  fixture.get.mockReset().mockImplementation(defaultGet); fixture.patch.mockReset().mockResolvedValue(response({}));
  fixture.accessMounts = 0; fixture.accessUnmounts = 0;
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("keeps all permitted tabs available and the record-access lifecycle mounted while switching", async () => {
  mount(); await screen.findByRole("heading", { name: "Patient profile: Recorded patient" });
  for (const label of ["Overview", /Visits/, "Timeline", /Labs/, /Billing/, "Docs", "Access"]) expect(screen.getByRole("tab", { name: label })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Access" }));
  expect(screen.getByText("History authorization controls")).toBeVisible();
  fireEvent.click(screen.getByRole("tab", { name: "Overview" }));
  expect(screen.getByText("History authorization controls")).not.toBeVisible();
  expect(fixture.accessMounts).toBe(1); expect(fixture.accessUnmounts).toBe(0);
});

it("distinguishes failed auxiliary requests from empty lab and billing histories", async () => {
  fixture.get.mockImplementation(url => url.startsWith("/patients/") ? defaultGet(url) : Promise.reject(new Error("offline")));
  mount(); await screen.findByRole("heading", { name: "Patient profile: Recorded patient" });
  fireEvent.click(screen.getByRole("tab", { name: /Labs/ }));
  expect(await screen.findByText("Laboratory orders unavailable")).toBeInTheDocument();
  expect(screen.queryByText("No laboratory diagnostic orders recorded for this patient.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: /Billing/ }));
  expect(await screen.findByText("Invoices unavailable")).toBeInTheDocument();
  expect(screen.queryByText("No billing invoices found for this patient.")).not.toBeInTheDocument();
});

it("keeps auxiliary records scoped to the selected patient and displays a recorded zero result", async () => {
  const lab = { id: "lab", patientId: "patient-one", testId: { name: "Actual result" }, status: "completed", resultValue: 0, createdAt: "2026-10-18T10:00:00Z" };
  fixture.get.mockImplementation(url => url.startsWith("/lab-orders") ? Promise.resolve(response([lab, { ...lab, id: "other", patientId: "different", testId: { name: "Other patient's result" } }])) : defaultGet(url));
  mount(); await screen.findByRole("heading", { name: "Patient profile: Recorded patient" });
  fireEvent.click(screen.getByRole("tab", { name: /Labs/ }));
  expect(await screen.findByText("Actual result")).toBeInTheDocument();
  expect(within(screen.getByRole("tabpanel")).getByText("0")).toBeInTheDocument();
  expect(screen.queryByText("Other patient's result")).not.toBeInTheDocument();
  expect(screen.queryByText("Pending Results")).not.toBeInTheDocument();
});

it("submits the pinned edit action without sending clinical fields for a demographic-only editor", async () => {
  fixture.permissions = ["MANAGE_PATIENTS"];
  mount(); await screen.findByRole("heading", { name: "Patient profile: Recorded patient" });
  fireEvent.click(screen.getAllByRole("button", { name: /Edit profile/i })[0]);
  const dialog = await screen.findByRole("dialog", { name: "Edit patient profile" });
  fireEvent.change(within(dialog).getByLabelText("Full Name"), { target: { value: "Corrected name" } });
  expect(within(dialog).getByLabelText("Contact Phone")).toHaveAttribute("readonly");
  const save = within(dialog).getByRole("button", { name: "Save profile" });
  expect((save as HTMLButtonElement).form?.id).toBe("patient-profile-edit");
  fireEvent.click(save);
  await waitFor(() => expect(fixture.patch).toHaveBeenCalledWith("/patients/patient-one", { name: "Corrected name", dob: undefined, gender: "female", address: "" }));
  expect(screen.queryByRole("tab", { name: /Labs/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: /Billing/ })).not.toBeInTheDocument();
});

it("hides the previous patient's profile while the next route is loading and ignores a late response", async () => {
  const view = mount(); await screen.findByRole("heading", { name: "Patient profile: Recorded patient" });
  let finish!: (data: unknown) => void;
  fixture.get.mockImplementation(url => url.startsWith("/patients/patient-two") ? new Promise(resolve => { finish = resolve; }) : defaultGet(url));
  fixture.patientId = "patient-two"; view.rerender(<ToastProvider><Profile /></ToastProvider>);
  expect(screen.queryByRole("heading", { name: "Patient profile: Recorded patient" })).not.toBeInTheDocument();
  await waitFor(() => expect(finish).toBeDefined());
  view.unmount();
  await act(async () => finish(response({ patient: { ...patient, name: "Late patient" }, appointments: [] })));
  expect(screen.queryByText("Late patient")).not.toBeInTheDocument();
});
