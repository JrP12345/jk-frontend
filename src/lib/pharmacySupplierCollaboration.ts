import api, { getApiUrl } from "./api";
import type { OrderActionInput } from "./pharmacyPurchaseOrders";
export type SupplierDocument = { id: string; name: string; kind: string; contentType: string; size: number; source: "staff" | "supplier_link"; supplierVisible: boolean; createdAt: string };
export type SupplierCollaboration = { orderId: string; revision: number; access: { expiresAt: string; revokedAt?: string; active: boolean } | null; documents: SupplierDocument[]; email: { status: string; queuedAt: string } | null; emailAvailable: boolean; storageAvailable: boolean; publicLinkOrigin: string | null; supplierEmail: string };
export type CollaborationCommand = { key: string; kind: "supplier-link" | "supplier-email" | "documents"; input: Record<string, unknown> & { locationId: string } };
export type PublicSupplierOrder = { reference: string; revision: number; state: string; status: string; canRespond: boolean; canDispatch: boolean; canUpload: boolean; uploadsAvailable: boolean; quantities: Array<{ lineId: string; invoiced: number; received: number }>; buyer: { name: string; branch: string; address?: string }; supplierName: string; notes: string; expiresAt: string;
  lines: Array<{ lineId: string; name: string; strength?: string; manufacturer?: string; quantity: number; unit: string; packUnit: string; unitsPerPack: number }>;
  response?: { reference: string; recordedAt: string; lines: Array<{ lineId: string; acceptedQuantity: number; quotedUnitPricePaise?: number; note: string }> }; dispatch?: { reference: string; expectedDelivery?: string; recordedAt: string }; documents: SupplierDocument[] };
function documents(value: unknown): value is SupplierDocument[] { return Array.isArray(value) && value.length <= 25 && value.every(doc => typeof doc.id === "string" && typeof doc.name === "string" && Number.isSafeInteger(doc.size) && doc.size > 0 && typeof doc.supplierVisible === "boolean"); }
function collaboration(value: unknown, id: string) { const row = value as SupplierCollaboration; if (!row || row.orderId !== id || !Number.isSafeInteger(row.revision) || !documents(row.documents) || typeof row.emailAvailable !== "boolean" || typeof row.storageAvailable !== "boolean") throw new Error("Supplier collaboration response is incomplete"); return row; }
export async function readCollaboration(id: string, locationId: string, signal?: AbortSignal) { return collaboration((await api.get(`/pharmacy/purchase-orders/${id}/collaboration?${new URLSearchParams({ locationId })}`, { signal })).data?.data, id); }
export async function sendCollaboration(id: string, command: CollaborationCommand) {
  const { data } = await api.post(`/pharmacy/purchase-orders/${id}/${command.kind}`, command.input, { headers: { "Idempotency-Key": command.key }, timeout: command.kind === "documents" ? 60000 : 10000 });
  if (command.kind !== "supplier-link") return { revision: collaboration(data?.data, id).revision, token: undefined as string | undefined };
  const result = data?.data; if (!result || !Number.isSafeInteger(result.revision) || (command.input.action === "issue" ? !/^[a-f0-9]{64}$/.test(result.token) || !Number.isFinite(Date.parse(result.expiresAt)) : result.revoked !== true)) throw new Error("Supplier link result could not be confirmed. Retry the original request.");
  return result as { revision: number; token?: string; expiresAt?: string; publicLinkOrigin?: string | null; revoked?: boolean };
}
export async function downloadSupplierDocument(orderId: string, locationId: string, documentId: string) { const { data } = await api.get(`/pharmacy/purchase-orders/${orderId}/document-download?${new URLSearchParams({ locationId, documentId })}`); return downloadResult(data?.data); }
function downloadResult(value: unknown) { const row = value as { url: string; name: string }; if (!row || typeof row.name !== "string" || typeof row.url !== "string" || !row.url.startsWith("https://")) throw new Error("Private document download is unavailable"); return row; }
/** The private object response forces attachment disposition; avoid popup blockers after the API read. */
export function startSupplierDownload(value: { url: string; name: string }) { const result = downloadResult(value), anchor = document.createElement("a"); anchor.href = result.url; anchor.download = result.name; anchor.referrerPolicy = "no-referrer"; document.body.append(anchor); anchor.click(); anchor.remove(); }
export function supplierResponseLink(token: string, publicOrigin?: string | null) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Supplier link could not be confirmed");
  const url = new URL(publicOrigin || window.location.origin);
  if (publicOrigin && (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash)) throw new Error("Supplier public link address could not be confirmed");
  return `${url.origin}/supplier-order#${token}`;
}
export async function supplierArchive(id: string, locationId: string, section: "events" | "documents", cursor?: string, signal?: AbortSignal) {
  const { data } = await api.get(`/pharmacy/suppliers/${id}/archive?${new URLSearchParams({ locationId, section, ...(cursor ? { cursor } : {}) })}`, { signal });
  const page = data?.data; if (!page || !Array.isArray(page.items) || page.items.length > 25 || page.nextCursor !== null && typeof page.nextCursor !== "string") throw new Error("Supplier archive is incomplete"); return page as { items: Array<{ id?: string; kind?: string; amountPaise?: number; referenceNumber?: string; paymentMethod?: string; recordedAt?: string; orderId?: string; reference?: string; documents?: SupplierDocument[] }>; nextCursor: string | null };
}
export async function fileDocument(file: File) {
  if (!file.size || file.size > 4 * 1024 * 1024 || !["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Choose a PDF, PNG, JPEG or WebP file up to 4 MB");
  const base64Data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = () => reject(new Error("File could not be read")); reader.readAsDataURL(file); });
  return { name: file.name, contentType: file.type, base64Data };
}
export async function publicSupplierRequest(path: "read" | "respond" | "documents" | "document-download", token: string, body: Record<string, unknown> = {}, requestKey?: string, signal?: AbortSignal) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("This supplier link is incomplete or invalid");
  const response = await fetch(`${getApiUrl().replace(/\/$/, "")}/public/pharmacy-supplier-order/${path}`, { method: "POST", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", signal,
    headers: { "Content-Type": "application/json", ...(requestKey ? { "Idempotency-Key": requestKey } : {}) }, body: JSON.stringify({ token, ...body }) });
  const payload = await response.json(); if (!response.ok || !payload?.success) throw Object.assign(new Error(payload?.message || "Supplier request could not be confirmed. Refresh before retrying."), { status: response.status });
  if (path === "document-download") return downloadResult(payload.data);
  const order = payload.data as PublicSupplierOrder;
  if (!order || !order.reference || !Number.isSafeInteger(order.revision) || !Array.isArray(order.lines) || !order.lines.length || order.lines.length > 100 || !documents(order.documents) || !order.buyer?.name || ![order.canRespond, order.canDispatch, order.canUpload, order.uploadsAvailable].every(value => typeof value === "boolean") || !Array.isArray(order.quantities)) throw new Error("Supplier order response is incomplete"); return order;
}
export type PublicSupplierAction = Pick<OrderActionInput, "action" | "expectedRevision" | "reference" | "confirmed" | "lines" | "expectedDelivery">;
