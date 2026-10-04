import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Portal from "@/app/(dashboard)/dashboard/patient-portal/page";
import { ToastProvider } from "@/components/ui/Toast";
const fixture = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), bloodGroup: undefined as string | undefined }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get, post: fixture.post, put: fixture.put } }));
vi.mock("@/store/authStore", () => ({ useAuthStore: () => ({ user: { id: "patient-user", name: "Review patient", email: "patient@example.test", role: "patient" } }) }));
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  fixture.get.mockImplementation(async path => ({ data: { data: path === "/patient/me" ? { patient: { id: "patient", bloodGroup: fixture.bloodGroup } } : path.includes("timeline") ? { events: [] } : [] } }));
  fixture.post.mockResolvedValue({ data: { success: true } });
  fixture.put.mockResolvedValue({ data: { success: true } });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); fixture.bloodGroup = undefined; });
describe("Recorded patient blood group", () => {
  it.each([undefined, "AB-"])("preserves recorded or unknown blood group (%s) when saving other profile information", async bloodGroup => {
    fixture.bloodGroup = bloodGroup;
    render(<ToastProvider><Portal /></ToastProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Edit Medical Info" }));
    expect(screen.getByRole("combobox", { name: "Blood Group" })).toHaveTextContent(bloodGroup || "Not recorded");
    const form = screen.getByLabelText("Address").closest("form")!;
    fireEvent.submit(form);
    await waitFor(() => expect(fixture.put).toHaveBeenCalledWith("/patient/me", expect.objectContaining({ bloodGroup })));
  });
  it("does not invent a blood group when creating a family member", async () => {
    render(<ToastProvider><Portal /></ToastProvider>);
    fireEvent.click(await screen.findByRole("button", { name: /My Family/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add Family Member" }));
    fireEvent.change(screen.getByLabelText("Full Name *"), { target: { value: "Family patient" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save Family Member" }).closest("form")!);
    await waitFor(() => expect(fixture.post).toHaveBeenCalled());
    expect(fixture.post.mock.calls[0][1]).not.toHaveProperty("bloodGroup");
  });
});
