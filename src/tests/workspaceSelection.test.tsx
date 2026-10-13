import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginWorkspacePicker from "@/components/auth/LoginWorkspacePicker";
import api from "@/lib/api";

vi.mock("@/lib/api", () => ({ default: { post: vi.fn() } }));
vi.mock("@/components/ui", () => ({
  Modal: ({ children, title }: { children: React.ReactNode; title: string }) => <section role="dialog" aria-label={title}>{children}</section>,
  Button: ({ children, fullWidth, loading, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { fullWidth?: boolean; loading?: boolean }) => {
    void fullWidth; void loading; return <button {...props}>{children}</button>;
  },
  Select: ({ label, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: { label: string; value: string }[] }) => <label>{label}<select {...props}><option value="">Choose</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>,
}));
const selection = { workspaceRequired: true as const, workspaceToken: "one-time-proof",
  workspaces: [{ organizationId: "a", name: "Clinic A", role: "doctor" }, { organizationId: "b", name: "Clinic B", role: "receptionist" }] };
beforeEach(() => vi.clearAllMocks());

describe("Login workspace recovery", () => {
  it("requires an explicit choice and signs in only from the selected server response", async () => {
    const onSuccess = vi.fn();
    const user = { id: "staff", name: "Staff", role: "receptionist", organization_id: "b" };
    vi.mocked(api.post).mockResolvedValue({ data: { data: { user } } });
    render(<LoginWorkspacePicker selection={selection} onSuccess={onSuccess} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Open workspace" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Organization"), { target: { value: "b" } });
    fireEvent.click(screen.getByRole("button", { name: "Open workspace" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(user));
    expect(api.post).toHaveBeenCalledWith("/auth/login/workspace", { workspaceToken: selection.workspaceToken, organizationId: "b" });
  });
  it("retains selection after rejection and never fabricates an authenticated user", async () => {
    const onSuccess = vi.fn();
    vi.mocked(api.post).mockRejectedValue({ response: { status: 403, data: { message: "Workspace is unavailable" } } });
    render(<LoginWorkspacePicker selection={selection} onSuccess={onSuccess} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Organization"), { target: { value: "b" } });
    fireEvent.click(screen.getByRole("button", { name: "Open workspace" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Workspace is unavailable");
    expect(screen.getByLabelText("Organization")).toHaveValue("b");
    expect(screen.getByRole("button", { name: "Open workspace" })).toBeEnabled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
  it("requires fresh sign-in after an expired or uncertain consumed proof", async () => {
    const onCancel = vi.fn();
    vi.mocked(api.post).mockRejectedValue({ response: { status: 401, data: { message: "Sign in again" } } });
    render(<LoginWorkspacePicker selection={selection} onSuccess={vi.fn()} onCancel={onCancel} />);
    fireEvent.change(screen.getByLabelText("Organization"), { target: { value: "a" } });
    fireEvent.click(screen.getByRole("button", { name: "Open workspace" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Open workspace" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
