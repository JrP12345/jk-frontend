import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemberLocationAccess from "@/components/organization/MemberLocationAccess";
import api from "@/lib/api";

vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), patch: vi.fn() } }));
vi.mock("@/components/ui", async () => ({
  Checkbox: (await import('@/components/ui/Checkbox')).default,
  Modal: ({ children, title }: { children: React.ReactNode; title: string }) => <section role="dialog" aria-label={title}>{children}</section>,
  Button: ({ children, loading, variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: string }) => {
    void loading; void variant; return <button {...props}>{children}</button>;
  },
  Select: ({ label, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: { value: string; label: string }[] }) => <label>{label}<select {...props}>{options.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>,
}));
const member = { id: "desk", name: "Desk", email: "desk@example.test", role: "receptionist", isActive: true, accessRevision: 3 };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: "a", name: "Branch A" }, { id: "b", name: "Branch B" }] } });
});
describe("Reviewed branch grants", () => {
  it("defaults unreviewed members to no selected branches and saves only the explicit choice and revision", async () => {
    const onSaved = vi.fn();
    vi.mocked(api.patch).mockResolvedValue({ data: { data: {} } });
    render(<MemberLocationAccess member={member} organizationId="clinic" onClose={vi.fn()} onSaved={onSaved} />);
    const a = await screen.findByRole("checkbox", { name: "Branch A" });
    expect(a).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Branch B" })).not.toBeChecked();
    fireEvent.click(a);
    fireEvent.click(screen.getByRole("button", { name: "Save access" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(api.patch).toHaveBeenCalledWith("/organizations/clinic/members/desk/location-access", { mode: "selected", locationIds: ["a"], expectedRevision: 3 });
  });
  it("requires reload on a concurrent revision conflict instead of overwriting a newer grant", async () => {
    const onSaved = vi.fn();
    vi.mocked(api.patch).mockRejectedValue({ response: { status: 409, data: { message: "Reload member access" } } });
    render(<MemberLocationAccess member={member} organizationId="clinic" onClose={vi.fn()} onSaved={onSaved} />);
    await screen.findByRole("checkbox", { name: "Branch A" });
    fireEvent.click(screen.getByRole("button", { name: "Save access" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Reload member access");
    expect(screen.getByRole("button", { name: "Save access" })).toBeDisabled();
    expect(onSaved).not.toHaveBeenCalled();
  });
  it("does not save a guessed grant when locations cannot be loaded", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Unavailable"));
    render(<MemberLocationAccess member={member} organizationId="clinic" onClose={vi.fn()} onSaved={vi.fn()} />);
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Save access" })).toBeDisabled();
    expect(api.patch).not.toHaveBeenCalled();
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: "a", name: "Branch A" }] } });
    fireEvent.click(screen.getByRole("button", { name: "Reload locations" }));
    await screen.findByRole("checkbox", { name: "Branch A" });
    expect(screen.getByRole("button", { name: "Save access" })).toBeEnabled();
  });
});
