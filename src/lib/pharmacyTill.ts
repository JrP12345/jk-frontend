export type DrawerChannel = "pharmacy" | "billing";
const root = (channel: DrawerChannel) => channel === "billing" ? "/billing/till/drawers" : "/pharmacy/till";
const operations = (channel: DrawerChannel) => channel === "billing" ? "/billing/till/drawer-operations" : "/pharmacy/till-operations";
import api from "./api";
export interface DrawerTotals { incoming: Buckets; outgoing: Buckets; eventIncoming: Buckets; expectedCashPaise: number; receiptCount: number; eventCount: number; invoiceCount: number }
type Buckets = { cash: number; upi: number; card: number; other: number };
export interface CashierDrawer {
  id: string; organizationId: string; locationId: string; cashierId: string; cashierName: string; organizationName: string; locationName: string; drawerCode: string;
  status: "active" | "closed"; revision: number; currency: string; timezone: string; startedAt: string; endedAt?: string; openingFloatPaise: number; drawerTotals: DrawerTotals;
  actualCashCounted?: number; cashVariance?: number; varianceReason?: string; handoverNotes?: string; closedByName?: string; evidenceHash?: string;
}
export type DrawerKind = "open" | "close" | "movement";
export interface DrawerReference { key: string; kind: DrawerKind; drawerId?: string }
export interface DrawerOutcome { kind: DrawerKind; resultId: string; locationId: string; requestKey: string; drawer: CashierDrawer }
const id = (value: unknown) => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
function parseDrawer(value: unknown, locationId: string): CashierDrawer {
  const row = value as CashierDrawer;
  const totals = row?.drawerTotals;
  if (!row || !id(row.id) || !id(row.cashierId) || row.locationId !== locationId || !id(row.organizationId) || !row.cashierName || !row.drawerCode || !["active", "closed"].includes(row.status) || !Number.isSafeInteger(row.revision) || row.revision < 0 || !Number.isSafeInteger(row.openingFloatPaise) || row.openingFloatPaise < 0 || !row.currency || !row.timezone || !Number.isFinite(Date.parse(row.startedAt)) || !totals || [totals.expectedCashPaise, totals.receiptCount, totals.eventCount, totals.invoiceCount, ...Object.values(totals.incoming || {}), ...Object.values(totals.outgoing || {}), ...Object.values(totals.eventIncoming || {})].some(amount => !Number.isSafeInteger(amount) || amount < 0)) throw new Error("Drawer evidence is incomplete or belongs to another branch");
  for (const values of [totals.incoming, totals.outgoing, totals.eventIncoming]) if (!values || ["cash", "upi", "card", "other"].some(key => !Number.isSafeInteger(values[key as keyof Buckets]))) throw new Error("Drawer method totals need review");
  if (!["INR", "USD", "CAD", "GBP", "AED", "EUR"].includes(row.currency) || BigInt(row.openingFloatPaise) + BigInt(totals.incoming.cash) + BigInt(totals.eventIncoming.cash) - BigInt(totals.outgoing.cash) !== BigInt(totals.expectedCashPaise)) throw new Error("Drawer currency or cash equation needs review");
  try { new Intl.DateTimeFormat("en-IN", { timeZone: row.timezone }).format(new Date(row.startedAt)); } catch { throw new Error("Drawer timezone needs review"); }
  if (row.status === "closed" && (!row.endedAt || !Number.isFinite(Date.parse(row.endedAt)) || Date.parse(row.endedAt) < Date.parse(row.startedAt) || !row.closedByName || !/^[a-f\d]{64}$/.test(row.evidenceHash || "") || !Number.isFinite(row.actualCashCounted) || !Number.isFinite(row.cashVariance))) throw new Error("Saved drawer close needs review");
  if (row.status === "closed" && (row.actualCashCounted! < 0 || Math.round(row.actualCashCounted! * 100) - totals.expectedCashPaise !== Math.round(row.cashVariance! * 100))) throw new Error("Saved drawer variance needs review");
  return row;
}
export async function activeDrawer(locationId: string, signal?: AbortSignal, channel: DrawerChannel = "pharmacy") {
  const data = (await api.get<{ data: { active: unknown } }>(root(channel), { params: { locationId }, signal })).data.data;
  if (!data || !("active" in data)) throw new Error("Drawer access could not be checked");
  return data.active === null ? null : parseDrawer(data.active, locationId);
}
export async function drawerHistory(locationId: string, cursor?: string, signal?: AbortSignal, channel: DrawerChannel = "pharmacy") {
  const data = (await api.get<{ data: { items: unknown[]; nextCursor: string | null } }>(`${root(channel)}/history`, { params: { locationId, cursor }, signal })).data.data;
  if (!data || !Array.isArray(data.items) || data.items.length > 25 || data.nextCursor !== null && !id(data.nextCursor)) throw new Error("Drawer history needs review");
  return { items: data.items.map(value => parseDrawer(value, locationId)), nextCursor: data.nextCursor };
}
export async function readDrawer(locationId: string, drawerId: string, channel: DrawerChannel = "pharmacy") { return parseDrawer((await api.get<{ data: unknown }>(`${root(channel)}/${drawerId}`, { params: { locationId } })).data.data, locationId); }
function parseOutcome(value: unknown, locationId: string, ref: DrawerReference) {
  const data = value as DrawerOutcome;
  if (!data || data.requestKey !== ref.key || data.kind !== ref.kind || data.locationId !== locationId || !id(data.resultId)) throw new Error("Drawer operation result does not match its reference");
  const drawer = parseDrawer(data.drawer, locationId);
  if (ref.drawerId && drawer.id !== ref.drawerId || ref.kind !== "movement" && drawer.id !== data.resultId || ref.kind === "close" && drawer.status !== "closed" || ref.kind !== "close" && drawer.status !== "active") throw new Error("Drawer command source or state needs review");
  return { ...data, drawer };
}
export async function submitDrawer(locationId: string, ref: DrawerReference, input: object, channel: DrawerChannel = "pharmacy") {
  const path = ref.kind === "open" ? "open" : `${ref.drawerId}/${ref.kind === "close" ? "close" : "movements"}`;
  return parseOutcome((await api.post<{ data: unknown }>(`${root(channel)}/${path}`, { ...input, locationId }, { headers: { "Idempotency-Key": ref.key } })).data.data, locationId, ref);
}
export async function recoverDrawer(locationId: string, ref: DrawerReference, channel: DrawerChannel = "pharmacy") { return parseOutcome((await api.get<{ data: unknown }>(`${operations(channel)}/${ref.key}`, { params: { locationId } })).data.data, locationId, ref); }
