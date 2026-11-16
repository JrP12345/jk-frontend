import api from "./api";

export interface CounterOverview {
  locationId: string; currency: "INR"; timezone: string; date: string; asOf: string;
  salesPaise: number; bills: number;
  drawer: { active: boolean; cashPaise: number | null } | null;
  stock: { low: number; expiring: number; expired: number; days: number } | null;
  recent: Array<{ id: string; invoiceNumber: string; issuedAt: string; totalPaise: number; status: string }>;
}
const whole = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
export async function readCounterOverview(locationId: string, signal?: AbortSignal): Promise<CounterOverview> {
  const row = (await api.get("/pharmacy/sales/overview", { params: { locationId }, signal })).data?.data as CounterOverview;
  if (!row || row.locationId !== locationId || row.currency !== "INR" || !whole(row.salesPaise) || !whole(row.bills) || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(Date.parse(row.asOf)) ||
    !Array.isArray(row.recent) || row.recent.length > 3 || new Set(row.recent.map(bill => bill.id)).size !== row.recent.length || row.recent.some(bill => !/^[a-f\d]{24}$/i.test(bill.id) || !bill.invoiceNumber || !Number.isFinite(Date.parse(bill.issuedAt)) || !whole(bill.totalPaise) || !["unpaid", "partially_paid", "paid", "refunded"].includes(bill.status)) ||
    row.drawer !== null && (!row.drawer || typeof row.drawer.active !== "boolean" || (row.drawer.active ? !whole(row.drawer.cashPaise) : row.drawer.cashPaise !== null)) ||
    row.stock !== null && (!row.stock || ![row.stock.low, row.stock.expiring, row.stock.expired].every(whole) || row.stock.days !== 90)) throw Error("Counter summary could not be verified");
  try { new Intl.DateTimeFormat("en-IN", { timeZone: row.timezone }).format(new Date(row.asOf)); } catch { throw Error("Counter summary timezone needs review"); }
  return row;
}
