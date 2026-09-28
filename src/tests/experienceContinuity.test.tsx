import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLatestRead } from "@/hooks/useLatestRead";
import { userFacingError } from "@/lib/userFacingError";
import Button from "@/components/ui/Button";
import Table from "@/components/ui/Table";
import RouteProgress from "@/components/ui/RouteProgress";
import Alert from "@/components/ui/Alert";
import { ToastProvider, useToast } from "@/components/ui/Toast";

function ServerNotice() {
  const { toast } = useToast();
  return <button onClick={() => toast({ title: "Appointment saved", description: "clinicId is required", variant: "success" })}>Show notice</button>;
}

afterEach(() => vi.useRealTimers());

describe("Experience continuity", () => {
  it("rejects superseded and unmounted reads, even when a transport ignores cancellation", async () => {
    const { result, unmount } = renderHook(() => useLatestRead());
    const first = result.current();
    const second = result.current();
    expect(first.signal.aborted).toBe(true);
    expect(first.isCurrent()).toBe(false);
    expect(second.isCurrent()).toBe(true);
    unmount();
    expect(second.signal.aborted).toBe(true);
    expect(second.isCurrent()).toBe(false);
  });

  it("keeps loaded row actions available while refreshing", () => {
    const open = vi.fn();
    render(<Table loading data={[{ id: "one", name: "Existing patient" }]} keyField="id" columns={[{ header: "Patient", accessor: "name" }, { header: "Action", render: () => <button onClick={open}>Open patient</button> }]} />);
    expect(screen.getAllByText("Existing patient")).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Open patient" })[0]);
    expect(open).toHaveBeenCalledOnce();
    expect(screen.getByRole("progressbar", { name: "Loading table data" })).toBeInTheDocument();
    expect(screen.getAllByText("Existing patient").find(element => element.closest("tbody"))!.closest("tbody")).not.toHaveClass("pointer-events-none");
  });

  it("blocks a duplicate submit and exposes the processing label", () => {
    const submit = vi.fn();
    const { rerender } = render(<Button onClick={submit}>Save</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    rerender(<Button loading loadingText="Saving changes" onClick={submit}>Save</Button>);
    const processing = screen.getByRole("button", { name: "Saving changes" });
    expect(processing).toBeDisabled();
    expect(processing).toHaveAttribute("aria-busy", "true");
    fireEvent.click(processing);
    expect(submit).toHaveBeenCalledOnce();
  });

  it("suppresses fast navigation and clears feedback when the last pending link cancels", () => {
    vi.useFakeTimers();
    render(<RouteProgress />);
    const signal = (id: string, pending: boolean) => act(() => {
      window.dispatchEvent(new CustomEvent("ekavyu:navigation-pending", { detail: { id, pending } }));
    });
    signal("fast", true);
    signal("fast", false);
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    signal("first", true);
    signal("second", true);
    act(() => vi.advanceTimersByTime(150));
    expect(screen.getByRole("progressbar", { name: "Loading page" })).toBeInTheDocument();
    signal("first", false);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    signal("second", false);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("keeps actionable validation and hides technical error details", () => {
    expect(userFacingError("Please enter a valid phone number.")).toBe("Please enter a valid phone number.");
    expect(userFacingError("Validation Error")).toBe("Validation Error");
    for (const technical of ["E11000 duplicate key collection patients", '{"stack":"private"}', "TypeError at load (/opt/src/index.ts:10:3)", "<html>Bad Gateway</html>", "Request failed with status code 500", "Network Error", "clinicId is required", "Internal Server Error", { stack: "internal" }]) {
      expect(userFacingError(technical, "Please try again.")).toBe("Please try again.");
    }
  });

  it("keeps raw service details out of inline errors and success notifications", () => {
    render(<ToastProvider><Alert variant="error" title="Could not load appointments">Request failed with status code 500</Alert><ServerNotice /></ToastProvider>);
    expect(screen.queryByText(/status code 500/i)).not.toBeInTheDocument();
    expect(screen.getByText("Please try again. If the problem continues, contact support.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show notice" }));
    expect(screen.queryByText(/clinicId/)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Notifications" })).toHaveTextContent("Open the related page for details.");
  });
});
