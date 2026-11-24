"use client";
import { useState } from "react";
import { Alert, Button, Input, Modal, Select } from "@/components/ui";
import { prepareCounterCollection, type PaymentPart } from "@/lib/pharmacyPayment";
import { money } from "./pharmacyWorkspace";

export interface CounterPaymentAllocation { parts: PaymentPart[]; tender: string; totalPaise: number; customerId: string | null }
export function PharmacyCounterPaymentEditor({ locationId, totalPaise, customerId, initial, onClose, onApply }: {
  locationId: string; totalPaise: number; customerId: string | null; initial: CounterPaymentAllocation | null; onClose: () => void; onApply: (value: CounterPaymentAllocation) => void;
}) {
  const [parts, setParts] = useState<PaymentPart[]>(() => initial?.parts || [{ componentId: crypto.randomUUID(), amount: (totalPaise / 100).toFixed(2), paymentMethod: "cash", referenceNumber: "" }]);
  const [tender, setTender] = useState(initial?.tender || (totalPaise / 100).toFixed(2));
  const payment = prepareCounterCollection({ locationId, paymentRevision: 0, balanceDue: totalPaise / 100, customerSnapshot: { anonymous: !customerId } }, parts, tender, !customerId);
  const edit = (index: number, field: keyof PaymentPart, value: string) => setParts(previous => previous.map((part, n) => n === index ? { ...part, [field]: value } : part));
  return <Modal open title="Split / part payment" onClose={onClose} size="md"><form className="space-y-4" onSubmit={event => { event.preventDefault(); if (payment.input) onApply({ parts, tender, totalPaise, customerId }); }}>
    <p>Bill total <strong>{money(totalPaise / 100)}</strong>. Verify each receipt before saving the bill.</p>
    {!customerId && <p className="text-sm text-text-secondary">Select a recorded customer first if any amount will remain due.</p>}
    {parts.map((part, index) => <fieldset className="space-y-2 rounded-lg border border-border p-3" key={part.componentId}><legend>Payment {index + 1}</legend>
      <div className="grid grid-cols-2 gap-2"><Select label={`Payment ${index + 1} method`} value={part.paymentMethod} onChange={e => edit(index, "paymentMethod", e.target.value)} options={[{ value: "cash", label: "Cash" }, { value: "upi", label: "UPI" }, { value: "card", label: "Card" }]} /><Input label={`Payment ${index + 1} amount (INR)`} type="number" min="0.01" step="0.01" value={part.amount} onChange={e => edit(index, "amount", e.target.value)} /></div>
      {part.paymentMethod !== "cash" && <Input label={`Payment ${index + 1} verified reference`} minLength={3} maxLength={200} required value={part.referenceNumber} onChange={e => edit(index, "referenceNumber", e.target.value)} />}
      <Button type="button" variant="ghost" size="sm" disabled={parts.length === 1} onClick={() => setParts(previous => previous.filter((_, n) => n !== index))}>Remove payment {index + 1}</Button>
    </fieldset>)}
    <Button type="button" variant="outline" size="sm" disabled={parts.length >= 10} onClick={() => setParts(previous => [...previous, { componentId: crypto.randomUUID(), amount: payment.remaining && payment.remaining > 0 ? (payment.remaining / 100).toFixed(2) : "", paymentMethod: "upi", referenceNumber: "" }])}>Add payment method</Button>
    {payment.cash > 0 && <Input label="Split cash received (INR)" type="number" min="0" step="0.01" value={tender} onChange={e => setTender(e.target.value)} hint="Enter the cash handed over; extra cash is returned as change." />}
    <dl className="space-y-2"><div className="flex justify-between"><dt>Payment</dt><dd>{money(payment.total / 100)}</dd></div><div className="flex justify-between"><dt>Remaining customer credit</dt><dd>{money(Math.max(0, payment.remaining || 0) / 100)}</dd></div><div className="flex justify-between"><dt>Cash change</dt><dd>{payment.change === null ? "—" : money(payment.change / 100)}</dd></div></dl>
    {payment.problem && <Alert variant="warning" title="Check payment allocation">{payment.problem}</Alert>}
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!payment.input}>Use these payments</Button></div>
  </form></Modal>;
}
