import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import InvitationPage from "@/app/(auth)/accept-invite/page";

const fixture = vi.hoisted(() => ({ query: "token=private-invitation", post: vi.fn(), login: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(fixture.query), useRouter: () => ({ replace: fixture.replace }) }));
vi.mock("@/lib/api", () => ({ default: { post: fixture.post } }));
vi.mock("@/store/authStore", () => ({ useAuthStore: (selector: (state: { login: typeof fixture.login }) => unknown) => selector({ login: fixture.login }) }));
afterEach(() => { cleanup(); fixture.query = "token=private-invitation"; vi.clearAllMocks(); });

function fill(password = "StrongTest1!") {
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "  Invited Staff  " } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: password } });
}
describe("Staff invitation entry", () => {
  it("does not offer an account form without the private invitation token", () => {
    fixture.query = "";
    render(<InvitationPage />);
    expect(screen.getByText(/missing its invitation token/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept invitation" })).not.toBeInTheDocument();
    expect(fixture.post).not.toHaveBeenCalled();
  });
  it("validates server password policy before submitting", () => {
    render(<InvitationPage />); fill("StrongTest1");
    fireEvent.submit(screen.getByRole("button", { name: "Accept invitation" }).closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent(/special character/);
    expect(fixture.post).not.toHaveBeenCalled();
  });
  it("submits only account fields and token, blocks duplicate submission, and uses the server identity", async () => {
    let resolve!: (result: unknown) => void;
    fixture.post.mockReturnValue(new Promise(done => { resolve = done; }));
    render(<InvitationPage />); fill();
    const form = screen.getByRole("button", { name: "Accept invitation" }).closest("form")!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(fixture.post).toHaveBeenCalledTimes(1);
    expect(fixture.post).toHaveBeenCalledWith("/auth/accept-invitation", { token: "private-invitation", name: "Invited Staff", password: "StrongTest1!", phone: undefined });
    expect(screen.getByLabelText("Full name")).toBeDisabled();
    const user = { id: "staff", role: "doctor", organization_id: "scoped-organization", permissions: ["VIEW_PATIENTS"] };
    await act(async () => resolve({ data: { data: { user } } }));
    expect(fixture.login).toHaveBeenCalledWith(user);
    expect(fixture.replace).toHaveBeenCalledWith("/dashboard");
  });
  it("keeps the form and presents expired-link feedback without changing identity", async () => {
    fixture.post.mockRejectedValue({ response: { data: { message: "Invalid or expired invitation token" } } });
    render(<InvitationPage />); fill();
    fireEvent.submit(screen.getByRole("button", { name: "Accept invitation" }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/expired/));
    expect(fixture.login).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Accept invitation" })).toBeEnabled();
  });
});
