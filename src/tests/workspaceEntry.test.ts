import { describe, expect, it } from "vitest";
import { workspaceEntryPath } from "@/lib/workspaceEntry";

describe("workspaceEntryPath", () => {
  it("opens a counter-only account directly in counter sales", () => {
    expect(workspaceEntryPath({ role: "pharmacy_counter_sales", permissions: ["PHARMACY_SELL", "PHARMACY_COLLECT_PAYMENT"] } as any)).toBe("/dashboard/pharmacy");
  });

  it("keeps a manager and a clinical worker on their meaningful overview", () => {
    expect(workspaceEntryPath({ role: "admin", permissions: ["MANAGE_ORGANIZATION"] } as any)).toBe("/dashboard");
    expect(workspaceEntryPath({ role: "doctor", permissions: ["VIEW_APPOINTMENTS"] } as any)).toBe("/dashboard");
  });

  it("does not assume counter access from a pharmacy stock grant", () => {
    expect(workspaceEntryPath({ role: "pharmacist", permissions: ["PHARMACY_VIEW_STOCK"] } as any)).toBe("/dashboard");
  });
});
