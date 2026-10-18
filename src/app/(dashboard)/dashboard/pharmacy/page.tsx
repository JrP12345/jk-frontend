"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { hasAnyPermission } from "@/lib/permissions";
import { authScopeKey } from "@/lib/authScope";
import { validSingleChoice } from "@/lib/locationWorkflow";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useAuthStore } from "@/store/authStore";
import { useLocationStore, type LocationInfo } from "@/store/locationStore";
import { Alert, Table, Tabs, Button, Input, Select, useToast, Badge, Dropdown, ConfirmDialog, ChartContainer, DonutChart, DatePicker } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import { PharmacyAlertsCenter } from "@/components/pharmacy/PharmacyAlertsCenter";
import { dateLabel, expired, lowStock, money, prepareDispense, readMedicineCatalog, type Medicine, type PendingPrescription, type DispenseItem } from "@/components/pharmacy/pharmacyWorkspace";
import styles from "@/components/pharmacy/PharmacyWorkspace.module.css";
import { playChimeSound } from "@/utils/audioChimes";
import { RotateCw, Plus, MoreHorizontal, Edit3, Trash2, Phone, Search, Building2 } from "lucide-react";

const blankMedicine = () => ({ name: "", genericName: "", batchNumber: "", expiryDate: "", stockQuantity: "", costPrice: "", price: "" });
const blankBatch = () => ({ batchNumber: "", expiryDate: "", quantity: "", purchaseCost: "", sellingPrice: "" });
const message = (error: unknown, fallback: string) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

export default function PharmacyPage() {
  const user = useAuthStore(state => state.user);
  const activeLocationId = useLocationStore(state => state.activeLocationId);
  return <PharmacySession key={`${authScopeKey(user)}:${activeLocationId || ""}`} />;
}

function PharmacySession() {
  const user = useAuthStore(state => state.user);
  const { locations, fetchLocations, activeLocationId, error, isLoading } = useLocationStore();
  const [choice, setChoice] = useState(activeLocationId || "");
  const canView = hasAnyPermission(user, "MANAGE_MEDICINES", "VIEW_EHR");
  useEffect(() => { if (canView) void fetchLocations(); }, [canView, fetchLocations]);
  const locationId = validSingleChoice(locations, location => location.id, choice);
  if (!canView) return <Alert variant="warning" title="Pharmacy access required">Your account cannot view pharmacy records.</Alert>;
  return <PharmacyWorkspace key={locationId} locationId={locationId} locations={locations} onLocationChange={setChoice} locationError={error} locationsLoading={isLoading} onRetryLocations={() => { void fetchLocations(true); }} />;
}

