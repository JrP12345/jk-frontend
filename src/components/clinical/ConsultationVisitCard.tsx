import type { ReactNode } from "react";
import { Phone } from "lucide-react";
import { Badge } from "@/components/ui";
import styles from "./Consultations.module.css";

export const consultationStatusLabel = (status: string) => ({
  "checked-in": "Waiting", "in-consultation": "In visit", completed: "Completed",
  confirmed: "Scheduled", pending: "Pending", pending_payment: "Payment pending",
  cancelled: "Cancelled", "no-show": "No-show",
}[status] || status.replaceAll("-", " ").replaceAll("_", " "));

export function ConsultationVisitCard({ name, phone, token, status, context, complaint, actions }: {
  name: string; phone?: string; token?: number; status: string; context?: string; complaint?: string; actions: ReactNode;
}) {
  return <article className={styles.visit} data-in-progress={status === "in-consultation" || undefined}>
    <div className={styles.token}><span>Token</span><strong>{token !== undefined && token !== null ? `#${token}` : "—"}</strong></div>
    <div className={styles.identity}>
      <div className={styles.nameRow}><h2>{name}</h2><Badge size="sm" variant={status === "in-consultation" ? "warning" : status === "completed" ? "success" : "neutral"}>{consultationStatusLabel(status)}</Badge></div>
      <div className={styles.meta}>{phone && <a href={`tel:${phone}`}><Phone size={12} />{phone}</a>}{context && <span>{context}</span>}</div>
      {complaint && <p className={styles.complaint}><span>Reason:</span> {complaint}</p>}
    </div>
    <div className={styles.visitActions}>{actions}</div>
  </article>;
}
