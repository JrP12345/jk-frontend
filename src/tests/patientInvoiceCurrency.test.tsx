import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PatientBillsPage from "@/app/(dashboard)/dashboard/bills/page";
import { ToastProvider } from "@/components/ui";
import api from "@/lib/api";
import { printHtml } from "@/lib/printBrand";

const patientUser = vi.hoisted(() => ({ id: "patient", role: "patient" }));
vi.mock("@/store/authStore", () => ({ useAuthStore: () => ({ user: patientUser }) }));
vi.mock("@/lib/printBrand", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/printBrand")>(), printHtml: vi.fn().mockResolvedValue(undefined),
}));

const invoice = {
  id: "invoice", appointmentId: "appointment", invoiceNumber: "USD-1", currency: "USD", totalAmount: 125, subtotal: 125, tax: 0, discount: 0,
  balanceDue: 125, status: "unpaid", createdAt: "2026-09-29T12:00:00Z",
  items: [{ description: "Consultation", amount: 125, quantity: 1 }],
  locationId: { id: "clinic", name: "US Clinic", city: "New York", address: "Real Street" },
  doctorId: { id: "doctor", name: "Real Doctor" }, patientId: { userId: { name: "Real Patient" } },
};

beforeEach(() => { vi.restoreAllMocks(); vi.mocked(printHtml).mockClear(); });

describe("patient invoice currency", () => {
  it("shows USD and reception payment for a foreign unpaid invoice", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { data: [invoice] } });
    render(<ToastProvider><PatientBillsPage /></ToastProvider>);
    expect(await screen.findAllByText("$125")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Pay Online|Pay Balance/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Pay at reception")).not.toHaveLength(0);
    expect(screen.queryByText(/₹125/)).not.toBeInTheDocument();
  });

  it("preserves the payment action for INR invoices", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { data: [{ ...invoice, currency: undefined }] } });
    render(<ToastProvider><PatientBillsPage /></ToastProvider>);
    expect(await screen.findAllByRole("button", { name: /Pay Online/ })).not.toHaveLength(0);
    expect(screen.getAllByText("₹125")).not.toHaveLength(0);
  });

  it("prints a paid foreign receipt in its saved currency", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { data: [{ ...invoice, status: "paid", balanceDue: 0 }] } });
    render(<ToastProvider><PatientBillsPage /></ToastProvider>);
    fireEvent.click((await screen.findAllByRole("button", { name: "Preview receipt" }))[0]);
    fireEvent.click(screen.getByRole("button", { name: "Print receipt" }));
    expect(printHtml).toHaveBeenCalledOnce();
    expect(vi.mocked(printHtml).mock.calls[0][0]).toContain("$125");
    expect(vi.mocked(printHtml).mock.calls[0][0]).not.toContain("₹");
  });
});
