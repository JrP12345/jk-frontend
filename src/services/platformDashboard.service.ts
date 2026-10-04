import api from "@/lib/api";

export type PlatformRange = "7D" | "30D" | "90D";
export type OrganizationHealth = "active" | "trial" | "expiring_soon" | "expired" | "disabled" | "cancelled" | "payment_pending" | "payment_failed" | "unavailable";
export interface PlatformOrganizationActivity {
  id: string;
  name: string;
  city: string;
  createdAt: string | null;
  planName: string;
  status: OrganizationHealth;
  basis: string;
  expiresAt: string | null;
  doctors: number;
  bookingsThisMonth: number;
  bookingsLast30Days: number;
  collectionsThisMonth: Record<string, number>;
}
export interface PlatformDashboardData {
  generatedAt: string;
  range: PlatformRange;
  timezone: "UTC";
  period: { monthStart: string; previousStart: string; previousEnd: string; rangeStart: string };
  money: { currencies: { currency: string; month: number; previous: number }[]; undatedCaptures: number };
  organizations: {
    total: number; active: number; trial: number; expired: number; inactive: number;
    paymentIssue: number; cancelled: number; unavailable: number; paid: number;
    expiringSoon: number; newThisMonth: number; usingThisMonth: number;
  };
  usage: { bookingsThisMonth: number; previousBookings: number; completedVisitsThisMonth: number; patientsBookedThisMonth: number; enabledDoctors: number };
  trend: { date: string; bookings: number; collections: Record<string, number>; organizations: number }[];
  attention: { key: string; title: string; count: number; destination: "organizations" | "billing" }[];
  organizationActivity: { mostActive: PlatformOrganizationActivity[]; leastActive: PlatformOrganizationActivity[] };
  recentActivity: { id: string; kind: string; title: string; organizationId: string | null; organizationName: string | null; createdAt: string }[];
}

export async function getPlatformDashboard(range: PlatformRange, signal?: AbortSignal): Promise<PlatformDashboardData> {
  const response = await api.get("/admin/dashboard", { params: { range }, signal });
  return response.data.data;
}
