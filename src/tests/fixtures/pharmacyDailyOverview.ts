import type { DailySection, PharmacyDailyOverviewData } from "@/lib/pharmacyDailyOverview";
const ready = (values: DailySection["values"], note = "Captured source records in the selected scope."): DailySection => ({ state: "ready", values, note, items: [] });
export function dailyOverviewFixture(locationId = "b".repeat(24)): PharmacyDailyOverviewData {
  return { locationId, currency: "INR", timezone: "Asia/Kolkata", date: "2026-11-22", asOf: "2026-11-22T16:30:00.000Z", period: { start: "2026-11-21T18:30:00.000Z", end: "2026-11-22T16:30:00.000Z" }, coverage: { source: "cloud", offlineSession: "none" }, paymentReview: 0,
    sections: {
      sales: ready({ bills: 3, grossSalesPaise: 5000, currentDuePaise: 1200 }),
      collections: ready({ totalPaise: 4500, cashPaise: 2000, upiPaise: 1500, cardPaise: 1000, receipts: 3 }),
      returns: ready({ creditsPaise: 100, credits: 1 }),
      margin: ready({ contributionPaise: 4000, costPaise: 900, netRevenuePaise: 4900, unknownBills: 0 }),
      customerDues: ready({ duePaise: 2500, refundPayablePaise: 0, documents: 2 }),
      supplierDues: ready({ duePaise: 10000, pendingCreditPaise: 500, refundReceivablePaise: 0 }),
      cashMovements: ready({ cashInPaise: 100, cashOutPaise: 400, refundsPaise: 100, supplierPaymentsPaise: 300 }),
      newCredit: ready({ amountPaise: 1200, bills: 1, unknownBills: 0 }),
      stock: { ...ready({ lowPhysicalProducts: 2, expiredLots: 1, expiringLots: 3, days: 60 }), items: [{ id: "c".repeat(24), label: "Synthetic low-stock medicine", units: 2, unit: "tablet" }] },
    } };
}
