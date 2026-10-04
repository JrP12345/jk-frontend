import type { PlatformDashboardData, PlatformOrganizationActivity } from "@/services/platformDashboard.service";

const organization: PlatformOrganizationActivity = {
  id: "org-paid", name: "Willow Clinic", city: "Surat", createdAt: "2026-09-01T00:00:00Z",
  planName: "Professional", status: "active", basis: "paid", expiresAt: "2026-11-01T00:00:00Z",
  doctors: 2, bookingsThisMonth: 24, bookingsLast30Days: 40, collectionsThisMonth: { INR: 1180 },
};
export const platformDashboardFixture: PlatformDashboardData = {
  generatedAt: "2026-10-15T12:00:00Z", range: "30D", timezone: "UTC",
  period: { monthStart: "2026-10-01T00:00:00Z", previousStart: "2026-09-01T00:00:00Z", previousEnd: "2026-09-15T12:00:00Z", rangeStart: "2026-09-16T00:00:00Z" },
  money: { currencies: [{ currency: "INR", month: 1180, previous: 590 }, { currency: "USD", month: 10, previous: 0 }], undatedCaptures: 0 },
  organizations: { total: 4, active: 2, trial: 1, expired: 1, inactive: 0, paymentIssue: 0, cancelled: 0, unavailable: 0, paid: 1, expiringSoon: 1, newThisMonth: 1, usingThisMonth: 2 },
  usage: { bookingsThisMonth: 28, previousBookings: 14, completedVisitsThisMonth: 19, patientsBookedThisMonth: 20, enabledDoctors: 3 },
  trend: Array.from({ length: 30 }, (_, index) => ({ date: new Date(Date.UTC(2026, 8, 16 + index)).toISOString().slice(0, 10), bookings: index % 5, collections: { INR: index === 16 ? 1180 : 0, USD: index === 19 ? 10 : 0 }, organizations: index === 18 ? 1 : 0 })),
  attention: [{ key: "trials", title: "Trials end within 7 days", count: 1, destination: "billing" }, { key: "expired", title: "Expired subscriptions", count: 1, destination: "billing" }],
  organizationActivity: {
    mostActive: [organization, { ...organization, id: "org-trial", name: "Cedar Health", status: "trial", basis: "trial", planName: "Starter", bookingsThisMonth: 4, collectionsThisMonth: {} }, { ...organization, id: "org-expired", name: "Oak Medical", status: "expired", bookingsThisMonth: 0, collectionsThisMonth: {} }],
    leastActive: [{ ...organization, id: "org-expired", name: "Oak Medical", status: "expired", bookingsThisMonth: 0, collectionsThisMonth: {} }, organization],
  },
  recentActivity: [{ id: "payment-1", kind: "payment", title: "Subscription payment captured", organizationId: organization.id, organizationName: organization.name, createdAt: "2026-10-14T09:30:00Z" }, { id: "org-event", kind: "organization", title: "Organization created", organizationId: "org-trial", organizationName: "Cedar Health", createdAt: "2026-10-12T10:00:00Z" }],
};
