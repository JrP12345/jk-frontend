"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, FileText, Upload, X } from "lucide-react";
import { Alert, Button, Card, Input, QuantityInput, Textarea } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { MAX_PICKUP_FILES, makePickupSecret, preparePickupAttachment, publicMedicines, requestPickup, type PublicMedicine, type PickupRequest, type PickupUploadAttachment } from "@/lib/publicPharmacy";
import { getLocationOperationalStatus } from "@/lib/timing/locationStatus";
import styles from "./PublicPharmacyCatalogue.module.css";

type StagedAttachment = { id: string; upload: PickupUploadAttachment; previewUrl?: string; sizeBytes: number };
const MAX_TOTAL_UPLOAD_BYTES = 8 * 1024 * 1024;
const formatFileSize = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const message = (failure: unknown) => (failure as { response?: { data?: { message?: string } } })?.response?.data?.message || (failure instanceof Error ? failure.message : "The pharmacy could not confirm this request");
export function PublicPharmacyCatalogue({ slug, locationId, published, allowPickup, timings, timezone, countryCode, sidebar }: { slug?: string; locationId: string; published: boolean; allowPickup: boolean; timings?: string; timezone?: string; countryCode?: string; sidebar?: ReactNode }) {
  const router = useRouter(), begin = useLatestRead();
  const [search, setSearch] = useState(""), [query, setQuery] = useState("");
  const [items, setItems] = useState<PublicMedicine[]>([]), [next, setNext] = useState<string | null>(null), [selected, setSelected] = useState<Array<{ product: PublicMedicine; quantity: string }>>([]);
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<StagedAttachment[]>([]), [attachmentError, setAttachmentError] = useState(""), [readingFiles, setReadingFiles] = useState(false);
  const [pickupEnabled, setPickupEnabled] = useState(allowPickup), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const [name, setName] = useState(""), [phone, setPhone] = useState(""), [saving, setSaving] = useState(false), [requestError, setRequestError] = useState(""), [uncertain, setUncertain] = useState(false), [ticket, setTicket] = useState("");
  const frozen = useRef<{ key: string; input: PickupRequest } | null>(null), lock = useRef(false), alive = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null), cameraInputRef = useRef<HTMLInputElement>(null), previewUrls = useRef<Set<string>>(new Set());
  const [now, setNow] = useState(() => new Date());
  const status = getLocationOperationalStatus(timings, now, timezone);
  const closed = status.status !== "unspecified" && !status.isOpen;
  const nextOpening = status.nextOpenTime ? `${status.nextOpenDay || ""} ${status.nextOpenTime}`.trim() : "";
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const urls = previewUrls.current;
    alive.current = true;
    return () => { alive.current = false; for (const url of urls) URL.revokeObjectURL(url); urls.clear(); };
  }, []);
  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 200); return () => clearTimeout(timer); }, [search]);
  const load = useCallback(async (cursor?: string) => {
    if (!published || !slug) return;
    const request = begin(); setLoading(true); setError("");
    try { const page = await publicMedicines(slug, locationId, query, cursor, request.signal); if (request.isCurrent()) { setItems(previous => cursor ? [...previous, ...page.items] : page.items); setNext(page.nextCursor); setPickupEnabled(page.pickupEnabled); } }
    catch (failure) { if (request.isCurrent()) setError(message(failure)); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [begin, slug, locationId, published, query]);
  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);
  const hasContent = selected.length > 0 || notes.trim().length > 0 || attachments.length > 0;
  async function handleFiles(files: FileList | null) {
    if (!files?.length || saving || uncertain) return;
    setAttachmentError("");
    const incoming = Array.from(files), remaining = MAX_PICKUP_FILES - attachments.length;
    if (remaining <= 0) { setAttachmentError(`You can attach up to ${MAX_PICKUP_FILES} files.`); return; }
    const queue = incoming.slice(0, remaining);
    if (incoming.length > remaining) setAttachmentError(`Only the first ${remaining} file${remaining === 1 ? "" : "s"} were added (max ${MAX_PICKUP_FILES}).`);
    setReadingFiles(true);
    try {
      let runningBytes = attachments.reduce((sum, item) => sum + item.sizeBytes, 0);
      const added: StagedAttachment[] = [];
      for (const file of queue) {
        const upload = await preparePickupAttachment(file);
        const estimatedBytes = Math.floor((upload.base64Data.length * 3) / 4);
        if (runningBytes + estimatedBytes > MAX_TOTAL_UPLOAD_BYTES) throw Error("Total attachments must fit within 8 MB.");
        runningBytes += estimatedBytes;
        const previewUrl = upload.contentType.startsWith("image/") && typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : undefined;
        if (previewUrl) previewUrls.current.add(previewUrl);
        added.push({ id: crypto.randomUUID(), upload, previewUrl, sizeBytes: estimatedBytes });
      }
      if (alive.current) setAttachments(previous => [...previous, ...added]);
    } catch (failure) {
      if (alive.current) setAttachmentError(failure instanceof Error ? failure.message : "Could not attach selected file.");
    } finally {
      if (alive.current) setReadingFiles(false);
    }
  }
  function removeAttachment(id: string) {
    setAttachmentError("");
    setAttachments(previous => {
      const target = previous.find(item => item.id === id);
      if (target?.previewUrl) { URL.revokeObjectURL(target.previewUrl); previewUrls.current.delete(target.previewUrl); }
      return previous.filter(item => item.id !== id);
    });
  }
  async function submit() {
    if (!slug || lock.current || !pickupEnabled || !hasContent) return;
    lock.current = true; setSaving(true); setRequestError("");
    try {
      if (!frozen.current) {
        const trimmedNotes = notes.trim();
        if (trimmedNotes.length > 2000) throw Error("Description must be 2,000 characters or fewer");
        if (!name.trim() || !/^\+?\d{7,15}$/.test(phone.replace(/[\s().-]/g, "")) || selected.some(row => !/^\d+$/.test(row.quantity) || Number(row.quantity) < 1 || Number(row.quantity) > 1000)) throw Error("Enter your name, phone and whole quantities between 1 and 1,000");
        const ticketSecret = makePickupSecret();
        frozen.current = {
          key: crypto.randomUUID(),
          input: {
            name: name.trim(),
            phone: phone.trim(),
            ticketSecret,
            items: selected.map(row => ({ medicineId: row.product.id, unitVersion: row.product.unitVersion, quantity: Number(row.quantity) })),
            ...(trimmedNotes ? { notes: trimmedNotes } : {}),
            ...(attachments.length ? { attachments: attachments.map(item => item.upload) } : {}),
          },
        };
      }
      const original = frozen.current; setTicket(original.input.ticketSecret);
      const saved = await requestPickup(slug, locationId, original.input, original.key);
      if (alive.current) router.push(`/pickup#${original.input.ticketSecret}`);
      return saved;
    } catch (failure) {
      if (alive.current) { setRequestError(message(failure)); const status = (failure as { response?: { status?: number } })?.response?.status; setUncertain(Boolean(frozen.current) && (!status || status >= 500)); if (status && status < 500) frozen.current = null; }
    } finally { lock.current = false; if (alive.current) setSaving(false); }
  }
  const quantityControls = (row: typeof selected[number]) => <div className={styles.quantity}><QuantityInput variant="compact" label={`Pickup quantity ${row.product.name}`} min={1} max={1000} value={row.quantity} disabled={saving || uncertain} onValueChange={quantity => setSelected(previous => previous.map(item => item.product.id === row.product.id ? { ...item, quantity } : item))} /><Button size="sm" variant="ghost" disabled={saving || uncertain} aria-label={`Remove ${row.product.name} from pickup`} onClick={() => setSelected(previous => previous.filter(item => item.product.id !== row.product.id))}>Remove</Button></div>;
  if (!published || !slug) return <div className={styles.host}><div className={styles.layout}><Card><p className={styles.description}>Contact this pharmacy to ask about medicine availability.</p></Card>{sidebar && <div className={styles.sidebar}>{sidebar}</div>}</div></div>;
  const summaryParts = [
    selected.length > 0 ? `${selected.length} ${selected.length === 1 ? "medicine" : "medicines"}` : "",
    notes.trim() ? "written description" : "",
    attachments.length > 0 ? `${attachments.length} ${attachments.length === 1 ? "file" : "files"}` : "",
  ].filter(Boolean);
  return <div className={styles.host}><div className={styles.layout}>
    <section aria-labelledby="pharmacy-choose-title" className={styles.main}>
      <Card padding="none" className={styles.card} contentClassName={styles.cardBody}>
        <h2 id="pharmacy-choose-title" className={styles.title}>{pickupEnabled ? "1. Choose medicines" : "Medicines"}</h2>
        <p className={styles.description}>{pickupEnabled ? "Pick listed medicines, write what you need, or upload a prescription/list photo. You pay at the counter after confirmation." : "Browse the pharmacy’s medicine list. Contact the pharmacy to confirm availability."}</p>
        <p className={styles.note}>Prescription and restricted medicines need the pharmacist’s review before billing or handover.</p>
        <Input type="search" label="Search medicines" placeholder="Search medicine or generic name" className={styles.input} value={search} maxLength={100} onChange={event => setSearch(event.target.value)} />
        {error && <Alert variant="error" title="Medicine list unavailable">{error}<Button size="sm" variant="outline" onClick={() => { void load(); }}>Retry medicine list</Button></Alert>}
        <div aria-busy={loading} className={styles.products}>
          {!items.length && !error && <p role="status" className={styles.empty}>{loading ? "Loading medicines…" : query ? "No medicines match this search." : "No medicines are listed right now. Write what you need or upload an image below."}</p>}
          {items.map(item => { const picked = selected.find(row => row.product.id === item.id); return <article key={item.id} className={styles.product}><div className={styles.identity}><h3>{item.name} {item.strength}</h3><p>{[item.genericName, `per ${item.baseUnit}`, item.availabilityKnown === false ? "Contact pharmacy for availability" : item.available ? "Available" : "Currently unavailable"].filter(Boolean).join(" · ")}</p></div>{pickupEnabled && (picked ? quantityControls(picked) : <Button size="sm" variant="outline" className={styles.add} aria-label={`Add ${item.name}`} disabled={!item.available || saving || uncertain || selected.length >= 25} onClick={() => setSelected(previous => [...previous, { product: item, quantity: "1" }])}>+ Add</Button>)}</article>; })}
        </div>
        {next && <Button variant="outline" loading={loading} onClick={() => { void load(next); }}>More medicines</Button>}
        {selected.some(row => !items.some(item => item.id === row.product.id)) && <section aria-label="Selected medicines from other searches" className={styles.products}><h3 className={styles.selectionTitle}>Also in your request</h3>{selected.filter(row => !items.some(item => item.id === row.product.id)).map(row => <article key={row.product.id} className={styles.product}><div className={styles.identity}><h3>{row.product.name} {row.product.strength}</h3><p>Quantity in {row.product.baseUnit}</p></div>{quantityControls(row)}</article>)}</section>}
        {pickupEnabled && <section aria-label="Write request or attach photo" className={styles.customRequest}>
          <header>
            <h3 className={styles.customTitle}>Write medicines or upload an image (optional)</h3>
            <p className={styles.customHint}>Can&apos;t find an item above? Describe what you need or upload a photo/PDF of your prescription or list.</p>
          </header>
          <Textarea
            label="Description or medicine list"
            placeholder="e.g., Dolo 650mg 1 strip, Digene gel 1 bottle, or notes for the pharmacist"
            value={notes}
            maxLength={2000}
            rows={3}
            disabled={saving || uncertain}
            onChange={event => setNotes(event.target.value)}
          />
          {notes.length > 0 && <p className={styles.noteMeta}>{notes.length}/2000</p>}
          <div className={styles.uploadActions}>
            <Input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" multiple containerClassName="sr-only" aria-label="Upload prescription or list files" onChange={event => { void handleFiles(event.target.files); event.target.value = ""; }} />
            <Input ref={cameraInputRef} type="file" accept="image/*" capture="environment" containerClassName="sr-only" aria-label="Capture photo with camera" onChange={event => { void handleFiles(event.target.files); event.target.value = ""; }} />
            <Button type="button" size="sm" variant="outline" loading={readingFiles} disabled={saving || uncertain || attachments.length >= MAX_PICKUP_FILES} icon={<Upload size={15} aria-hidden="true" />} onClick={() => fileInputRef.current?.click()}>Upload photo or PDF</Button>
            <Button type="button" size="sm" variant="outline" disabled={saving || uncertain || readingFiles || attachments.length >= MAX_PICKUP_FILES} icon={<Camera size={15} aria-hidden="true" />} onClick={() => cameraInputRef.current?.click()}>Take photo</Button>
          </div>
          <p className={styles.customHint}>Up to {MAX_PICKUP_FILES} files (PNG, JPG, WebP, or PDF). {attachments.length}/{MAX_PICKUP_FILES} attached.</p>
          {attachmentError && <Alert variant="error" title="Upload needs attention">{attachmentError}</Alert>}
          {attachments.length > 0 && <ul className={styles.attachmentList} aria-label="Attached files">
            {attachments.map(att => <li key={att.id} className={styles.attachmentCard}>
              {att.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={att.previewUrl} alt={att.upload.name} className={styles.attachmentThumb} />
              ) : (
                <div className={styles.attachmentDoc}><FileText size={18} aria-hidden="true" /></div>
              )}
              <div className={styles.attachmentInfo}>
                <span className={styles.attachmentName} title={att.upload.name}>{att.upload.name}</span>
                <span className={styles.attachmentSize}>{formatFileSize(att.sizeBytes)}</span>
              </div>
              <Button type="button" size="xs" variant="ghost" disabled={saving || uncertain} aria-label={`Remove ${att.upload.name}`} onClick={() => removeAttachment(att.id)}><X size={14} aria-hidden="true" /></Button>
            </li>)}
          </ul>}
        </section>}
      </Card>
    </section>
    {(pickupEnabled || sidebar) && <div className={styles.sidebar}>
      {pickupEnabled && <section aria-labelledby="pharmacy-details-title"><Card padding="none" className={styles.card} contentClassName={styles.cardBody}>
        <header><h2 id="pharmacy-details-title" className={styles.title}>2. Your details</h2><p className={styles.detailsIntro}>So the pharmacy can reach you when your parcel is ready.</p></header>
        {closed && <p role="status" className={styles.closed}>{nextOpening ? `Closed now. Your request will be seen when we open ${nextOpening}.` : "Closed now. Contact the pharmacy to confirm when your request will be reviewed."}</p>}
        <form onSubmit={event => { event.preventDefault(); void submit(); }} noValidate>
          <fieldset disabled={saving || uncertain} className={styles.fields}>
            <Input label="Your name" placeholder="Full name" className={styles.input} value={name} maxLength={100} autoComplete="name" onChange={event => setName(event.target.value)} />
            <Input label="Phone number" placeholder={countryCode === "IN" ? "10-digit mobile number" : "Mobile number"} className={styles.input} type="tel" value={phone} maxLength={32} autoComplete="tel" onChange={event => setPhone(event.target.value)} />
          </fieldset>
          <p className={styles.note}>Sending a request does not reserve stock.<br />Wait until your ticket says <strong>Ready for pickup</strong> before you travel.</p>
          {summaryParts.length > 0 && <p role="status" className={styles.selectionCount}>{selected.length > 0 && !notes.trim() && !attachments.length ? `${selected.length} ${selected.length === 1 ? "medicine" : "medicines"} selected` : `Included: ${summaryParts.join(" · ")}`}</p>}
          {requestError && <Alert variant="error" title="Pickup request needs attention" className="mt-3">{requestError}{uncertain && ticket && <Link href={`/pickup#${ticket}`} className="mt-2 block text-accent underline">Check this pickup ticket</Link>}</Alert>}
          <Button type="submit" className={styles.submit} loading={saving} disabled={!hasContent || !name.trim() || !phone.trim() || readingFiles}>{uncertain ? "Retry the same request" : "Request pickup"}</Button>
        </form>
        {sidebar && <div className={styles.detailsLocation}>{sidebar}</div>}
      </Card></section>}
      {!pickupEnabled && sidebar}
    </div>}
  </div></div>;
}
