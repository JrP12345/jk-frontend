"use client";
import { useRef } from "react";
import { Button } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import PrintDialogActions from "@/components/ui/PrintDialogActions";
import { printElement } from "@/lib/printBrand";
import type { PurchaseOrder } from "@/lib/pharmacyPurchaseOrders";
import { money } from "./pharmacyWorkspace";
import paper from "./PharmacyPrint.module.css";

export function purchaseOrderCsv(order: PurchaseOrder) {
  const cell = (value: string | number | undefined) => { const raw = String(value ?? ""), safe = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw; return `"${safe.replaceAll('"', '""')}"`; };
  const rows = [["Purchase order", order.reference], ["Buyer", order.buyerSnapshot.name, order.buyerSnapshot.branch], ["Supplier", order.supplierSnapshot.name],
    ["Product", "Generic", "Strength", "Manufacturer", "Packs", "Pack unit", "Loose units", "Base unit", "Base units per pack", "Total requested base units"],
    ...order.lines.map(line => [line.medicineSnapshot.name, line.medicineSnapshot.genericName, line.medicineSnapshot.strength, line.medicineSnapshot.manufacturer, line.packs, line.unitSnapshot.packUnit, line.looseUnits, line.unitSnapshot.baseUnit, line.unitSnapshot.unitsPerPack, line.quantity])];
  return "\uFEFF" + rows.map(row => row.map(cell).join(",")).join("\r\n");
}
export function PharmacyPurchaseOrderDocument({ order, onClose }: { order: PurchaseOrder; onClose: () => void }) {
  const preview = useRef<HTMLDivElement>(null);
  function download() {
    const url = URL.createObjectURL(new Blob([purchaseOrderCsv(order)], { type: "text/csv;charset=utf-8" })), link = document.createElement("a");
    link.href = url; link.download = `purchase-order-${order.id}.csv`; document.body.append(link);
    try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
  }
  return <Modal open title="Purchase order document" size="lg" onClose={onClose} footer={<PrintDialogActions documentName={`Purchase order ${order.reference}`} onClose={onClose}
    onPrint={() => printElement(preview.current, { title: `Purchase order ${order.reference}`, paper: "A4" })} extraActions={<Button size="sm" variant="outline" onClick={download}>Download order CSV</Button>} />}>
    <div ref={preview} className={paper.document}>
      <header className={paper.documentHeader}><div className={paper.issuer}><p className={paper.eyebrow}>PURCHASE ORDER</p><h1>{order.buyerSnapshot.name}</h1><p>{order.buyerSnapshot.branch}</p><p>{order.buyerSnapshot.address}</p></div>
        <div className={paper.documentMeta}><h2>{order.state === "draft" ? "DRAFT — NOT SENT" : "Purchase request"}</h2><strong>{order.reference}</strong><p>{new Date(order.createdAt).toLocaleDateString("en-IN")}</p><p>Revision {order.revision}</p></div></header>
      <section className={paper.recipientGrid}><div><h3>Supplier</h3><strong>{order.supplierSnapshot.name}</strong><p>{order.supplierSnapshot.address}</p><p>{order.supplierSnapshot.phone} {order.supplierSnapshot.email}</p><p>GST: {order.supplierSnapshot.gstin || "Unregistered"}</p><p>Licence: {order.supplierSnapshot.licence?.number}</p></div><div><h3>Requested supply</h3><p>Confirm availability, actual rates, schemes and dispatch with the pharmacy.</p></div></section>
      <p className={paper.documentNotice}>This purchase order is not a tax invoice, payment confirmation or stock receipt. Supplier confirmation is required. No substitute is authorized by this document.</p>
      <table className={paper.items}><thead><tr><th>#</th><th>Product / composition</th><th>Requested packs</th><th>Loose units</th><th>Total base units</th></tr></thead><tbody>{order.lines.map((line, index) => <tr key={line.lineId}><td>{index + 1}</td><td><strong>{line.medicineSnapshot.name}</strong><br />{[line.medicineSnapshot.genericName, line.medicineSnapshot.strength, line.medicineSnapshot.manufacturer].filter(Boolean).join(" · ")}<br />1 {line.unitSnapshot.packUnit} = {line.unitSnapshot.unitsPerPack} {line.unitSnapshot.baseUnit}</td><td>{line.packs} {line.unitSnapshot.packUnit}</td><td>{line.looseUnits} {line.unitSnapshot.baseUnit}</td><td>{line.quantity} {line.unitSnapshot.baseUnit}</td></tr>)}</tbody></table>
      {order.notes && <section className="mt-4"><h3>Order notes</h3><p>{order.notes}</p></section>}
      {order.response && <section className="mt-4"><h3>Recorded supplier response</h3><p>{order.response.reference}</p>{order.response.lines.map(line => <p key={line.lineId}>{order.lines.find(source => source.lineId === line.lineId)?.medicineSnapshot.name}: {line.acceptedQuantity} accepted base units{line.quotedUnitPricePaise !== undefined ? ` · quoted ${money(line.quotedUnitPricePaise / 100)} per base unit` : ""}{line.note ? ` · ${line.note}` : ""}</p>)}</section>}
    </div>
  </Modal>;
}
