import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Catalog from "@/app/(dashboard)/dashboard/billing/services/page";
import { ToastProvider } from "@/components/ui/Toast";
import api from "@/lib/api";

afterEach(() => vi.restoreAllMocks());

describe("Catalog query continuity", () => {
  it("debounces typing and ignores an older response that finishes last", async () => {
    const requests: { url: string; signal?: AbortSignal; resolve: (value: unknown) => void }[] = [];
    vi.spyOn(api, "get").mockImplementation((url, config) => new Promise(resolve => {
      requests.push({ url, signal: config?.signal as AbortSignal, resolve });
    }));
    render(<ToastProvider><Catalog /></ToastProvider>);
    await waitFor(() => expect(requests).toHaveLength(1));
    const search = screen.getByPlaceholderText("Search by code, service name, HSN/SAC...");
    fireEvent.change(search, { target: { value: "n" } });
    fireEvent.change(search, { target: { value: "new" } });
    expect(requests).toHaveLength(1);
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1].url).toContain("search=new");
    expect(requests[0].signal?.aborted).toBe(true);
    const service = (name: string) => ({ _id: name, code: name, name, category: "consultation", department: "General", price: 100, hsnSacCode: "999312", gstRate: 0, isActive: true });
    await act(async () => requests[1].resolve({ data: { data: [service("Newest service")] } }));
    expect(screen.getAllByText("Newest service").length).toBeGreaterThan(0);
    await act(async () => requests[0].resolve({ data: { data: [service("Obsolete service")] } }));
    expect(screen.queryByText("Obsolete service")).not.toBeInTheDocument();
    expect(screen.getAllByText("Newest service").length).toBeGreaterThan(0);
  });

  it("keeps a failed initial load recoverable after its toast disappears", async () => {
    vi.spyOn(api, "get").mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce({ data: { data: [] } });
    render(<ToastProvider><Catalog /></ToastProvider>);
    expect(await screen.findByText("Services could not be loaded. Check your connection and try again.")).toBeInTheDocument();
    expect(screen.getAllByText("Results are unavailable. Please try again.")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByText("Services could not be loaded. Check your connection and try again.")).not.toBeInTheDocument());
  });
});
