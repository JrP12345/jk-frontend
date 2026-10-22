export const drawerFixture = {
  id: "a".repeat(24), organizationId: "b".repeat(24), locationId: "branch", cashierId: "c".repeat(24), cashierName: "Actual cashier", organizationName: "Synthetic pharmacy", locationName: "Synthetic branch", drawerCode: "COUNTER-1",
  status: "active" as const, revision: 0, currency: "INR", timezone: "Asia/Kolkata", startedAt: "2026-10-21T08:00:00Z", openingFloatPaise: 10000,
  drawerTotals: { incoming: { cash: 0, upi: 0, card: 0, other: 0 }, outgoing: { cash: 0, upi: 0, card: 0, other: 0 }, eventIncoming: { cash: 0, upi: 0, card: 0, other: 0 }, expectedCashPaise: 10000, receiptCount: 0, eventCount: 0, invoiceCount: 0 },
};
