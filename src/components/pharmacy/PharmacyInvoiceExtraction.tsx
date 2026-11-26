"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { Alert, Badge, Button, Card, Checkbox, Input, Spinner } from "@/components/ui";
import api from "@/lib/api";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { useMobileViewport } from "@/hooks/useMobileViewport";

type ExtractedRow = {
  line: number;
  description: string;
  productCode: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  amount: string;
  taxRate: string;
  confidencePercent: number | null;
};

type Extraction = {
  id: string;
  locationId: string;
  supplierId: string;
  requestKey: string;
  status: string;
  failureReason?: string;
  extracted: {
    supplier: string;
    invoiceNumber: string;
    invoiceDate: string;
    invoiceTotal: string;
    rows: ExtractedRow[];
  } | null;
};

const errorMessage = (failure: unknown) =>
  (failure as { response?: { data?: { message?: string } } })?.response?.data?.message ||
  (failure instanceof Error ? failure.message : "Invoice extraction is unavailable");

const cell = (value: string) => `"${value.replaceAll('"', '""')}"`;

export function PharmacyInvoiceExtraction({
  locationId,
  supplierId,
  onCsv,
}: {
  locationId: string;
  supplierId: string;
  onCsv: (csv: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const scope = authScopeKey(useAuthStore(state => state.user));
  return (
    <Card padding="none" className="rounded-xl shadow-none" contentClassName="gap-0">
      <details className="group" onToggle={event => setOpen(event.currentTarget.open)}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 bg-surface-alt/40 px-3 py-2 text-xs font-semibold text-text select-none hover:bg-surface-hover [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <FileText size={14} className="shrink-0 text-accent" aria-hidden="true" />
            <span>Extract a supplier invoice PDF or photo</span>
          </span>
          <ChevronDown
            size={14}
            className="shrink-0 text-text-secondary transition-transform duration-150 group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        {open && (
          <div className="border-t border-border/60 p-3">
            <ExtractionSession key={`${scope}:${locationId}:${supplierId}`} locationId={locationId} supplierId={supplierId} onCsv={onCsv} />
          </div>
        )}
      </details>
    </Card>
  );
}

function ExtractionSession({
  locationId,
  supplierId,
  onCsv,
}: {
  locationId: string;
  supplierId: string;
  onCsv: (csv: string) => void;
}) {
  const mobile = useMobileViewport();
  const scope = authScopeKey(useAuthStore(state => state.user));
  const storageKey = `pharmacy-ocr:${scope}:${locationId}:${supplierId}`;
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const [result, setResult] = useState<Extraction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const alive = useRef(true);
  const frozen = useRef<{ key: string; input: object } | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [missing, setMissing] = useState(false);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;

  useEffect(() => {
    alive.current = true;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved && !/^[a-zA-Z0-9_-]{8,100}$/.test(saved)) throw Error("Saved extraction reference requires review");
      setKey(saved);
    } catch (failure) {
      setError(errorMessage(failure));
    }
    return () => {
      alive.current = false;
    };
  }, [storageKey]);

  function validate(value: Extraction, expected: string) {
    if (
      !value ||
      value.locationId !== locationId ||
      value.supplierId !== supplierId ||
      value.requestKey !== expected ||
      !["submitting", "processing", "succeeded", "failed", "unknown"].includes(value.status) ||
      (value.status === "succeeded" &&
        (!value.extracted || !Array.isArray(value.extracted.rows) || !value.extracted.rows.length || value.extracted.rows.length > 100))
    ) {
      throw Error("Extraction does not match the original request");
    }
    return value;
  }

  async function check(reference = key) {
    if (!reference || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await api.get(`/pharmacy/invoice-extractions/${reference}`, { params: { locationId, supplierId } });
      const value = validate(response.data?.data, reference);
      if (current()) setResult(value);
    } catch (failure) {
      if (current()) {
        setError(errorMessage(failure));
        if ((failure as { response?: { status?: number } }).response?.status === 404) {
          setMissing(true);
          frozen.current = null;
          setCanRetry(false);
        }
      }
    } finally {
      lock.current = false;
      if (current()) setBusy(false);
    }
  }

  async function start() {
    if (lock.current || !consent || !file || (key && !frozen.current && !missing)) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (!frozen.current) {
        if (!file.size || file.size > 4 * 1024 * 1024 || !["application/pdf", "image/png", "image/jpeg"].includes(file.type)) {
          throw Error("Choose a PDF, PNG or JPEG up to 4 MB");
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (let at = 0; at < bytes.length; at += 8192) binary += String.fromCharCode(...bytes.subarray(at, at + 8192));
        const command = {
          key: key || crypto.randomUUID(),
          input: {
            locationId,
            supplierId,
            name: file.name,
            contentType: file.type,
            base64Data: btoa(binary),
            processingConfirmed: true,
          },
        };
        if (!current()) return;
        sessionStorage.setItem(storageKey, command.key);
        frozen.current = command;
        setKey(command.key);
        setCanRetry(true);
        setMissing(false);
      }
      const command = frozen.current;
      const response = await api.post("/pharmacy/invoice-extractions", command.input, { headers: { "Idempotency-Key": command.key } });
      if (
        response.data?.data?.requestKey !== command.key ||
        response.data?.data?.locationId !== locationId ||
        response.data?.data?.supplierId !== supplierId
      ) {
        throw Error("Extraction acceptance could not be confirmed. Check the same reference");
      }
      if (current()) setResult(null);
    } catch (failure) {
      if (current()) setError(errorMessage(failure));
    } finally {
      lock.current = false;
      if (current()) setBusy(false);
    }
  }

  function useText() {
    if (!result?.extracted || !reviewed) return;
    const csv = [
      ["source", "ocrProductCode", "ocrQuantity", "ocrUnit", "ocrUnitPrice", "ocrAmount", "ocrTaxRate"],
      ...result.extracted.rows.map(row => [
        row.description || row.productCode,
        row.productCode,
        row.quantity,
        row.unit,
        row.unitPrice,
        row.amount,
        row.taxRate,
      ]),
    ]
      .map(row => row.map(cell).join(","))
      .join("\r\n");
    onCsv(csv);
  }

  return (
    <section className="space-y-3 text-xs">
      <p className="leading-relaxed text-text-secondary">
        Uses the configured Azure OCR service. Only upload a supplier invoice you are authorized to process. OCR text needs review against
        the original; pack quantities, GST, batch, expiry and prices are never approved automatically.
      </p>

      {error && (
        <Alert variant="error" title="Invoice extraction needs attention">
          {error}
        </Alert>
      )}

      {(!key || missing) && (
        <fieldset className="space-y-3" disabled={busy}>
          {missing && <p className="text-warning-text">No saved extraction was found. Select the original file to retry with the same reference.</p>}
          <Input
            size="sm"
            label="Invoice PDF or photo"
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={event => {
              setFile(event.target.files?.[0] || null);
              setConsent(false);
            }}
          />
          <Checkbox
            label="I authorize sending this supplier invoice to the configured OCR provider"
            checked={consent}
            onChange={event => setConsent(event.target.checked)}
          />
          <div>
            <Button
              size="xs"
              disabled={!file || !consent}
              onClick={() => {
                void start();
              }}
            >
              Extract invoice text
            </Button>
          </div>
        </fieldset>
      )}

      {key && (
        <div className="space-y-2 rounded-xl border border-border/70 bg-surface-alt/40 p-3">
          <p className="break-all font-mono text-[11px] text-text-secondary">Extraction reference: {key}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="xs"
              disabled={busy}
              onClick={() => {
                void check();
              }}
            >
              Check extraction status
            </Button>
            {!result && canRetry && (
              <Button
                size="xs"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  void start();
                }}
              >
                Retry same extraction request
              </Button>
            )}
          </div>
        </div>
      )}

      {busy && (
        <div role="status" className="flex items-center gap-2 text-text-secondary">
          <Spinner size="sm" />
          Checking invoice extraction...
        </div>
      )}

      {result && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-text">
            Status: {result.status}.{result.failureReason ? ` ${result.failureReason}` : ""}
          </p>
          <Badge variant={result.status === "succeeded" ? "success" : result.status === "failed" ? "danger" : "info"} size="sm">
            {result.status}
          </Badge>
        </div>
      )}

      {result?.extracted && (
        <div className="space-y-3">
          <p className="rounded-lg border border-border/60 bg-surface-alt/40 p-2.5 text-[11px] text-text-secondary">
            Extracted supplier: {result.extracted.supplier || "Unknown"} · Invoice: {result.extracted.invoiceNumber || "Unknown"} · Date:{" "}
            {result.extracted.invoiceDate || "Unknown"} · Total: {result.extracted.invoiceTotal || "Unknown"}
          </p>

          {mobile ? (
            <div className="divide-y divide-border/60 rounded-xl border border-border/70">
              {result.extracted.rows.map(row => (
                <article key={row.line} className="space-y-1.5 p-2.5">
                  <strong className="block text-xs font-semibold text-text">{row.description || row.productCode}</strong>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    <div>
                      <dt className="text-text-secondary">Quantity</dt>
                      <dd className="text-text">
                        {row.quantity} {row.unit}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary">Unit price</dt>
                      <dd className="tabular-nums text-text">{row.unitPrice}</dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary">Amount</dt>
                      <dd className="tabular-nums text-text">{row.amount}</dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary">Tax / Conf.</dt>
                      <dd className="text-text">
                        {row.taxRate || "—"} · {row.confidencePercent === null ? "Unknown" : `${row.confidencePercent}%`}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/70">
              <table className="w-full border-collapse text-left text-xs">
                <caption className="px-3 py-2 text-left text-[11px] text-text-secondary">Unreviewed invoice text</caption>
                <thead className="border-y border-border/80 bg-surface-alt/70 font-semibold text-text-secondary">
                  <tr>
                    {["Item", "Quantity", "Unit", "Unit price", "Amount", "Tax", "Confidence"].map(label => (
                      <th key={label} className="px-2.5 py-2">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {result.extracted.rows.map(row => (
                    <tr key={row.line}>
                      <td className="px-2.5 py-2">{row.description || row.productCode}</td>
                      <td className="px-2.5 py-2">{row.quantity}</td>
                      <td className="px-2.5 py-2">{row.unit}</td>
                      <td className="px-2.5 py-2 tabular-nums">{row.unitPrice}</td>
                      <td className="px-2.5 py-2 tabular-nums">{row.amount}</td>
                      <td className="px-2.5 py-2">{row.taxRate}</td>
                      <td className="px-2.5 py-2">{row.confidencePercent === null ? "Unknown" : `${row.confidencePercent}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Checkbox
            label="I checked the extracted text against the original invoice; I will map units and review prices and tax next"
            checked={reviewed}
            onChange={event => setReviewed(event.target.checked)}
          />
          <div>
            <Button size="xs" disabled={!reviewed || busy} onClick={useText}>
              Use reviewed text in CSV mapping
            </Button>
          </div>
        </div>
      )}

      {result && ["succeeded", "failed", "unknown"].includes(result.status) && (
        <div>
          <Button
            size="xs"
            variant="outline"
            disabled={busy}
            onClick={() => {
              sessionStorage.removeItem(storageKey);
              setKey(null);
              setResult(null);
              frozen.current = null;
              setCanRetry(false);
              setConsent(false);
              setReviewed(false);
            }}
          >
            Start a separate extraction
          </Button>
        </div>
      )}
    </section>
  );
}