function PharmacyWorkspace({ locationId, locations, onLocationChange, locationError, locationsLoading, onRetryLocations }: { locationId: string; locations: LocationInfo[]; onLocationChange: (id: string) => void; locationError: string | null; locationsLoading: boolean; onRetryLocations: () => void }) {
  const user = useAuthStore(state => state.user);
  const scope = authScopeKey(user);
  const canManage = hasAnyPermission(user, "MANAGE_MEDICINES");
  const { toast } = useToast();
  const beginRead = useLatestRead();
  const alive = useRef(true);
  const writeLock = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [activeTab, setActiveTab] = useState("inventory");
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [pending, setPending] = useState<PendingPrescription[]>([]);
  const [reading, setReading] = useState(true);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [pendingLoaded, setPendingLoaded] = useState(false);
  const [dataRevision, setDataRevision] = useState(0);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [dispenseSearch, setDispenseSearch] = useState("");
  const [showHealth, setShowHealth] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [medicineOpen, setMedicineOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [medicineForm, setMedicineForm] = useState(blankMedicine);
  const [medicineTab, setMedicineTab] = useState("medicine");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [batchTarget, setBatchTarget] = useState<Medicine | null>(null);
  const [batchForm, setBatchForm] = useState(blankBatch);
  const [batchError, setBatchError] = useState("");
  const [deleting, setDeleting] = useState<Medicine | null>(null);
  const [prescription, setPrescription] = useState<PendingPrescription | null>(null);
  const [selections, setSelections] = useState<DispenseItem[]>([]);

  const fetchData = useCallback(async () => {
    const request = beginRead(); setReading(true);
    const [catalog, prescriptions] = await Promise.allSettled([
      readMedicineCatalog(locationId, request.signal),
      locationId ? api.get(`/pharmacy/pending-prescriptions?locationId=${encodeURIComponent(locationId)}`, { signal: request.signal }).then(response => {
        if (!Array.isArray(response.data?.data)) throw new Error("Incomplete prescriptions");
        return response.data.data as PendingPrescription[];
      }) : Promise.resolve([] as PendingPrescription[]),
    ]);
    if (!request.isCurrent()) return;
    if (catalog.status === "fulfilled") { setMedicines(catalog.value); setCatalogLoaded(true); setCatalogError(null); }
    else setCatalogError("Inventory could not be loaded. Retry before changing stock or dispensing.");
    if (prescriptions.status === "fulfilled") { setPending(prescriptions.value); setPendingLoaded(true); setPendingError(null); }
    else setPendingError("Prescriptions could not be loaded. Please try again.");
    setDataRevision(previous => previous + 1);
    setReading(false);
  }, [beginRead, locationId]);
  useEffect(() => { void fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!locationId) return;
    let ws: WebSocket | undefined; let current = true;
    try {
      const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api", window.location.origin);
      apiUrl.protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
      if (!["localhost", "127.0.0.1"].includes(window.location.hostname) && ["localhost", "127.0.0.1"].includes(apiUrl.hostname)) apiUrl.hostname = window.location.hostname;
      apiUrl.pathname = "/api/clinical/ws"; apiUrl.search = new URLSearchParams({ locationId }).toString();
      ws = new WebSocket(apiUrl.toString());
      ws.onmessage = event => {
        if (!current) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === "PRESCRIPTION_ISSUED") { playChimeSound("ding-dong"); toast({ title: "New prescription", description: "The dispensing list has been updated.", variant: "info" }); void fetchData(); }
          if (data.type === "PRESCRIPTION_DISPENSED") void fetchData();
        } catch { /* A malformed event must not interrupt the stock workspace. */ }
      };
    } catch { /* Manual refresh remains available if live updates are unavailable. */ }
    return () => { current = false; ws?.close(); };
  }, [locationId, fetchData, toast]);

  async function commit(kind: string, action: () => Promise<unknown>, success: string, close: () => void) {
    if (writeLock.current || !canManage || authScopeKey(useAuthStore.getState().user) !== scope) return;
    writeLock.current = true; setBusy(kind);
    try {
      await action();
      if (!alive.current || authScopeKey(useAuthStore.getState().user) !== scope) return;
      close(); toast({ title: success, variant: "success" }); await fetchData();
    } catch (error) {
      if (alive.current) toast({ title: "Could not save", description: message(error, "Your changes could not be saved. Check the record before retrying."), variant: "error" });
      if (kind === "dispense" && alive.current) await fetchData();
    } finally { writeLock.current = false; if (alive.current) setBusy(null); }
  }

  function openMedicine(medicine?: Medicine) {
    setEditingMedicine(medicine || null); setMedicineTab("medicine"); setErrors({});
    setMedicineForm(medicine ? { name: medicine.name, genericName: medicine.genericName, batchNumber: medicine.batchNumber || "", expiryDate: medicine.expiryDate?.slice(0, 10) || "", stockQuantity: String(medicine.stockQuantity), costPrice: String(medicine.costPrice), price: String(medicine.price) } : blankMedicine());
    setMedicineOpen(true);
  }
  function openBatch(medicine: Medicine) { setBatchTarget(medicine); setBatchError(""); setBatchForm({ ...blankBatch(), purchaseCost: String(medicine.costPrice), sellingPrice: String(medicine.price) }); }
  function saveMedicine(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    for (const field of ["name", "genericName", "batchNumber", "expiryDate"] as const) if (!medicineForm[field].trim()) next[field] = "This field is required.";
    if (medicineForm.expiryDate && !Number.isFinite(new Date(medicineForm.expiryDate).getTime())) next.expiryDate = "Enter a valid date.";
    const quantity = Number(medicineForm.stockQuantity), cost = Number(medicineForm.costPrice), retail = Number(medicineForm.price);
    if (!medicineForm.stockQuantity || !Number.isSafeInteger(quantity) || quantity < 0) next.stockQuantity = "Enter a whole quantity of zero or more.";
    if (!Number.isFinite(cost) || cost <= 0) next.costPrice = "Enter a purchase cost greater than zero.";
    if (!Number.isFinite(retail) || retail <= cost) next.price = "Retail price must be greater than purchase cost.";
    if (!locationId && !editingMedicine) next.name = "Choose a location before adding medicine.";
    setErrors(next);
    if (Object.keys(next).length) { setMedicineTab(next.name || next.genericName || next.batchNumber || next.expiryDate ? "medicine" : "stock"); return; }
    const payload = { ...medicineForm, name: medicineForm.name.trim(), genericName: medicineForm.genericName.trim(), batchNumber: medicineForm.batchNumber.trim(), stockQuantity: quantity, costPrice: cost, price: retail, locationId: editingMedicine?.locationId || locationId };
    void commit("medicine", () => editingMedicine ? api.put(`/medicines/${editingMedicine.id}`, payload) : api.post("/medicines", payload), editingMedicine ? "Medicine updated" : "Medicine added", () => setMedicineOpen(false));
  }
  function saveBatch(event: React.FormEvent) {
    event.preventDefault(); if (!batchTarget) return;
    const quantity = Number(batchForm.quantity), cost = Number(batchForm.purchaseCost), price = Number(batchForm.sellingPrice);
    if (!batchForm.batchNumber.trim() || !Number.isFinite(new Date(batchForm.expiryDate).getTime()) || !Number.isSafeInteger(quantity) || quantity <= 0 || !batchForm.purchaseCost || !batchForm.sellingPrice || !Number.isFinite(cost) || !Number.isFinite(price) || cost < 0 || price < 0) { setBatchError("Enter a batch number, valid expiry date, whole quantity and non-negative prices."); return; }
    void commit("batch", () => api.post("/pharmacy/batches", { medicineId: batchTarget.id, locationId: batchTarget.locationId, batchNumber: batchForm.batchNumber.trim(), expiryDate: batchForm.expiryDate, quantity, purchaseCost: cost, sellingPrice: price }), "Batch stock added", () => setBatchTarget(null));
  }
  function openDispense(group: PendingPrescription) {
    setPrescription(group);
    // Do not infer quantities or substitute a similarly named formulation.
    setSelections(group.prescriptions.map(rx => ({ medicineId: medicines.find(medicine => medicine.id === rx.medicineId && medicine.stockQuantity > 0)?.id || "", quantity: 0 })));
  }
  const prepared = prepareDispense(prescription?.prescriptions || [], selections, medicines, locationId);
  const currentPrescriptions = pending.find(group => group.encounterId === prescription?.encounterId)?.prescriptions || [];
  const prescriptionChanged = Boolean(prescription && prepared.prescriptionIds?.some(id => !currentPrescriptions.some(item => item.id === id)));
  const estimatedTotal = selections.reduce((total, item) => total + (medicines.find(medicine => medicine.id === item.medicineId)?.price || 0) * (Number.isFinite(item.quantity) ? item.quantity : 0), 0);
  function dispense(event: React.FormEvent) {
    event.preventDefault(); if (!prescription || prepared.error || prescriptionChanged || !locationId || catalogError || pendingError || reading) return;
    const payload = { patientId: prescription.patientId.id, doctorId: prescription.doctorId.id, locationId, items: prepared.items, prescriptionIds: prepared.prescriptionIds,
      ...(/^[a-f\d]{24}$/i.test(prescription.encounterId) ? { encounterId: prescription.encounterId } : {}),
      ...(prescription.appointmentId && /^[a-f\d]{24}$/i.test(prescription.appointmentId) ? { appointmentId: prescription.appointmentId } : {}) };
    void commit("dispense", () => api.post("/pharmacy/dispense", payload), "Dispensed and invoice created", () => setPrescription(null));
  }
  const actionable = catalogLoaded && !catalogError && !busy;
  const selectedLocation = locations.find(location => location.id === locationId);
  const filteredMedicines = medicines.filter(medicine => {
    const matches = `${medicine.name} ${medicine.genericName} ${medicine.batchNumber}`.toLowerCase().includes(search.trim().toLowerCase());
    return matches && (filter === "all" || filter === "low" && lowStock(medicine) || filter === "out" && medicine.stockQuantity === 0 || filter === "expired" && expired(medicine.expiryDate));
  });
  const filteredPending = pending.filter(group => `${group.patientId.name} ${group.patientId.phone || ""} ${group.tokenNumber || ""} ${group.prescriptions.map(rx => rx.name).join(" ")}`.toLowerCase().includes(dispenseSearch.trim().toLowerCase().replace(/^#/, "")));
  const stockActions = (medicine: Medicine) => canManage && <Dropdown align="right" trigger={<Button variant="ghost" size="sm" className={styles.icon} aria-label={`Actions for ${medicine.name}`} disabled={!actionable}><MoreHorizontal size={18} /></Button>} items={[
    { label: "Add batch", icon: <Plus size={16} />, onClick: () => openBatch(medicine) },
    { label: "Edit medicine", icon: <Edit3 size={16} />, onClick: () => openMedicine(medicine) },
    { divider: true, label: "" }, { label: "Delete medicine", icon: <Trash2 size={16} />, variant: "danger", onClick: () => setDeleting(medicine) },
  ]} />;
  const medicineIdentity = (medicine: Medicine) => <div className={styles.identity}><strong>{medicine.name}</strong><small>{medicine.genericName}</small></div>;
  const quantity = (medicine: Medicine) => <span className={medicine.stockQuantity === 0 || lowStock(medicine) ? styles.danger : ""}>{medicine.stockQuantity} {medicine.stockQuantity === 0 ? "(out of stock)" : lowStock(medicine) ? "(low)" : ""}</span>;
  const inventory = <div className={styles.list}>
    <section className={styles.panel} aria-label="Medicine inventory">
      <div className={styles.toolbar}><Input type="search" icon={<Search size={16} />} aria-label="Search medicines" placeholder="Search" value={search} onChange={event => setSearch(event.target.value)} /><Select aria-label="Filter inventory" value={filter} onChange={event => setFilter(event.target.value)} options={[{ value: "all", label: "All stock" }, { value: "low", label: "Low stock" }, { value: "out", label: "Out of stock" }, { value: "expired", label: "Catalog expired" }]} /></div>
      <Table<Medicine> variant="flat" density="compact" fitContent searchable={false} showColumnVisibility={false} loading={reading && !catalogLoaded} error={catalogError} onRetry={fetchData} data={filteredMedicines} pagination={filteredMedicines.length > 10} columns={[
        { key: "name", header: "Medicine", render: medicineIdentity }, { key: "batchNumber", header: "Catalog batch" },
        { key: "stockQuantity", header: "Stock", render: quantity }, { key: "expiryDate", header: "Catalog expiry", render: medicine => <span className={expired(medicine.expiryDate) ? styles.danger : ""}>{dateLabel(medicine.expiryDate)}</span> },
        { key: "price", header: "Retail", render: medicine => money(medicine.price) }, { key: "actions", header: "", align: "right", render: stockActions },
      ]} renderMobileCard={medicine => <article className={styles.card}><div className={styles.rowHeading}>{medicineIdentity(medicine)}{stockActions(medicine)}</div><div className={styles.meta}><span>Batch {medicine.batchNumber || "Not recorded"}</span></div><dl className={styles.cardFacts}><div><dt>Stock</dt><dd>{quantity(medicine)}</dd></div><div><dt>Retail</dt><dd>{money(medicine.price)}</dd></div><div><dt>Catalog expiry</dt><dd className={expired(medicine.expiryDate) ? styles.danger : ""}>{dateLabel(medicine.expiryDate)}</dd></div></dl></article>} emptyMessage={search || filter !== "all" ? "No medicines match these filters." : "No medicines yet. Add medicine to start your inventory."} />
      {catalogLoaded && <p className={styles.count}>{filteredMedicines.length} of {medicines.length} medicines</p>}
    </section>
    {catalogLoaded && medicines.length > 0 && <details className={styles.details} onToggle={event => setShowHealth(event.currentTarget.open)}><summary>Stock overview</summary>{showHealth && <ChartContainer title="Catalog stock" description="Catalog expiry is shown here; Alerts lists individual batch expiry dates." height={180}><DonutChart height={180} data={[{ name: "In stock", value: medicines.filter(m => !lowStock(m)).length, color: "var(--chart-2)" }, { name: "Low stock", value: medicines.filter(m => lowStock(m) && m.stockQuantity > 0).length, color: "var(--chart-3)" }, { name: "Out of stock", value: medicines.filter(m => m.stockQuantity === 0).length, color: "var(--danger)" }].filter(value => value.value > 0)} /></ChartContainer>}</details>}
  </div>;
  const dispensing = !locationId ? <p className={styles.empty}>Choose a location to view and dispense prescriptions.</p> : <section className={styles.panel} aria-label="Pending prescriptions">
    <div className={`${styles.toolbar} ${styles.toolbarSingle}`}><Input type="search" aria-label="Search prescriptions" icon={<Search size={16} />} placeholder="Patient, phone, token or medicine" value={dispenseSearch} onChange={event => setDispenseSearch(event.target.value)} /></div>
    <Table<PendingPrescription> variant="flat" density="compact" fitContent searchable={false} showColumnVisibility={false} keyField="encounterId" loading={reading && !pendingLoaded} error={pendingError} onRetry={fetchData} data={filteredPending} pagination={filteredPending.length > 10} columns={[
      { key: "patient", header: "Patient", render: group => <div className={styles.identity}><strong>{group.patientId.name} {group.tokenNumber ? <Badge variant="primary">#{group.tokenNumber}</Badge> : null}</strong><small>{group.patientId.phone}</small></div> },
      { key: "doctor", header: "Doctor / visit", render: group => <div className={styles.identity}><span>{group.doctorId?.name}</span><small>{dateLabel(group.appointmentTime || "")}</small></div> },
      { key: "prescriptions", header: "Prescribed", render: group => <div className={styles.identity}><span>{group.prescriptions.length} items</span><small>{group.prescriptions.map(rx => rx.name).join(", ")}</small></div> },
      { key: "action", header: "", align: "right", render: group => canManage && <Button size="sm" disabled={!actionable || reading || Boolean(pendingError)} onClick={() => openDispense(group)}>Dispense</Button> },
    ]} renderMobileCard={group => <article className={styles.card}><div className={styles.rowHeading}><div className={styles.identity}><strong>{group.patientId.name}</strong>{group.patientId.phone && <a href={`tel:${group.patientId.phone}`} className={styles.meta}><Phone size={12} />{group.patientId.phone}</a>}</div>{group.tokenNumber ? <Badge variant="primary">#{group.tokenNumber}</Badge> : null}</div><div className={styles.meta}><span>{group.doctorId?.name}</span><span>{dateLabel(group.appointmentTime || "")}</span></div><p className={styles.meta}>{group.prescriptions.length} prescribed: {group.prescriptions.map(rx => rx.name).join(", ")}</p>{canManage && <Button size="sm" disabled={!actionable || reading || Boolean(pendingError)} onClick={() => openDispense(group)}>Dispense</Button>}</article>} emptyMessage={dispenseSearch ? "No prescriptions match this search." : "No prescriptions awaiting dispensing."} />
  </section>;

  return <div className={styles.workspace}>
    <header className={styles.header}><div><h1>Pharmacy</h1><p>Medicine stock, prescriptions and batch alerts</p></div><div className={styles.actions}><Button variant="ghost" size="sm" aria-label="Refresh pharmacy" className={styles.icon} disabled={reading || Boolean(busy)} onClick={fetchData}><RotateCw size={17} className={reading ? "animate-spin" : ""} /></Button>{canManage && <Button size="sm" disabled={!locationId || !actionable || reading} onClick={() => openMedicine()}><Plus size={16} />Add medicine</Button>}</div></header>
    <div className={styles.context}>{locations.length > 1 ? <Select aria-label="Pharmacy location" value={locationId} disabled={Boolean(busy)} onChange={event => onLocationChange(event.target.value)} options={[{ value: "", label: "All locations" }, ...locations.map(location => ({ value: location.id, label: location.name }))]} /> : <><Building2 size={15} /><p>{selectedLocation?.name || (locationsLoading ? "Loading locations..." : "No location available")}</p></>}</div>
    {locationError && <Alert variant="error" title="Locations could not be loaded" action={<Button size="sm" variant="outline" onClick={onRetryLocations}>Retry locations</Button>}>{locationError}</Alert>}
    {catalogError && activeTab === "dispensing" && <Alert variant="error" title="Inventory unavailable" action={<Button size="sm" variant="outline" onClick={fetchData}>Retry inventory</Button>}>{catalogError}</Alert>}
    <Tabs className={styles.tabs} variant="pills" activeTab={activeTab} onChange={setActiveTab} scrollActiveIntoView={false} tabs={[
      { id: "inventory", label: "Inventory", badge: catalogLoaded ? medicines.length : undefined, content: inventory },
      { id: "dispensing", label: "Dispense", badge: locationId && pendingLoaded ? pending.length : undefined, content: dispensing },
      { id: "alerts", label: "Alerts", content: <PharmacyAlertsCenter locationId={locationId} medicines={medicines} canManage={canManage && actionable} inventoryLoading={reading && !catalogLoaded} inventoryError={catalogError} onOpenAddBatch={openBatch} refreshKey={dataRevision} /> },
    ]} />

    <Modal open={medicineOpen} onClose={() => setMedicineOpen(false)} busy={busy === "medicine"} title={editingMedicine ? "Edit medicine" : "Add medicine"} description={editingMedicine?.name || selectedLocation?.name} size="lg" bodyClassName={styles.dialog} footer={<><Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => setMedicineOpen(false)}>Cancel</Button><Button size="sm" type="submit" form="medicine-form" loading={busy === "medicine"}>Save medicine</Button></>}>
      <form id="medicine-form" onSubmit={saveMedicine} noValidate>
        <Tabs variant="pills" activeTab={medicineTab} onChange={setMedicineTab} scrollActiveIntoView={false} tabs={[{ id: "medicine", label: "Medicine" }, { id: "stock", label: "Stock & pricing" }]} />
        <fieldset disabled={Boolean(busy)} className={styles.form} hidden={medicineTab !== "medicine"}><Input label="Medicine name *" value={medicineForm.name} onChange={event => setMedicineForm({ ...medicineForm, name: event.target.value })} error={errors.name} autoComplete="off" required /><Input label="Generic composition *" value={medicineForm.genericName} onChange={event => setMedicineForm({ ...medicineForm, genericName: event.target.value })} error={errors.genericName} required /><div className={styles.fieldGrid}><Input label="Batch number *" value={medicineForm.batchNumber} onChange={event => setMedicineForm({ ...medicineForm, batchNumber: event.target.value })} error={errors.batchNumber} required /><DatePicker label="Expiry date *"  value={medicineForm.expiryDate} onChange={value => setMedicineForm({ ...medicineForm, expiryDate: value })} error={errors.expiryDate} required /></div></fieldset>
        <fieldset disabled={Boolean(busy)} className={styles.form} hidden={medicineTab !== "stock"}><div className={styles.fieldGrid}><Input label="Purchase cost *" type="number" inputMode="decimal" step="0.01" value={medicineForm.costPrice} onChange={event => setMedicineForm({ ...medicineForm, costPrice: event.target.value })} error={errors.costPrice} required /><Input label="Retail price *" type="number" inputMode="decimal" step="0.01" value={medicineForm.price} onChange={event => setMedicineForm({ ...medicineForm, price: event.target.value })} error={errors.price} required /></div><Input label="Stock quantity *" type="number" inputMode="numeric" min="0" step="1" value={medicineForm.stockQuantity} onChange={event => setMedicineForm({ ...medicineForm, stockQuantity: event.target.value })} error={errors.stockQuantity} required /><p className={styles.meta}>Prices are in INR. Use Add batch to receive additional stock.</p></fieldset>
      </form>
    </Modal>
    <Modal open={Boolean(batchTarget)} onClose={() => setBatchTarget(null)} busy={busy === "batch"} title="Add batch" description={batchTarget?.name} size="md" bodyClassName={styles.dialog} footer={<><Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => setBatchTarget(null)}>Cancel</Button><Button size="sm" form="batch-form" type="submit" loading={busy === "batch"}>Save batch</Button></>}>
      <form id="batch-form" onSubmit={saveBatch} noValidate className={styles.form}>{batchError && <Alert variant="error" title="Check batch details">{batchError}</Alert>}<fieldset disabled={Boolean(busy)} className={styles.form}><div className={styles.fieldGrid}><Input label="Batch number *" value={batchForm.batchNumber} onChange={event => setBatchForm({ ...batchForm, batchNumber: event.target.value })} required /><DatePicker label="Expiry date *"  value={batchForm.expiryDate} onChange={value => setBatchForm({ ...batchForm, expiryDate: value })} required /></div><Input label="Quantity received *" type="number" min="1" step="1" inputMode="numeric" value={batchForm.quantity} onChange={event => setBatchForm({ ...batchForm, quantity: event.target.value })} required /><div className={styles.fieldGrid}><Input label="Purchase cost *" type="number" min="0" step="0.01" value={batchForm.purchaseCost} onChange={event => setBatchForm({ ...batchForm, purchaseCost: event.target.value })} required /><Input label="Selling price *" type="number" min="0" step="0.01" value={batchForm.sellingPrice} onChange={event => setBatchForm({ ...batchForm, sellingPrice: event.target.value })} required /></div></fieldset></form>
    </Modal>
    <Modal open={Boolean(prescription)} onClose={() => setPrescription(null)} busy={busy === "dispense"} title="Dispense prescription" footerClassName={styles.dispenseFooter} description={prescription?.patientId.name} size="lg" bodyClassName={styles.dialog} footer={<><div className={styles.subtotal}><span>Estimated subtotal</span><strong>{money(estimatedTotal)}</strong></div><Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => setPrescription(null)}>Cancel</Button><Button size="sm" type="submit" form="dispense-form" loading={busy === "dispense"} disabled={Boolean(prepared.error || prescriptionChanged || catalogError || pendingError || reading)}>Dispense & bill</Button></>}>
      <form id="dispense-form" onSubmit={dispense} className={styles.form}><p className={styles.summary}>Choose stock and quantities. Unselected items stay pending.</p>{prescription?.prescriptions.map((rx, index) => <fieldset key={rx.id} className={styles.rx} disabled={Boolean(busy)}><div><h3>{rx.name}</h3><p>{[rx.dosage, rx.frequency, rx.duration].filter(Boolean).join(" / ")}</p>{rx.instructions && <p>{rx.instructions}</p>}</div><div className={styles.mapping}><Select label="Stock item" aria-label={`Stock for ${rx.name}`} value={selections[index]?.medicineId || ""} onChange={event => setSelections(previous => previous.map((item, position) => position === index ? { ...item, medicineId: event.target.value } : item))} options={[{ value: "", label: "Leave pending" }, ...medicines.filter(medicine => medicine.locationId === locationId).map(medicine => ({ value: medicine.id, label: `${medicine.name} / ${medicine.stockQuantity} in stock / ${money(medicine.price)}`, disabled: medicine.stockQuantity <= 0 }))]} /><Input aria-label={`Quantity for ${rx.name}`} label="Quantity" type="number" inputMode="numeric" min="1" step="1" value={selections[index]?.quantity || ""} disabled={!selections[index]?.medicineId} onChange={event => setSelections(previous => previous.map((item, position) => position === index ? { ...item, quantity: Number(event.target.value) } : item))} /></div></fieldset>)}{prescriptionChanged && <Alert variant="warning" title="Prescription changed">Close and reopen this prescription from the refreshed list before dispensing.</Alert>}{prepared.error && <p role="status" className={styles.meta}>{prepared.error}</p>}{catalogError && <Alert variant="error" title="Inventory unavailable">Close and refresh inventory before dispensing.</Alert>}</form>
    </Modal>
    <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} loading={busy === "delete"} title="Delete medicine?" description={`Remove ${deleting?.name || "this medicine"} from the inventory catalog? This action cannot be undone.`} variant="danger" confirmLabel="Delete medicine" onConfirm={() => { if (deleting) void commit("delete", () => api.delete(`/medicines/${deleting.id}`), "Medicine deleted", () => setDeleting(null)); }} />
  </div>;
}
