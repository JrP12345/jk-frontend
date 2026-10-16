import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import { useModuleStore } from "@/store/moduleStore";
afterEach(() => { cleanup(); useModuleStore.getState().reset(); });
describe("Dashboard contextual actions", () => {
  it("shows only permitted destinations for a nurse", () => {
    render(<DashboardQuickActions user={{ id: "nurse", name: "Nurse", email: "n@example.test", role: "nurse", permissions: ["VIEW_APPOINTMENTS", "MANAGE_QUEUE", "VIEW_LOCATIONS"] }} invoices={[]} canViewOpsDashboard />);
    expect(screen.getByRole("link", { name: "Queue desk" })).toHaveAttribute("href", "/dashboard/queue");
    expect(screen.queryByRole("link", { name: "Staff and clinicians" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Patient billing" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Audit log" })).not.toBeInTheDocument();
  });
  it("shows family care destinations and the remaining partial invoice balance", () => {
    render(<DashboardQuickActions user={{ id: "family", name: "Family", email: "f@example.test", role: "family_member" }} invoices={[{ id: "invoice", totalAmount: 500, amountPaid: 125, currency: "INR" }]} canViewOpsDashboard={false} />);
    expect(screen.getByRole("link", { name: "Care records and prescriptions" })).toBeInTheDocument();
    expect(screen.getByText("₹375")).toBeInTheDocument();
    expect(screen.queryByText("All Invoices Settled")).not.toBeInTheDocument();
  });
});
