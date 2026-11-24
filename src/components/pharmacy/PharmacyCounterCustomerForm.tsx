"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Checkbox, Input, Modal } from "@/components/ui";
import api from "@/lib/api";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import type { CounterCustomer } from "@/lib/pharmacyCounter";

export function PharmacyCounterCustomerForm({ locationId, onClose, onSelected }: { locationId: string; onClose: () => void; onSelected: (customer: CounterCustomer) => void }) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  const [name, setName] = useState(""), [phone, setPhone] = useState(""), [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [matches, setMatches] = useState<CounterCustomer[]>([]), [separate, setSeparate] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const alive = useRef(true), lock = useRef(false), command = useRef<{ key: string; input: object } | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (lock.current || !current()) return;
    lock.current = true; setBusy(true); setError("");
    try {
      command.current ||= { key: crypto.randomUUID(), input: { locationId, name: name.trim(), phone: phone.trim(), address: address.trim(), ...(separate ? { createSeparateConfirmed: true } : {}) } };
      const response = await api.post("/pharmacy/sales/customers", command.current.input, { headers: { "Idempotency-Key": command.current.key } });
      const customer = response.data?.data as CounterCustomer;
      if (!customer?.id || !customer.name || !customer.address || !Number.isSafeInteger(customer.revision)) throw Error("Customer result could not be confirmed. Retry the same request or search for the saved customer.");
      if (current()) onSelected(customer);
    } catch (failure) {
      if (current()) {
        const response = (failure as { response?: { status?: number; data?: { message?: string; details?: { code?: string; customers?: CounterCustomer[] } } } }).response;
        setError(response?.data?.message || (failure instanceof Error ? failure.message : "Customer save could not be confirmed. Retry the same request."));
        const known = [400, 403, 404, 409, 428].includes(response?.status || 0); setUncertain(!known);
        if (known) command.current = null;
        if (response?.data?.details?.code === "CUSTOMER_POSSIBLE_DUPLICATE") setMatches(response.data.details.customers || []);
      }
    } finally { lock.current = false; if (current()) setBusy(false); }
  }
  return <Modal open title="Add customer" onClose={onClose} busy={busy} size="md">
    <form className="space-y-4" onSubmit={event => { void save(event); }}>
      <p className="text-sm text-text-secondary">For customer history and credit. Walk-in purchases do not need a customer record.</p>
      {error && <Alert variant="warning" title="Check customer">{error}</Alert>}
      {matches.map(customer => <div className="rounded-lg border border-border p-3" key={customer.id}><strong>{customer.name}</strong><p className="text-sm">{customer.phone} · {customer.address}</p><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onSelected(customer)}>Use this customer</Button></div>)}
      <fieldset disabled={busy || uncertain} className="space-y-4">
        <Input label="Customer name" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={200} />
        <Input label="Phone number (optional)" type="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={30} />
        <Input label="Customer address" value={address} onChange={e => setAddress(e.target.value)} required minLength={3} maxLength={500} />
        {!!matches.length && <Checkbox label="These are different people; create a separate customer" checked={separate} onChange={e => setSeparate(e.target.checked)} />}
      </fieldset>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Close</Button><Button type="submit" loading={busy} disabled={!!matches.length && !separate && !uncertain}>{uncertain ? "Retry same customer" : "Save customer"}</Button></div>
    </form>
  </Modal>;
}
