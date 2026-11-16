"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import { Alert, Button, Card } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { pickupStatusLabels, readPickupTicket, type PickupTicket } from "@/lib/publicPharmacy";

const subscribeHash = (listener: () => void) => { window.addEventListener("hashchange", listener); return () => window.removeEventListener("hashchange", listener); };
const readHash = () => window.location.hash.slice(1);
const serverHash = () => "";
export default function PickupTicketPage() {
  const token = useSyncExternalStore(subscribeHash, readHash, serverHash);
  return <PickupTicketSession key={token} token={token} />;
}
function PickupTicketSession({ token }: { token: string }) {
  const [ticket, setTicket] = useState<PickupTicket | null>(null), [qr, setQr] = useState("");
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [copied, setCopied] = useState(false);
  const begin = useLatestRead();
  const load = useCallback(async () => {
    const request = begin(); setLoading(true); setError("");
    try { const saved = await readPickupTicket(token, request.signal); if (request.isCurrent()) setTicket(saved); }
    catch (failure) { if (request.isCurrent()) setError((failure as { response?: { data?: { message?: string } } })?.response?.data?.message || (failure instanceof Error ? failure.message : "Ticket status could not be refreshed")); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [begin, token]);
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) void load(); }); return () => { active = false; }; }, [load]);
  const poll = ticket?.status === "requested" || ticket?.status === "ready";
  useEffect(() => {
    if (!poll) return;
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15000);
    return () => clearInterval(timer);
  }, [load, poll]);
  useEffect(() => {
    if (!/^[a-f0-9]{64}$/.test(token)) return;
    let alive = true;
    void QRCode.toDataURL(`${window.location.origin}/pickup#${token}`, { width: 264, margin: 3, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } }).then(value => { if (alive) setQr(value); }).catch(() => { if (alive) setQr(""); });
    return () => { alive = false; };
  }, [token]);
  return <><MarketplaceNavbar showSearch={false} /><main className="mx-auto w-full max-w-xl space-y-5 px-4 py-8">
    <h1 className="text-2xl font-semibold">Pharmacy pickup ticket</h1>
    {error && <Alert variant="error" title={ticket ? "Status could not be refreshed" : "Ticket unavailable"}>{error}<Button variant="outline" size="sm" onClick={() => { void load(); }} loading={loading}>Check ticket again</Button></Alert>}
    {!ticket && loading && <Card><p role="status">Loading pickup ticket...</p></Card>}
    {ticket && <Card contentClassName="gap-4">
      <header><p className="text-sm text-text-secondary">{ticket.location?.name || "Pharmacy"}{ticket.location?.city ? ` · ${ticket.location.city}` : ""}</p><h2 className="mt-1 text-xl font-semibold" role="status">{pickupStatusLabels[ticket.status]}</h2></header>
      <p className="text-sm text-text-secondary">{ticket.status === "requested" ? "Wait for the pharmacy to prepare your parcel before travelling. This request does not reserve medicines." : ticket.status === "ready" ? "Show this QR at the pharmacy. Staff will check the parcel and payment before handing it over." : ticket.status === "collected" ? "This parcel has already been handed over. The ticket cannot be used again." : "This ticket cannot be used for collection. Contact the pharmacy if you still need these medicines."}</p>
      {qr && ["requested", "ready"].includes(ticket.status) && <Image unoptimized src={qr} alt={`Pickup QR for ${ticket.reference}`} width={264} height={264} className="mx-auto rounded-xl bg-white" />}
      <p className="text-center font-mono text-lg font-semibold">{ticket.reference}</p>
      <ul className="divide-y divide-border">{ticket.items.map(item => <li key={item.medicineId} className="flex justify-between gap-4 py-3 text-sm"><span>{item.name} {item.strength}</span><strong className="shrink-0">{item.quantity} {item.baseUnit}</strong></li>)}</ul>
      {ticket.invoiceNumber && <p className="text-sm">Bill: {ticket.invoiceNumber}</p>}
      <p className="text-xs text-text-secondary">Valid until {new Date(ticket.expiresAt).toLocaleString()}. Keep this link private; anyone with it can view the ticket.</p>
      <div className="flex flex-wrap gap-2"><Button variant="outline" loading={loading} onClick={() => { void load(); }}>Refresh status</Button><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/pickup#${token}`); setCopied(true); } catch { setError("Copy the address from your browser to keep this ticket"); } }}>{copied ? "Ticket link copied" : "Copy ticket link"}</Button></div>
    </Card>}
    <Link href="/browse" className="inline-flex min-h-11 items-center text-accent underline">Browse locations</Link>
  </main></>;
}
