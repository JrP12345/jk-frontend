import type { OpeningBalanceInvoice } from "@/lib/pharmacyOpeningBalance";
import { money } from "./pharmacyWorkspace";
import styles from "./PharmacyPrint.module.css";

export function PharmacyOpeningStatementDocument({ invoice }: { invoice: OpeningBalanceInvoice }) {
  const source = invoice.openingBalanceSnapshot;
  const recordedAt = `${new Date(invoice.issuedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} (IST)`;

  return (
    <article className={styles.document} aria-label="Saved pharmacy opening balance statement">
      <header className={styles.documentHeader}>
        <div className={styles.issuer}>
          <p className={styles.eyebrow}>OPENING BALANCE</p>
          <h1>{source.issuer.legalName}</h1>
          <p>{source.issuer.address}</p>
          <p className={styles.registration}>Drug licences: {source.issuer.drugLicenceNumbers.join(", ")}</p>
        </div>
        <div className={styles.documentMeta}>
          <h2>Opening balance statement</h2>
          <strong>{invoice.invoiceNumber}</strong>
          <dl>
            <div>
              <dt>Statement</dt>
              <dd>{invoice.invoiceNumber}</dd>
            </div>
            <div>
              <dt>Recorded</dt>
              <dd>{recordedAt}</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className={styles.recipientGrid} aria-label="Customer and opening source details">
        <div>
          <h3>Party</h3>
          <strong>Customer: {invoice.customerSnapshot!.name}</strong>
          <p>
            Dated source: {source.sourceDate} · Reference {source.sourceReference}
          </p>
          <p>Review reference: {source.reviewReference}</p>
        </div>
        <dl>
          <div>
            <dt>Source date</dt>
            <dd>{source.sourceDate}</dd>
          </div>
          <div>
            <dt>Statement status</dt>
            <dd className={styles.paymentStatus}>{invoice.status.replaceAll("_", " ")}</dd>
          </div>
        </dl>
      </section>

      <div className={styles.closing}>
        <section className={styles.summaryGrid} aria-label="Opening balance summary">
          <div className={styles.documentNotes}>
            <h3>Statement notes</h3>
            <p>
              Reviewed opening debt. This statement records no current supply, tax or stock movement. Confirmed receipts are separate
              documents.
            </p>
          </div>
          <dl className={styles.documentTotals}>
            <div className={styles.grandTotal}>
              <dt>Opening due</dt>
              <dd>{money(source.amountPaise / 100)}</dd>
            </div>
            <div>
              <dt>Received</dt>
              <dd>{money(invoice.amountPaid)}</dd>
            </div>
            <div>
              <dt>Remaining due</dt>
              <dd>{money(invoice.balanceDue)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </article>
  );
}
