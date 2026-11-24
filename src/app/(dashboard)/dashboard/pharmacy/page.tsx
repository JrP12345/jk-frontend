"use client";

import { PharmacyProductStockTools } from "@/components/pharmacy/PharmacyProductStockTools";
import { PharmacyStaffGuide } from "@/components/pharmacy/PharmacyStaffGuide";
import { PharmacyAlternatives } from "@/components/pharmacy/PharmacyAlternatives";
import type { StaffPickup } from "@/lib/publicPharmacy";
import { PharmacyTransfers } from "@/components/pharmacy/PharmacyTransfers";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import api from "@/lib/api";
import { hasAnyPermission } from "@/lib/permissions";
import { isCounterSalesUser, parsePharmacyCapabilities, pharmacyEntryPermissions, type PharmacyCapabilities } from "@/lib/pharmacyCapabilities";
import { authScopeKey } from "@/lib/authScope";
import { acknowledgeDispenseReference, dispenseReferenceScope, readDispenseReference, recoverPharmacyDispense, reserveDispenseReference, submitPharmacyDispense, subscribeDispenseReferences, type DispensePayload, type DispenseResult } from "@/lib/pharmacyOperations";
import { validSingleChoice } from "@/lib/locationWorkflow";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useAuthStore } from "@/store/authStore";
import { useLocationStore, type LocationInfo } from "@/store/locationStore";
import { Alert, Table, Tabs, Button, Input, Select, useToast, Badge, Dropdown, ConfirmDialog, ChartContainer, DonutChart, DatePicker } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import { PharmacyAlertsCenter } from "@/components/pharmacy/PharmacyAlertsCenter";
import { PharmacyStockReceipts } from "@/components/pharmacy/PharmacyStockReceipts";
import type { PurchaseProduct } from "@/services/pharmacyPurchase.service";
import { PharmacyPurchases } from "@/components/pharmacy/PharmacyPurchases";
import { PharmacyPickups } from "@/components/pharmacy/PharmacyPickups";
import { PharmacyExternalPrescriptions } from "@/components/pharmacy/PharmacyExternalPrescriptions";
import { PharmacyPrescriptionAttachments } from "@/components/pharmacy/PharmacyPrescriptionAttachments";
import { PharmacyFileHistory } from "@/components/pharmacy/PharmacyFileHistory";
import { PharmacyProfessionalReview } from "@/components/pharmacy/PharmacyProfessionalReview";
import { PharmacyCollections } from "@/components/pharmacy/PharmacyCollections";
import { PharmacyReturns } from "@/components/pharmacy/PharmacyReturns";
import { PharmacyCounter } from "@/components/pharmacy/PharmacyCounter";
import { PharmacyProductReview } from "@/components/pharmacy/PharmacyProductReview";
import { PharmacySaleControls } from "@/components/pharmacy/PharmacySaleControls";
import { PharmacyDocumentButton } from "@/components/pharmacy/PharmacyDocumentButton";
import { PharmacyReports } from "@/components/pharmacy/PharmacyReports";
import { PharmacyRegister } from "@/components/pharmacy/PharmacyRegister";
import { PharmacyDailyOverview } from "@/components/pharmacy/PharmacyDailyOverview";
import type { PharmacyReportKind } from "@/lib/pharmacyReports";
import { PharmacyImports } from "@/components/pharmacy/PharmacyImports";
import { PharmacyCatalogueDiscovery } from "@/components/pharmacy/PharmacyCatalogueDiscovery";
import { PharmacyNavigation } from "@/components/pharmacy/PharmacyNavigation";
import { PharmacyTill } from "@/components/pharmacy/PharmacyTill";
import { PharmacySkeleton } from "@/components/pharmacy/PharmacySkeleton";
import { PharmacyFinance } from "@/components/pharmacy/PharmacyFinance";
import { stockReceiptScope, readStockReceiptReference, subscribeStockReceiptReferences } from "@/lib/pharmacyStockReceipts";
import { dateLabel, expired, lowStock, money, prepareDispense, readMedicinePage, type Medicine, type PendingPrescription, type DispenseItem } from "@/components/pharmacy/pharmacyWorkspace";
import styles from "@/components/pharmacy/PharmacyWorkspace.module.css";
import { playChimeSound } from "@/utils/audioChimes";
import { parseReceiptPaise } from "@/lib/pharmacyStockReceipts";
import { RotateCw, Plus, MoreHorizontal, Edit3, Trash2, Phone, Search, Building2, Upload, ClipboardCheck } from "lucide-react";

const blankMedicine = () => ({ name: "", genericName: "", batchNumber: "", expiryDate: "", stockQuantity: "0", costPrice: "", price: "", manufacturer: "", strength: "", rackLocation: "", category: "tablet", scheduleType: "general",
  barcodes: "", reorderLevel: "20", hsnCode: "", gstRate: "", baseUnit: "", packUnit: "", unitsPerPack: "", outerPackUnit: "", packsPerOuter: "", supplyBatch: "", supplyExpiry: "", supplyPrecision: "month", supplyMrp: "" });
const medicineForms = ["tablet", "capsule", "syrup", "injection", "ointment", "drops", "inhaler", "other"];
const baseUnits = ["tablet", "capsule", "ml", "g", "piece", "dose"], packUnits = ["strip", "box", "bottle", "vial", "tube", "ampoule", "sachet", "pack", "piece"];
const blankBatch = () => ({ unlinkedInwardReason: "", batchNumber: "", expiryDate: "", quantity: "", purchaseCost: "", sellingPrice: "" });
const message = (error: unknown, fallback: string) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

export default function PharmacyPage() {
  const user = useAuthStore(state => state.user);
  const activeLocationId = useLocationStore(state => state.activeLocationId);
  return <PharmacySession key={`${authScopeKey(user)}:${activeLocationId || ""}`} />;
}

function PharmacySession() {
  const user = useAuthStore(state => state.user);
  const { locations, fetchLocations, activeLocationId, setActiveLocation, error, isLoading, isLoaded } = useLocationStore();
  const canView = Boolean(user && !["patient", "family_member", "guest"].includes(user.role)) && hasAnyPermission(user, ...pharmacyEntryPermissions);
  useEffect(() => { if (canView) void fetchLocations(); }, [canView, fetchLocations]);
  const locationId = validSingleChoice(locations, location => location.id, activeLocationId || "");
  if (!canView) return <Alert variant="warning" title="Pharmacy access required">Your account cannot view pharmacy records.</Alert>;
  if (!error && (!isLoaded || isLoading && !locations.length)) return <PharmacySkeleton counter={user?.workspaceProfile === "pharmacy" || isCounterSalesUser(user)} />;
  return <PharmacyWorkspace key={locationId} locationId={locationId} locations={locations} onLocationChange={id => setActiveLocation(id || null)} locationError={error} locationsLoading={isLoading} onRetryLocations={() => { void fetchLocations(true); }} />;
}

function PharmacyWorkspace({ locationId, locations, onLocationChange, locationError, locationsLoading, onRetryLocations }: { locationId: string; locations: LocationInfo[]; onLocationChange: (id: string) => void; locationError: string | null; locationsLoading: boolean; onRetryLocations: () => void }) {
  const user = useAuthStore(state => state.user);
  const scope = authScopeKey(user);
  const [capabilities, setCapabilities] = useState<PharmacyCapabilities | null>(null);
  const [capabilityError, setCapabilityError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const canManage = Boolean(capabilities?.actions.dispense);
  const canRecover = Boolean(capabilities?.actions.recoverDispense);
  const canCatalog = Boolean(capabilities?.actions.manageCatalog);
  const canReceive = Boolean(capabilities?.actions.receiveStock);
  const canViewCost = Boolean(capabilities?.actions.viewCost);
  const canCreate = canCatalog;
  const counterOnly = isCounterSalesUser(user);
  const { toast } = useToast();
  const beginRead = useLatestRead();
  const alive = useRef(true);
  const writeLock = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [activeTab, setActiveTab] = useState(user?.workspaceProfile === "pharmacy" || counterOnly ? "counter" : "inventory");
  const [reportSeed, setReportSeed] = useState<{ kind: PharmacyReportKind; date: string }>();
  const professionalReturnTab = useRef("counter");
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogPages, setCatalogPages] = useState(0), [catalogTotal, setCatalogTotal] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingPrescription[]>([]);
  const [reading, setReading] = useState(true);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [pendingLoaded, setPendingLoaded] = useState(false);
  const [dataRevision, setDataRevision] = useState(0);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setCatalogPage(1); }, 250); return () => clearTimeout(timer); }, [search]);
  const [filter, setFilter] = useState("all");
  const [dispenseSearch, setDispenseSearch] = useState("");
  const [showHealth, setShowHealth] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [medicineOpen, setMedicineOpen] = useState(false);
  const [counterCatalogueRevision, setCounterCatalogueRevision] = useState(0);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [medicineForm, setMedicineForm] = useState(blankMedicine);
  const [shortbookProduct, setShortbookProduct] = useState<PurchaseProduct>();
  const [supplierReturnTarget, setSupplierReturnTarget] = useState<{ purchaseId: string; batchId: string }>();
  const [medicineTab, setMedicineTab] = useState("medicine");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [batchTarget, setBatchTarget] = useState<Medicine | null>(null);
  const [receiptTarget, setReceiptTarget] = useState<Medicine | null>(null);
  const [reviewTarget, setReviewTarget] = useState<string | null>(null);
  const [saleControlTarget, setSaleControlTarget] = useState<string | null>(null);
  const [stockTarget, setStockTarget] = useState<string | null>(null);
  const [comparisonTarget, setComparisonTarget] = useState<string | null>(null);
  const [pickupDraft, setPickupDraft] = useState<StaffPickup | null>(null), [returnInvoice, setReturnInvoice] = useState<string | null>(null);
  const stockReferenceScope = stockReceiptScope(user, locationId);
  const pendingStockReceipt = useSyncExternalStore(subscribeStockReceiptReferences, () => readStockReceiptReference(stockReferenceScope), () => null);
  const [batchForm, setBatchForm] = useState(blankBatch);
  const [batchError, setBatchError] = useState("");
  const [deleting, setDeleting] = useState<Medicine | null>(null);
  const [prescription, setPrescription] = useState<PendingPrescription | null>(null);
  const [selections, setSelections] = useState<DispenseItem[]>([]);
  const [selectionStock, setSelectionStock] = useState<Medicine[]>([]), [stockLookupBusy, setStockLookupBusy] = useState(false), [stockLookupError, setStockLookupError] = useState("");
  const beginStockLookup = useLatestRead();
  const referenceScope = dispenseReferenceScope(user, locationId);
  const pendingDispenseKey = useSyncExternalStore(subscribeDispenseReferences, () => readDispenseReference(referenceScope), () => null);
  const pendingDraft = useRef<{ key: string; payload: DispensePayload } | null>(null);
  const [retryDraftKey, setRetryDraftKey] = useState<string | null>(null);
  const checkedReference = useRef<string | null>(null);
  const [dispenseResult, setDispenseResult] = useState<DispenseResult | null>(null);
  const confirmedDispense = dispenseResult?.dispenseOperation.key === pendingDispenseKey ? dispenseResult : null;
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const checkedCapabilities = useRef<{ value: PharmacyCapabilities; at: number } | null>(null);
  const lastCatalogCriteria = useRef("");

  const fetchData = useCallback(async () => {
    const request = beginRead(); setReading(true);
    if (!locationId) { setCapabilities(null); setMedicines([]); setPending([]); setReading(false); return; }
    const criteria = JSON.stringify([catalogPage, query, filter]);
    const cached = checkedCapabilities.current;
    // Only replaceable search/page/filter reads reuse this short-lived check.
    // Refreshes, mutations and prescription events still recheck all authority.
    const catalogOnly = Boolean(cached && lastCatalogCriteria.current !== criteria && Date.now() - cached.at < 30_000);
    lastCatalogCriteria.current = criteria;
    let current: PharmacyCapabilities;
    try {
      if (catalogOnly) current = cached!.value;
      else {
        const response = await api.get(`/pharmacy/locations/${locationId}/capabilities`, { signal: request.signal });
        current = parsePharmacyCapabilities(response.data?.data, locationId);
      }
      if (!request.isCurrent()) return;
      if (!catalogOnly) checkedCapabilities.current = { value: current, at: Date.now() };
      setCapabilities(current); setCapabilityError(null);
      if (current.inventoryMode === "billing_only") setFilter("all");
      if (!current.actions.viewRxQueue) { setPending([]); setPrescription(null); }
      if (!current.actions.viewStock) { setMedicines([]); setSelectionStock([]); setStockTarget(null); }
      if (!current.actions.viewCost) {
        setMedicineForm(previous => ({ ...previous, costPrice: "" }));
        setBatchForm(previous => ({ ...previous, purchaseCost: "" }));
        setSelectionStock(previous => previous.map(medicine => { const { costPrice, ...visible } = medicine; void costPrice; return visible; }));
      }
      if (!current.actions.manageCatalog) { setMedicineOpen(false); setDeleting(null); }
      if (!current.actions.receiveStock) setBatchTarget(null);
    } catch {
      if (!request.isCurrent()) return;
      checkedCapabilities.current = null;
      setCapabilities(null); setStockTarget(null); setPickupDraft(null); setReturnInvoice(null); setMedicines([]); setSelectionStock([]); setPending([]); setPrescription(null); setMedicineOpen(false); setBatchTarget(null); setDeleting(null);
      setCapabilityError("Pharmacy access could not be checked. Retry before viewing records or making changes."); setReading(false); return;
    }
    const [catalog, prescriptions] = await Promise.allSettled([
      current.actions.viewStock ? readMedicinePage(locationId, request.signal, { page: catalogPage, search: query, stockFilter: current.inventoryMode === "billing_only" ? "all" : filter }) : Promise.resolve({ items: [] as Medicine[], totalPages: 0, totalCount: 0, page: 1 }),
      catalogOnly ? Promise.resolve(null) : current.actions.viewRxQueue ? api.get(`/pharmacy/pending-prescriptions?locationId=${encodeURIComponent(locationId)}`, { signal: request.signal }).then(response => {
        if (!Array.isArray(response.data?.data)) throw new Error("Incomplete prescriptions");
        return response.data.data as PendingPrescription[];
      }) : Promise.resolve([] as PendingPrescription[]),
    ]);
    if (!request.isCurrent()) return;
    if (catalog.status === "rejected" && [401, 403].includes(catalog.reason?.response?.status)) {
      checkedCapabilities.current = null;
      setCapabilities(null); setStockTarget(null); setPickupDraft(null); setReturnInvoice(null); setMedicines([]); setSelectionStock([]); setPending([]); setPrescription(null); setMedicineOpen(false); setBatchTarget(null); setDeleting(null);
      setCapabilityError("Pharmacy access changed. Refresh before viewing records or making changes."); setReading(false); return;
    }
    if (catalog.status === "fulfilled") { setMedicines(catalog.value.items); setCatalogPages(catalog.value.totalPages); setCatalogTotal(catalog.value.totalCount); setCatalogLoaded(true); setCatalogError(null); }
    else setCatalogError("Inventory could not be loaded. Retry before changing stock or dispensing.");
    if (prescriptions.status === "fulfilled" && prescriptions.value !== null) { setPending(prescriptions.value); setPendingLoaded(true); setPendingError(null); }
    else if (prescriptions.status === "rejected") setPendingError("Prescriptions could not be loaded. Please try again.");
    setDataRevision(previous => previous + 1);
    setReading(false);
  }, [beginRead, locationId, catalogPage, query, filter]);
  useEffect(() => { void fetchData(); }, [fetchData]);

  const acceptDispenseResult = useCallback(async (result: DispenseResult, key: string) => {
    if (!alive.current || authScopeKey(useAuthStore.getState().user) !== scope || readDispenseReference(referenceScope) !== key) return;
    setDispenseResult(result); setPrescription(null); setRecoveryMessage("");
    toast({ title: "Dispense confirmed", description: `Invoice ${result.dispenseOperation.invoiceNumber}; added ${money(result.dispenseOperation.addedAmount)}.`, variant: "success" });
    await fetchData();
  }, [fetchData, referenceScope, scope, toast]);

  const recoverDispense = useCallback(async (key: string) => {
    try {
      const result = await recoverPharmacyDispense(locationId, key);
      await acceptDispenseResult(result, key);
    } catch (error) {
      if (alive.current && authScopeKey(useAuthStore.getState().user) === scope && readDispenseReference(referenceScope) === key) {
        setRecoveryMessage(message(error, "No committed result could be confirmed. Keep this reference and check again. If it remains unresolved, request review before supplying or billing again."));
      }
    }
  }, [acceptDispenseResult, locationId, referenceScope, scope]);

  const checkDispenseOutcome = useCallback(async (key: string) => {
    if (writeLock.current || !canRecover || authScopeKey(useAuthStore.getState().user) !== scope) return;
    writeLock.current = true; setBusy("recovery");
    try { await recoverDispense(key); }
    finally { writeLock.current = false; if (alive.current) setBusy(null); }
  }, [canRecover, recoverDispense, scope]);

  useEffect(() => {
    if (!pendingDispenseKey || confirmedDispense || busy || checkedReference.current === pendingDispenseKey || writeLock.current || !canRecover) return;
    checkedReference.current = pendingDispenseKey;
    void checkDispenseOutcome(pendingDispenseKey);
  }, [pendingDispenseKey, confirmedDispense, busy, canRecover, checkDispenseOutcome]);

  useEffect(() => {
    if (!locationId || !hasAnyPermission(user, "VIEW_EHR") || !capabilities?.actions.viewRxQueue) return;
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
  }, [locationId, fetchData, toast, user, capabilities?.actions.viewRxQueue]);

  async function commit(kind: string, action: () => Promise<unknown>, success: string, close: () => void) {
    if (writeLock.current || !(kind === "batch" ? canReceive : canCatalog) || reading || capabilityError || authScopeKey(useAuthStore.getState().user) !== scope) return;
    writeLock.current = true; setBusy(kind);
    try {
      await action();
      if (!alive.current || authScopeKey(useAuthStore.getState().user) !== scope) return;
      close(); if (kind === "medicine" || kind === "delete") setCounterCatalogueRevision(value => value + 1);
      toast({ title: success, variant: "success" }); await fetchData();
    } catch (error) {
      if (alive.current) toast({ title: "Could not save", description: message(error, "Your changes could not be saved. Check the record before retrying."), variant: "error" });
      if (kind === "dispense" && alive.current) await fetchData();
    } finally { writeLock.current = false; if (alive.current) setBusy(null); }
  }

  function openMedicine(medicine?: Medicine, initialName = "") {
    setEditingMedicine(medicine || null); setMedicineTab("medicine"); setErrors({});
    setMedicineForm(medicine ? { ...blankMedicine(), name: medicine.name, genericName: medicine.genericName, batchNumber: medicine.batchNumber || "", expiryDate: medicine.expiryDate?.slice(0, 10) || "", stockQuantity: String(medicine.stockQuantity), costPrice: medicine.costPrice === undefined ? "" : String(medicine.costPrice), price: String(medicine.price),
      manufacturer: medicine.manufacturer || "", strength: medicine.strength || "", rackLocation: medicine.rackLocation || "", category: medicine.category || "tablet", scheduleType: medicine.scheduleType || "general", barcodes: (medicine.barcodes || []).join(", "), reorderLevel: String(medicine.reorderLevel ?? 20), hsnCode: medicine.hsnCode || "", gstRate: medicine.gstRate === undefined ? "" : String(medicine.gstRate),
      supplyBatch: medicine.billingSupply?.batchNumber || "", supplyExpiry: medicine.billingSupply?.expiry.value || "", supplyPrecision: medicine.billingSupply?.expiry.precision || "month", supplyMrp: medicine.billingSupply ? String(medicine.billingSupply.mrpPaise / 100) : "",
      baseUnit: medicine.unitDefinition?.baseUnit || "", packUnit: medicine.unitDefinition?.packUnit || "", unitsPerPack: medicine.unitDefinition ? String(medicine.unitDefinition.unitsPerPack) : "", outerPackUnit: medicine.unitDefinition?.outerPackUnit || "", packsPerOuter: medicine.unitDefinition?.packsPerOuter ? String(medicine.unitDefinition.packsPerOuter) : "" } : { ...blankMedicine(), name: initialName.slice(0, 200) });
    setMedicineOpen(true);
  }
  function openBatch(medicine: Medicine) {
    if (medicine.unitDefinition) { setReceiptTarget(medicine); return; }
    if (pendingStockReceipt) { toast({ title: "Resolve the pending stock receipt before receiving more stock.", variant: "warning" }); return; }
    setBatchTarget(medicine); setBatchError(""); setBatchForm({ ...blankBatch(), purchaseCost: !canViewCost || medicine.costPrice === undefined ? "" : String(medicine.costPrice), sellingPrice: String(medicine.price) });
  }
  function saveMedicine(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    for (const field of ["name", "genericName"] as const) if (!medicineForm[field].trim()) next[field] = "This field is required.";
    if (medicineForm.expiryDate && !Number.isFinite(new Date(medicineForm.expiryDate).getTime())) next.expiryDate = "Enter a valid date.";
    const quantity = Number(medicineForm.stockQuantity), cost = Number(medicineForm.costPrice), retail = Number(medicineForm.price);
    if (!medicineForm.stockQuantity || !Number.isSafeInteger(quantity) || quantity < 0) next.stockQuantity = "Enter a whole quantity of zero or more.";
    if (canViewCost && medicineForm.costPrice.trim() && (!Number.isFinite(cost) || cost < 0)) next.costPrice = "Enter a non-negative purchase cost.";
    if (!medicineForm.price.trim() || !Number.isFinite(retail) || retail < 0) next.price = "Enter a non-negative retail price.";
    const reorderLevel = Number(medicineForm.reorderLevel), unitsPerPack = Number(medicineForm.unitsPerPack);
    if (!medicineForm.reorderLevel.trim() || !Number.isSafeInteger(reorderLevel) || reorderLevel < 0) next.reorderLevel = "Enter a non-negative whole reorder level.";
    if ((!editingMedicine || medicineForm.baseUnit) && (!medicineForm.baseUnit || !medicineForm.packUnit || !Number.isSafeInteger(unitsPerPack) || unitsPerPack < 1 || unitsPerPack > 1_000_000)) next.unitsPerPack = "Choose base and pack units with 1 to 1,000,000 base units per pack.";
    const packsPerOuter = Number(medicineForm.packsPerOuter);
    if ((medicineForm.outerPackUnit || medicineForm.packsPerOuter) && (!medicineForm.outerPackUnit || medicineForm.outerPackUnit === medicineForm.packUnit || medicineForm.outerPackUnit === medicineForm.baseUnit || !Number.isSafeInteger(packsPerOuter) || packsPerOuter < 2 || packsPerOuter * unitsPerPack > 1000000)) next.unitsPerPack = "Record a distinct outer pack with at least two inner packs and at most 1,000,000 base units.";
    const barcodes = medicineForm.barcodes.split(",").map(value => value.trim()).filter(Boolean);
    if (barcodes.length > 20 || new Set(barcodes).size !== barcodes.length || barcodes.some(value => !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/.test(value))) next.barcodes = "Enter up to 20 distinct barcode aliases separated by commas.";
    if (medicineForm.hsnCode && !/^\d{4}(\d{2})?(\d{2})?$/.test(medicineForm.hsnCode)) next.hsnCode = "Enter a 4, 6 or 8 digit HSN code.";
    if (medicineForm.gstRate.trim() && (!Number.isFinite(Number(medicineForm.gstRate)) || Number(medicineForm.gstRate) < 0 || Number(medicineForm.gstRate) > 100)) next.gstRate = "Enter a tax rate from 0 to 100.";
    if (!locationId && !editingMedicine) next.name = "Choose a location before adding medicine.";
    const hasSupply = capabilities?.inventoryMode === "billing_only" || Boolean(medicineForm.supplyBatch || medicineForm.supplyExpiry || medicineForm.supplyMrp);
    const mrpPaise = parseReceiptPaise(medicineForm.supplyMrp);
    if (hasSupply && (!medicineForm.supplyBatch.trim() || !medicineForm.supplyExpiry || mrpPaise === null || mrpPaise < Math.round(retail * 100))) next.supplyMrp = "Record the actual batch, printed expiry and MRP per base unit, at least the selling price.";
    setErrors(next);
    if (Object.keys(next).length) { setMedicineTab(next.name || next.genericName || next.batchNumber || next.expiryDate ? "medicine" : next.unitsPerPack || next.barcodes || next.hsnCode || next.gstRate ? "units" : "stock"); return; }
    const payload = { name: medicineForm.name.trim(), genericName: medicineForm.genericName.trim(), ...(medicineForm.batchNumber ? { batchNumber: medicineForm.batchNumber.trim() } : {}), ...(medicineForm.expiryDate ? { expiryDate: medicineForm.expiryDate } : {}),
      stockQuantity: quantity, ...(canViewCost && medicineForm.costPrice.trim() ? { costPrice: cost } : {}), price: retail, locationId: editingMedicine?.locationId || locationId,
      manufacturer: medicineForm.manufacturer.trim(), strength: medicineForm.strength.trim(), rackLocation: medicineForm.rackLocation.trim(), category: medicineForm.category, scheduleType: medicineForm.scheduleType, reorderLevel, barcodes,
      ...(hasSupply ? { billingSupply: { batchNumber: medicineForm.supplyBatch.trim(), expiry: { precision: medicineForm.supplyPrecision, value: medicineForm.supplyExpiry }, mrpPaise } } : {}),
      ...(medicineForm.hsnCode ? { hsnCode: medicineForm.hsnCode } : {}), ...(medicineForm.gstRate.trim() ? { gstRate: Number(medicineForm.gstRate) } : {}),
      ...(medicineForm.baseUnit ? { unitDefinition: { baseUnit: medicineForm.baseUnit, packUnit: medicineForm.packUnit, unitsPerPack, ...(medicineForm.outerPackUnit ? { outerPackUnit: medicineForm.outerPackUnit, packsPerOuter } : {}) }, ...(editingMedicine ? { expectedUnitVersion: editingMedicine.unitDefinition?.version ?? 0 } : {}) } : {}) };
    void commit("medicine", () => editingMedicine ? api.put(`/medicines/${editingMedicine.id}`, payload) : api.post("/medicines", payload), editingMedicine ? "Medicine updated" : "Medicine added", () => setMedicineOpen(false));
  }
  function saveBatch(event: React.FormEvent) {
    event.preventDefault(); if (!batchTarget || pendingStockReceipt) return;
    const quantity = Number(batchForm.quantity), cost = Number(batchForm.purchaseCost), price = Number(batchForm.sellingPrice);
    if (batchForm.unlinkedInwardReason.trim().length < 3 || !batchForm.batchNumber.trim() || !Number.isFinite(new Date(batchForm.expiryDate).getTime()) || !Number.isSafeInteger(quantity) || quantity <= 0 || !batchForm.purchaseCost || !batchForm.sellingPrice || !Number.isFinite(cost) || !Number.isFinite(price) || cost < 0 || price < 0) { setBatchError("Enter a batch number, valid expiry date, whole quantity, non-negative prices and an unlinked inward reason."); return; }
    void commit("batch", () => api.post("/pharmacy/batches", { medicineId: batchTarget.id, locationId: batchTarget.locationId, unlinkedInwardReason: batchForm.unlinkedInwardReason.trim(), batchNumber: batchForm.batchNumber.trim(), expiryDate: batchForm.expiryDate, quantity, purchaseCost: cost, sellingPrice: price }), "Batch stock added", () => setBatchTarget(null));
  }
  async function openDispense(group: PendingPrescription) {
    if (readDispenseReference(referenceScope)) return;
    setPrescription(group);
    // Do not infer quantities or substitute a similarly named formulation.
    setSelections(group.prescriptions.map(rx => ({ medicineId: medicines.find(medicine => medicine.id === rx.medicineId && medicine.stockQuantity > 0)?.id || "", quantity: 0 })));
    setSelectionStock(medicines.filter(medicine => group.prescriptions.some(rx => rx.medicineId === medicine.id)));
    setStockLookupError("");
    const request = beginStockLookup();
    const ids = [...new Set(group.prescriptions.map(rx => rx.medicineId).filter((id): id is string => Boolean(id)))].slice(0, 100);
    if (!ids.length) { setStockLookupBusy(false); return; }
    setStockLookupBusy(true);
    try {
      const result = await readMedicinePage(locationId, request.signal, { medicineIds: ids });
      if (request.isCurrent() && alive.current) {
        setSelectionStock(result.items);
        setSelections(group.prescriptions.map(rx => ({ medicineId: result.items.find(medicine => medicine.id === rx.medicineId && medicine.stockQuantity > 0)?.id || "", quantity: 0 })));
      }
    } catch { if (request.isCurrent()) setStockLookupError("Prescribed stock could not be loaded. Reopen this prescription to retry."); }
    finally { if (request.isCurrent()) setStockLookupBusy(false); }
  }
  const stockOptions = [...new Map([...selectionStock, ...medicines].map(medicine => [medicine.id, medicine])).values()];
  function selectStock(index: number, medicineId: string) {
    const next = selections.map((item, position) => position === index ? { ...item, medicineId } : item);
    setSelections(next); setSelectionStock(stockOptions.filter(medicine => next.some(item => item.medicineId === medicine.id)));
  }
  const prepared = prepareDispense(prescription?.prescriptions || [], selections, stockOptions, locationId);
  const currentPrescriptions = pending.find(group => group.encounterId === prescription?.encounterId)?.prescriptions || [];
  const prescriptionChanged = Boolean(prescription && prepared.prescriptionIds?.some(id => !currentPrescriptions.some(item => item.id === id)));
  const estimatedTotal = selections.reduce((total, item) => total + (stockOptions.find(medicine => medicine.id === item.medicineId)?.price || 0) * (Number.isFinite(item.quantity) ? item.quantity : 0), 0);
  function dispense(event: React.FormEvent) {
    event.preventDefault(); if (pendingDispenseKey || !prescription || prepared.error || prescriptionChanged || !locationId || catalogError || pendingError || reading || stockLookupBusy || stockLookupError || query !== search.trim()) return;
    const payload = { patientId: prescription.patientId.id, doctorId: prescription.doctorId.id, locationId, items: prepared.items, prescriptionIds: prepared.prescriptionIds, prescriptionAllocations: prepared.prescriptionAllocations,
      ...(/^[a-f\d]{24}$/i.test(prescription.encounterId) ? { encounterId: prescription.encounterId } : {}),
      ...(prescription.appointmentId && /^[a-f\d]{24}$/i.test(prescription.appointmentId) ? { appointmentId: prescription.appointmentId } : {}) };
    void sendDispense(payload as DispensePayload);
  }

  async function sendDispense(payload: DispensePayload, retryKey?: string) {
    if (writeLock.current || (!canManage && !(retryKey && canRecover)) || capabilityError || authScopeKey(useAuthStore.getState().user) !== scope) return;
    writeLock.current = true; setBusy("dispense");
    let key = retryKey;
    try {
      key = key || await reserveDispenseReference(referenceScope);
      if (!alive.current || authScopeKey(useAuthStore.getState().user) !== scope) {
        if (!retryKey) acknowledgeDispenseReference(referenceScope, key);
        return;
      }
      if (retryKey && (pendingDraft.current?.key !== retryKey || readDispenseReference(referenceScope) !== retryKey)) return;
      const pinnedPayload = retryKey ? pendingDraft.current!.payload : JSON.parse(JSON.stringify(payload)) as DispensePayload;
      pendingDraft.current = { key, payload: pinnedPayload };
      setRetryDraftKey(key);
      checkedReference.current = key;
      const result = await submitPharmacyDispense(pinnedPayload, key);
      await acceptDispenseResult(result, key);
    } catch (error) {
      if (alive.current && authScopeKey(useAuthStore.getState().user) === scope) {
        toast({ title: key ? "Dispense outcome not confirmed" : "Dispense not submitted", description: message(error, key ? "Keep the same reference while checking the outcome." : "The dispense reference could not be retained. Check browser storage before trying again."), variant: "warning" });
        if (key) await recoverDispense(key);
      }
    } finally { writeLock.current = false; if (alive.current) setBusy(null); }
  }

  function acknowledgeDispense() {
    if (!confirmedDispense || !pendingDispenseKey || busy) return;
    try {
      acknowledgeDispenseReference(referenceScope, pendingDispenseKey);
      pendingDraft.current = null; setRetryDraftKey(null); checkedReference.current = null; setDispenseResult(null);
    } catch { toast({ title: "Could not acknowledge dispense", description: "The reference could not be cleared. Check it again before continuing.", variant: "error" }); }
  }
  const actionable = Boolean(capabilities) && !capabilityError && catalogLoaded && !catalogError && !busy && !reading && query === search.trim();
  const selectedLocation = locations.find(location => location.id === locationId);
  // Matching and stock filters belong to the server's bounded page. Repeating a
  // substring match here hides valid multi-token, normalized and salt matches.
  const filteredMedicines = medicines;
  const filteredPending = pending.filter(group => `${group.patientId.name} ${group.patientId.phone || ""} ${group.tokenNumber || ""} ${group.prescriptions.map(rx => rx.name).join(" ")}`.toLowerCase().includes(dispenseSearch.trim().toLowerCase().replace(/^#/, "")));
  const canReviewProducts = hasAnyPermission(user, "MANAGE_ORGANIZATION") && Boolean(capabilities?.moduleEnabled && capabilities.actions.viewStock);
  const stockActions = (medicine: Medicine) => (canCatalog || canReceive || canReviewProducts || capabilities?.actions.viewStock) && <Dropdown align="right" trigger={<Button variant="ghost" size="sm" className={styles.icon} aria-label={`Actions for ${medicine.name}`} disabled={!actionable}><MoreHorizontal size={18} /></Button>} items={[
    ...(capabilities?.inventoryMode !== "billing_only" ? [{ label: "Batches, counts & history", icon: <ClipboardCheck size={16} />, onClick: () => setStockTarget(medicine.id) }] : []),
    { label: "Compare medicine brands", icon: <Search size={16} />, onClick: () => setComparisonTarget(medicine.id) },
    ...(canReceive ? [{ label: "Add batch", icon: <Plus size={16} />, onClick: () => openBatch(medicine) }] : []),
    ...(canReviewProducts ? [{ label: "Review product", icon: <ClipboardCheck size={16} />, onClick: () => setReviewTarget(medicine.id) }] : []),
    ...(canReviewProducts ? [{ label: "Product / batch sale holds", icon: <ClipboardCheck size={16} />, onClick: () => setSaleControlTarget(medicine.id) }] : []),
    ...(canCatalog ? [{ label: "Edit medicine", icon: <Edit3 size={16} />, onClick: () => openMedicine(medicine) },
      { label: "Archive medicine", icon: <Trash2 size={16} />, variant: "danger" as const, onClick: () => setDeleting(medicine) }] : []),
  ]} />;
  const medicineIdentity = (medicine: Medicine) => <div className={styles.identity}><strong>{medicine.name}</strong>{medicine.saleControl?.blocked && <Badge variant="warning">Sale hold</Badge>}<small>{[medicine.genericName, medicine.strength, medicine.manufacturer, medicine.rackLocation ? `Rack ${medicine.rackLocation}` : ""].filter(Boolean).join(" · ")}</small>{medicine.unitDefinition && <small>1 {medicine.unitDefinition.packUnit} = {medicine.unitDefinition.unitsPerPack} {medicine.unitDefinition.baseUnit}</small>}</div>;
  const quantity = (medicine: Medicine) => capabilities?.inventoryMode === "billing_only" ? <span>Not tracked</span> : <span className={medicine.stockQuantity === 0 || lowStock(medicine) ? styles.danger : ""}>{medicine.stockQuantity} {medicine.stockQuantity === 0 ? "(out of stock)" : lowStock(medicine) ? "(low)" : ""}</span>;
  const reviewOrganizationId = capabilities?.organizationId || user?.organization_id || "";
  const canProfessionalReview = Boolean(reviewOrganizationId && capabilities?.moduleEnabled && hasAnyPermission(user, "MANAGE_ORGANIZATION"));
  const canFinance = Boolean(capabilities?.actions.viewSettlements || capabilities?.actions.viewPurchases && capabilities.actions.processReturn);
  const activeView = (activeTab === "staff-guide" ? true : activeTab === "alerts" && capabilities?.inventoryMode === "billing_only" ? false : activeTab === "professional-reviews" ? canProfessionalReview : activeTab === "files" ? capabilities?.actions.readFiles : activeTab === "register" ? capabilities?.actions.readRegister : activeTab === "external-prescriptions" ? capabilities?.actions.viewExternalPrescriptions : activeTab === "transfers" ? capabilities?.actions.transferStock && capabilities?.actions.viewCost : ["reports", "daily"].includes(activeTab) ? capabilities?.actions.viewReports : activeTab === "till" ? capabilities?.actions.viewTill : activeTab === "finance" ? canFinance : activeTab === "returns" ? capabilities?.actions.viewReturns : activeTab === "counter" ? capabilities?.actions.sell : activeTab === "pickups" || activeTab === "sales" ? capabilities?.actions.viewSales : activeTab === "purchases" ? capabilities?.actions.viewPurchases : activeTab === "dispensing" ? capabilities?.actions.viewRxQueue : capabilities?.actions.viewStock) ? activeTab : capabilities?.actions.viewStock ? "inventory" : capabilities?.actions.viewExternalPrescriptions ? "external-prescriptions" : capabilities?.actions.viewRxQueue ? "dispensing" : capabilities?.actions.viewPurchases ? "purchases" : capabilities?.actions.sell ? "counter" : capabilities?.actions.viewSales ? "sales" : capabilities?.actions.viewReturns ? "returns" : canFinance ? "finance" : capabilities?.actions.viewTill ? "till" : capabilities?.actions.viewReports ? "reports" : capabilities?.actions.readRegister ? "register" : capabilities?.actions.readFiles ? "files" : "transfers";
  const compactWorkspace = user?.workspaceProfile === "pharmacy" || counterOnly;
  const compactCounter = compactWorkspace && activeView === "counter";
  const locationContext = (<div className={styles.context}>{locations.length > 1 ? <Select aria-label="Pharmacy location" value={locationId} disabled={Boolean(busy)} onChange={event => onLocationChange(event.target.value)} options={[{ value: "", label: "Choose location" }, ...locations.map(location => ({ value: location.id, label: location.name }))]} /> : <><Building2 size={15} /><p>{selectedLocation?.name || (locationsLoading ? "Loading locations..." : "No location available")}</p></>}</div>);
  const refreshAction = <Button variant="ghost" size="sm" aria-label="Refresh pharmacy" className={styles.icon} disabled={reading || Boolean(busy)} onClick={fetchData}><RotateCw size={17} className={reading ? "animate-spin" : ""} /></Button>;
  const showStockTools = user?.workspaceProfile !== "pharmacy" || ["inventory", "alerts"].includes(activeView);
  const stockTools = <>
    {showStockTools && Boolean(capabilities?.importKinds?.length) && <Button size="sm" variant="outline" aria-label="Import source CSV" disabled={!locationId} onClick={() => setImportOpen(true)}><Upload size={16} aria-hidden="true" /><span className="sm:hidden">Import</span><span className="hidden sm:inline">Import source CSV</span></Button>}
    {showStockTools && canCreate && <Button size="sm" disabled={!locationId || !actionable || reading} onClick={() => openMedicine()}><Plus size={16} aria-hidden="true" />Add medicine</Button>}
    {showStockTools && canCreate && <Button size="sm" variant="outline" disabled={!locationId || !actionable || reading} onClick={() => setCatalogueOpen(true)}>Find in catalogue</Button>}
  </>;
  const inventory = <div className={styles.list}>
    {compactWorkspace && <div className={styles.actions}>{stockTools}</div>}
    <section className={styles.panel} aria-label="Medicine inventory" aria-busy={reading || query !== search.trim()}>
      <div className={styles.toolbar}><Input type="search" maxLength={100} icon={<Search size={16} />} aria-label="Search medicines" placeholder="Name, composition, manufacturer or barcode" value={search} onChange={event => setSearch(event.target.value)} /><Select aria-label="Filter inventory" value={filter} onChange={event => { setFilter(event.target.value); setCatalogPage(1); }} options={capabilities?.inventoryMode === "billing_only" ? [{ value: "all", label: "Catalogue" }] : [{ value: "all", label: "All stock" }, { value: "low", label: "Low physical stock" }, { value: "out", label: "Zero physical stock" }, { value: "expired", label: "Catalog expired" }]} /></div>
      {user?.workspaceProfile === "pharmacy" && catalogLoaded && !catalogError ? <div className="px-4 sm:px-5">
        <h2 className="py-4 text-sm font-semibold">Inventory <span className="ml-2 text-xs font-normal text-text-secondary">{capabilities?.inventoryMode === "billing_only" ? "Stock not tracked" : "Physical stock in base units"}</span></h2>
        <div className="divide-y divide-border">{filteredMedicines.map(medicine => <article key={medicine.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 py-4">
          <div className="min-w-0">{medicineIdentity(medicine)}</div>
          <div className="row-span-2 flex items-start gap-2"><div className="shrink-0 space-y-1 text-right"><p className="text-sm font-semibold tabular-nums">{capabilities?.inventoryMode === "billing_only" ? "Not tracked" : medicine.stockQuantity}</p>{capabilities?.inventoryMode !== "billing_only" && <Badge variant={medicine.stockQuantity === 0 ? "danger" : lowStock(medicine) ? "warning" : "success"}>{medicine.stockQuantity === 0 ? "Out of stock" : lowStock(medicine) ? "Low stock" : "In stock"}</Badge>}</div>{stockActions(medicine)}</div>
          <p className="col-span-2 text-xs leading-relaxed text-text-secondary sm:col-span-1">Catalogue batch: {medicine.batchNumber || "Not recorded"} | Catalogue expiry: {dateLabel(medicine.expiryDate)} | Default price {money(medicine.price)}</p>
        </article>)}</div>
        {!filteredMedicines.length && <p className="py-8 text-center text-sm text-text-secondary">{search || filter !== "all" ? "No medicines match these filters." : "No medicines yet. Add medicine to start your inventory."}</p>}
      </div> : <Table<Medicine> variant="flat" density="compact" fitContent searchable={false} showColumnVisibility={false} loading={reading && !catalogLoaded} error={catalogError} onRetry={fetchData} data={filteredMedicines} pagination={false} columns={[
        { key: "name", header: "Medicine", render: medicineIdentity }, { key: "batchNumber", header: "Catalog batch" },
        { key: "stockQuantity", header: "Physical stock", render: quantity }, { key: "expiryDate", header: "Catalog expiry", render: medicine => <span className={expired(medicine.expiryDate) ? styles.danger : ""}>{dateLabel(medicine.expiryDate)}</span> },
        { key: "price", header: "Default price", render: medicine => money(medicine.price) }, { key: "actions", header: "", align: "right", render: stockActions },
      ]} renderMobileCard={medicine => <article className={styles.card}><div className={styles.rowHeading}>{medicineIdentity(medicine)}{stockActions(medicine)}</div><div className={styles.meta}><span>Batch {medicine.batchNumber || "Not recorded"}</span></div><dl className={styles.cardFacts}><div><dt>Physical stock</dt><dd>{quantity(medicine)}</dd></div><div><dt>Default price</dt><dd>{money(medicine.price)}</dd></div><div><dt>Catalog expiry</dt><dd className={expired(medicine.expiryDate) ? styles.danger : ""}>{dateLabel(medicine.expiryDate)}</dd></div></dl></article>} emptyMessage={search || filter !== "all" ? "No medicines match these filters." : "No medicines yet. Add medicine to start your inventory."} />}
      {catalogLoaded && <div className={styles.toolbar}><p className={styles.count}>{filteredMedicines.length} medicines shown{catalogTotal === null ? "" : ` of ${catalogTotal}`}</p>{catalogPages > 1 && <div className={styles.actions}><Button size="sm" variant="outline" aria-label="Previous medicine page" disabled={catalogPage <= 1 || reading || Boolean(busy)} onClick={() => setCatalogPage(page => page - 1)}>Previous</Button><span>Page {catalogPage} of {catalogPages}</span><Button size="sm" variant="outline" aria-label="Next medicine page" disabled={catalogPage >= catalogPages || reading || Boolean(busy)} onClick={() => setCatalogPage(page => page + 1)}>Next</Button></div>}</div>}
    </section>
    {catalogLoaded && medicines.length > 0 && <details className={styles.details} onToggle={event => setShowHealth(event.currentTarget.open)}><summary>Stock on this page</summary>{showHealth && <ChartContainer title="Stock on this page" description="This overview covers the current page; Alerts lists batch expiry dates." height={180}><DonutChart height={180} data={[{ name: "In stock", value: medicines.filter(m => !lowStock(m)).length, color: "var(--chart-2)" }, { name: "Low stock", value: medicines.filter(m => lowStock(m) && m.stockQuantity > 0).length, color: "var(--chart-3)" }, { name: "Out of stock", value: medicines.filter(m => m.stockQuantity === 0).length, color: "var(--danger)" }].filter(value => value.value > 0)} /></ChartContainer>}</details>}
  </div>;
  const dispensing = !locationId ? <p className={styles.empty}>Choose a location to view and dispense prescriptions.</p> : <section className={styles.panel} aria-label="Pending prescriptions">
    <div className={`${styles.toolbar} ${styles.toolbarSingle}`}><Input type="search" aria-label="Search prescriptions" icon={<Search size={16} />} placeholder="Patient, phone, token or medicine" value={dispenseSearch} onChange={event => setDispenseSearch(event.target.value)} /></div>
    <Table<PendingPrescription> variant="flat" density="compact" fitContent searchable={false} showColumnVisibility={false} keyField="encounterId" loading={reading && !pendingLoaded} error={pendingError} onRetry={fetchData} data={filteredPending} pagination={filteredPending.length > 10} columns={[
      { key: "patient", header: "Patient", render: group => <div className={styles.identity}><strong>{group.patientId.name} {group.tokenNumber ? <Badge variant="primary">#{group.tokenNumber}</Badge> : null}</strong><small>{group.patientId.phone}</small></div> },
      { key: "doctor", header: "Doctor / visit", render: group => <div className={styles.identity}><span>{group.doctorId?.name}</span><small>{dateLabel(group.appointmentTime || "")}</small></div> },
      { key: "prescriptions", header: "Prescribed", render: group => <div className={styles.identity}><span>{group.prescriptions.length} items</span><small>{group.prescriptions.map(rx => rx.name).join(", ")}</small></div> },
      { key: "action", header: "", align: "right", render: group => canManage && <Button size="sm" disabled={!actionable || reading || Boolean(pendingError) || Boolean(pendingDispenseKey)} onClick={() => openDispense(group)}>Dispense</Button> },
    ]} renderMobileCard={group => <article className={styles.card}><div className={styles.rowHeading}><div className={styles.identity}><strong>{group.patientId.name}</strong>{group.patientId.phone && <a href={`tel:${group.patientId.phone}`} className={styles.meta}><Phone size={12} />{group.patientId.phone}</a>}</div>{group.tokenNumber ? <Badge variant="primary">#{group.tokenNumber}</Badge> : null}</div><div className={styles.meta}><span>{group.doctorId?.name}</span><span>{dateLabel(group.appointmentTime || "")}</span></div><p className={styles.meta}>{group.prescriptions.length} prescribed: {group.prescriptions.map(rx => rx.name).join(", ")}</p>{canManage && <Button size="sm" disabled={!actionable || reading || Boolean(pendingError) || Boolean(pendingDispenseKey)} onClick={() => openDispense(group)}>Dispense</Button>}</article>} emptyMessage={dispenseSearch ? "No prescriptions match this search." : "No prescriptions awaiting dispensing."} />
  </section>;

  if (locationId && !capabilities && !capabilityError) return <PharmacySkeleton counter={user?.workspaceProfile === "pharmacy" || counterOnly} />;
  return <div className={styles.workspace} data-counter-layout={compactCounter || undefined}>
    {compactWorkspace ? <h1 className="sr-only">{compactCounter || counterOnly ? "Counter sales" : "Pharmacy"}</h1> : <div className={styles.workspaceHeading}>
    <header className={styles.header}>
      <div><h1>{counterOnly ? "Counter sales" : "Pharmacy"}</h1><p>{counterOnly ? "Create bills, collect payments and manage your cash drawer" : "Sales, inventory and branch records"}</p></div>
      <div className={styles.actions}>
        <Button variant="ghost" size="sm" aria-label="Refresh pharmacy" className={styles.icon} disabled={reading || Boolean(busy)} onClick={fetchData}><RotateCw size={17} className={reading ? "animate-spin" : ""} /></Button>
        {stockTools}
      </div>
    </header>
    {locationContext}
    </div>}
    <Modal open={importOpen && Boolean(capabilities?.importKinds?.length)} onClose={() => setImportOpen(false)} title="Reviewed pharmacy import" size="lg" bodyClassName={styles.dialog}>
      {importOpen && capabilities?.importKinds?.length && <PharmacyImports locationId={locationId} allowedKinds={capabilities.importKinds} onCommitted={() => { void fetchData(); }} />}
    </Modal>
    {catalogueOpen && canCreate && locationId && <PharmacyCatalogueDiscovery inventoryMode={capabilities?.inventoryMode || "tracked"} locationId={locationId} onClose={() => setCatalogueOpen(false)} onAdded={() => { setCatalogueOpen(false); void fetchData(); }} onCreateLocal={() => { setCatalogueOpen(false); openMedicine(); }} onImportLocal={capabilities?.importKinds?.includes("catalogue") ? () => { setCatalogueOpen(false); setImportOpen(true); } : undefined} />}
    {locationError && <Alert variant="error" title="Locations could not be loaded" action={<Button size="sm" variant="outline" onClick={onRetryLocations}>Retry locations</Button>}>{locationError}</Alert>}
    {capabilityError && <Alert variant="error" title="Pharmacy access unavailable" action={<Button size="sm" variant="outline" onClick={fetchData}>Retry access check</Button>}>{capabilityError}</Alert>}
    {capabilities && user?.workspaceProfile === "pharmacy" && user.role === "pharmacist" && !hasAnyPermission(user, "PHARMACY_SELL", "MANAGE_ORGANIZATION") && <Alert variant="info" title="Counter sales access is not assigned">Your current role provides inventory access. Ask the owner to assign a counter sales role in Roles & permissions if you work at the sales counter.</Alert>}
    {capabilities && !capabilities.enabled && <Alert variant="warning" title="Pharmacy is disabled here">Authorized stock and history remain available. New stock changes and prescription supply are disabled.</Alert>}
    {capabilities && !capabilities.moduleEnabled && <Alert variant="warning" title="Pharmacy module disabled">Contact your organization administrator about module availability.</Alert>}
    {capabilities?.commercialEntitlement === "unavailable" && <Alert variant="warning" title="Pharmacy product unavailable">An active pharmacy product at this branch is required for new sales and stock receipts. Authorized records, recovery, collections, returns and reports remain available. Contact your organization administrator to review the subscription.</Alert>}
    <PharmacyStockReceipts medicine={receiptTarget} locationId={locationId} canReceive={canReceive} canRecover={Boolean(capabilities?.actions.readMovements)} onClose={() => setReceiptTarget(null)} onCommitted={() => { void fetchData(); }} />
    {reviewTarget && canReviewProducts && <PharmacyProductReview medicineId={reviewTarget} locationId={locationId} onClose={() => setReviewTarget(null)} onReviewed={() => { void fetchData(); }} />}
    {comparisonTarget && capabilities?.actions.viewStock && <PharmacyAlternatives key={`${scope}:${locationId}:${comparisonTarget}`} medicineId={comparisonTarget} locationId={locationId} onClose={() => setComparisonTarget(null)} />}
    {stockTarget && capabilities?.actions.viewStock && <PharmacyProductStockTools key={`${scope}:${locationId}:${stockTarget}:${Boolean(capabilities.actions.viewCost)}`} medicineId={stockTarget} locationId={locationId} canAdjust={Boolean(capabilities?.actions.adjustStock && actionable)} canReadMovements={Boolean(capabilities?.actions.readMovements)} onClose={() => setStockTarget(null)} onChanged={() => { void fetchData(); }} />}
    {saleControlTarget && canReviewProducts && <PharmacySaleControls medicineId={saleControlTarget} locationId={locationId} onClose={() => setSaleControlTarget(null)} onChanged={() => { void fetchData(); }} />}
    {!locationId && !locationError && <p className={styles.empty}>{locations.length ? "Choose a location to view pharmacy records." : "No locations are assigned to your account. Ask your administrator to assign your pharmacy branch."}</p>}
    {canRecover && pendingDispenseKey && (confirmedDispense ? <Alert variant="success" title="Dispense confirmed" action={<Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={acknowledgeDispense}>Done</Button>}>
      Invoice <strong>{confirmedDispense.dispenseOperation.invoiceNumber}</strong>. Added {money(confirmedDispense.dispenseOperation.addedAmount)}{confirmedDispense.dispenseOperation.appendedToExisting ? " to the existing bill" : " to a new bill"}. Total at posting: {money(confirmedDispense.totalAmount)}.
      <PharmacyDocumentButton invoice={confirmedDispense} />
    </Alert> : <Alert variant="warning" title="Pending dispense outcome" action={<div className={styles.actions}>
      <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => { void checkDispenseOutcome(pendingDispenseKey); }}>Check outcome</Button>
      {retryDraftKey === pendingDispenseKey && <Button size="sm" disabled={Boolean(busy)} onClick={() => { if (pendingDraft.current) void sendDispense(pendingDraft.current.payload, pendingDispenseKey); }}>Retry same dispense</Button>}
    </div>}><p>{recoveryMessage || "Checking the existing dispense before allowing another bill."}</p><p className={styles.reference}>Reference: {pendingDispenseKey}</p></Alert>)}
    {catalogError && activeTab === "dispensing" && <Alert variant="error" title="Inventory unavailable" action={<Button size="sm" variant="outline" onClick={fetchData}>Retry inventory</Button>}>{catalogError}</Alert>}

    {locationId && capabilities && <PharmacyNavigation toolbarContext={compactWorkspace && activeView !== "counter" ? locationContext : undefined} toolbarActions={compactWorkspace && activeView !== "counter" ? refreshAction : undefined} compact={compactWorkspace} className={styles.tabs} variant="pills" activeTab={activeView} onChange={tab => { if (tab === "professional-reviews" && activeView !== tab) professionalReturnTab.current = activeView; setActiveTab(tab); }} scrollActiveIntoView={false} tabs={[
      { id: "inventory", label: capabilities.inventoryMode === "billing_only" ? "Catalogue" : "Inventory", badge: catalogLoaded ? catalogTotal ?? medicines.length : undefined, content: inventory },
      { id: "dispensing", label: "Dispense", badge: locationId && pendingLoaded ? pending.length : undefined, content: dispensing },
      { id: "alerts", label: "Alerts", content: <>{compactWorkspace && <div className={styles.actions}>{stockTools}</div>}<PharmacyAlertsCenter locationId={locationId} medicines={medicines} canManage={canReceive && actionable} onOpenAddBatch={openBatch} refreshKey={dataRevision} onShortbook={capabilities?.actions.managePurchases ? medicine => { if (medicine.unitDefinition) { setShortbookProduct({ ...medicine, unitDefinition: medicine.unitDefinition }); setActiveTab("purchases"); } } : undefined} onSupplierReturn={capabilities?.actions.viewPurchases && capabilities.actions.processReturn ? source => { setSupplierReturnTarget(source); setActiveTab("finance"); } : undefined} /></> },
      { id: "purchases", label: "Purchases", content: <PharmacyPurchases initialShortbookProduct={shortbookProduct} locationId={locationId} canViewCost={Boolean(capabilities?.actions.viewCost)} canManage={Boolean(capabilities?.actions.managePurchases)} canReceive={Boolean(capabilities?.actions.receiveStock)} /> },
      { id: "counter", label: "Counter sale", content: <PharmacyCounter onViewHistory={capabilities?.actions.viewSales ? () => setActiveTab("sales") : undefined} toolbarContext={compactWorkspace && locations.length > 1 ? locationContext : undefined} toolbarActions={compactWorkspace ? refreshAction : undefined} initialPickup={pickupDraft} onPickupPrepared={() => { setPickupDraft(null); setActiveTab("pickups"); }} compact={user?.workspaceProfile === "pharmacy" || counterOnly} locationId={locationId} inventoryMode={capabilities?.inventoryMode || "tracked"} canCollect={Boolean(capabilities?.actions.collect)} canOpenTill={Boolean(capabilities?.actions.openTill)} canManageCatalog={canCatalog} canReviewProducts={canReviewProducts} onCreateLocal={canCatalog ? name => openMedicine(undefined, name) : undefined} catalogueEditorOpen={medicineOpen} catalogueRevision={counterCatalogueRevision} onProductReviewed={() => { void fetchData(); }} /> },
      { id: "returns", label: "Returns", content: <PharmacyReturns initialInvoiceId={returnInvoice || undefined} locationId={locationId} canProcess={Boolean(capabilities?.actions.processReturn)} canApprove={Boolean(capabilities?.actions.approveReturn)} /> },
      { id: "daily", label: "Daily overview", content: <PharmacyDailyOverview locationId={locationId} canViewStock={Boolean(capabilities?.actions.viewStock && capabilities?.inventoryMode !== "billing_only")} canViewDrawer={Boolean(capabilities?.actions.viewTill)} onStock={() => setActiveTab("alerts")} onDrawer={() => setActiveTab("till")} onReport={(kind, date) => { setReportSeed({ kind, date }); setActiveTab("reports"); }} /> },
      { id: "reports", label: "Reports & exports", content: <PharmacyReports locationId={locationId} initial={reportSeed} /> },
      { id: "till", label: "Cash drawer", content: <PharmacyTill locationId={locationId} canOpen={Boolean(capabilities?.actions.openTill)} canClose={Boolean(capabilities?.actions.closeTill)} canMove={Boolean(capabilities?.actions.moveTillCash)} compact={user?.workspaceProfile === "pharmacy" || counterOnly} /> },
      { id: "finance", label: "Finance & dues", content: <PharmacyFinance initialReturn={supplierReturnTarget} locationId={locationId} canViewSuppliers={Boolean(capabilities?.actions.viewPurchases)} canViewCustomers={Boolean(capabilities?.actions.viewReturns)} canSettle={Boolean(capabilities?.actions.settle)} canReturn={Boolean(capabilities?.actions.processReturn)} canCollect={Boolean(capabilities?.actions.collect)} canViewSales={Boolean(capabilities?.actions.viewSales)} canOpening={Boolean(capabilities?.actions.openingBalances)} /> },
      { id: "transfers", label: "Stock transfers", content: <PharmacyTransfers locationId={locationId} locations={locations} canStart={Boolean(capabilities?.enabled && capabilities.commercialEntitlement !== "unavailable")} /> },
      { id: "professional-reviews", label: "Pharmacist registrations", content: <PharmacyProfessionalReview key={`${reviewOrganizationId}:${locationId}`} organizationId={reviewOrganizationId} locationId={locationId} onClose={() => setActiveTab(professionalReturnTab.current)} /> },
      { id: "files", label: "Prescription files", content: locationId && capabilities?.actions.readFiles ? <PharmacyFileHistory locationId={locationId} canManage={Boolean(capabilities.actions.manageRecords)} /> : null },
      { id: "register", label: "Prescription registers", content: <PharmacyRegister locationId={locationId} canExport={Boolean(capabilities.actions.exportRegister)} /> },
      { id: "external-prescriptions", label: "Outside prescriptions", content: <PharmacyExternalPrescriptions locationId={locationId} inventoryMode={capabilities.inventoryMode || "tracked"} canSupply={Boolean(capabilities.actions.externalDispense)} canSell={Boolean(capabilities.actions.sell)} canCollect={Boolean(capabilities.actions.collect)} canOpenTill={Boolean(capabilities.actions.openTill)} canViewSales={Boolean(capabilities.actions.viewSales)} /> },
      { id: "pickups", label: "Medicine pickups", content: <PharmacyPickups onPrepare={row => { setPickupDraft(row); setActiveTab("counter"); }} onResolveBill={capabilities?.actions.viewReturns ? id => { setReturnInvoice(id); setActiveTab("returns"); } : undefined} locationId={locationId} canPrepare={Boolean(capabilities?.actions.sell)} canCollect={Boolean(capabilities?.actions.collect)} canOpenTill={Boolean(capabilities?.actions.openTill)} /> },
      { id: "sales", label: "Sales & collections", content: <PharmacyCollections locationId={locationId} canCollect={Boolean(capabilities?.actions.collect)} canOpenTill={Boolean(capabilities?.actions.openTill)} /> },
      { id: "staff-guide", label: "Staff guide", content: <PharmacyStaffGuide capabilities={capabilities} onNavigate={setActiveTab} /> },
    ].filter(tab => tab.id === "staff-guide" ? true : tab.id === "alerts" && capabilities?.inventoryMode === "billing_only" ? false : tab.id === "professional-reviews" ? canProfessionalReview : tab.id === "files" ? capabilities?.actions.readFiles : tab.id === "register" ? capabilities?.actions.readRegister : tab.id === "external-prescriptions" ? capabilities?.actions.viewExternalPrescriptions : tab.id === "transfers" ? capabilities?.actions.transferStock && capabilities?.actions.viewCost : ["reports", "daily"].includes(tab.id) ? capabilities?.actions.viewReports : tab.id === "till" ? capabilities?.actions.viewTill : tab.id === "finance" ? canFinance : tab.id === "returns" ? capabilities?.actions.viewReturns : tab.id === "counter" ? capabilities?.actions.sell : tab.id === "pickups" || tab.id === "sales" ? capabilities?.actions.viewSales : tab.id === "purchases" ? capabilities?.actions.viewPurchases : tab.id === "dispensing" ? capabilities?.actions.viewRxQueue : capabilities?.actions.viewStock)} />}

    <Modal open={medicineOpen} onClose={() => setMedicineOpen(false)} busy={busy === "medicine"} title={editingMedicine ? "Edit medicine" : "Add medicine"} description={editingMedicine?.name || selectedLocation?.name} size="lg" bodyClassName={styles.dialog} footer={<><Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => setMedicineOpen(false)}>Cancel</Button><Button size="sm" type="submit" form="medicine-form" loading={busy === "medicine"}>Save medicine</Button></>}>
      <form id="medicine-form" onSubmit={saveMedicine} noValidate>
        <Tabs variant="pills" activeTab={medicineTab} onChange={setMedicineTab} scrollActiveIntoView={false} tabs={[{ id: "medicine", label: "Medicine" }, { id: "stock", label: "Stock & pricing" }, { id: "units", label: "Units & codes" }]} />
        <fieldset disabled={Boolean(busy)} className={styles.form} hidden={medicineTab !== "medicine"}>
          <Input label="Medicine name *" value={medicineForm.name} onChange={event => setMedicineForm({ ...medicineForm, name: event.target.value })} error={errors.name} autoComplete="off" required />
          <Input label="Generic composition *" value={medicineForm.genericName} onChange={event => setMedicineForm({ ...medicineForm, genericName: event.target.value })} error={errors.genericName} required />
          <div className={styles.fieldGrid}><Input label="Strength" maxLength={80} value={medicineForm.strength} onChange={event => setMedicineForm({ ...medicineForm, strength: event.target.value })} /><Input label="Manufacturer" maxLength={200} value={medicineForm.manufacturer} onChange={event => setMedicineForm({ ...medicineForm, manufacturer: event.target.value })} /></div>
          <div className={styles.fieldGrid}><Select label="Dosage form" value={medicineForm.category} onChange={event => setMedicineForm({ ...medicineForm, category: event.target.value })} options={medicineForms.map(value => ({ value, label: value }))} />
            <Select label="Sale restrictions" value={medicineForm.scheduleType} disabled={Boolean(editingMedicine)} onChange={event => setMedicineForm({ ...medicineForm, scheduleType: event.target.value })} options={["general", "schedule_h", "schedule_h1", "schedule_x", "narcotic"].map(value => ({ value, label: value.replaceAll("_", " ") }))} /></div>
          <p className={styles.meta}>Restricted supply needs separate classification and professional review. Existing sale restrictions are changed through that review.</p>
          {editingMedicine && (medicineForm.batchNumber || medicineForm.expiryDate) && <div className={styles.fieldGrid}><Input label="Catalog batch" value={medicineForm.batchNumber} readOnly /><Input label="Catalog expiry" value={medicineForm.expiryDate} readOnly /></div>}
        </fieldset>
        <fieldset disabled={Boolean(busy)} className={styles.form} hidden={medicineTab !== "stock"}>
          <div className={styles.fieldGrid}>{editingMedicine && canViewCost && <Input label="Purchase cost *" type="number" inputMode="decimal" step="0.01" value={medicineForm.costPrice} onChange={event => setMedicineForm({ ...medicineForm, costPrice: event.target.value })} error={errors.costPrice} />}<Input label="Retail price *" type="number" min="0" inputMode="decimal" step="0.01" value={medicineForm.price} onChange={event => setMedicineForm({ ...medicineForm, price: event.target.value })} error={errors.price} required /></div>
          {capabilities?.inventoryMode !== "billing_only" && <div className={styles.fieldGrid}><Input label="Stock quantity" type="number" value={medicineForm.stockQuantity} readOnly /><Input label="Reorder level *" type="number" min="0" step="1" value={medicineForm.reorderLevel} onChange={event => setMedicineForm({ ...medicineForm, reorderLevel: event.target.value })} error={errors.reorderLevel} /></div>}
          {(capabilities?.inventoryMode === "billing_only" || editingMedicine?.billingSupply) && <fieldset className={styles.form}><legend>Billing-only supply details</legend><p className={styles.meta}>Record the batch on the goods being supplied. Update these details when the supplied batch changes. This creates no stock receipt.</p><Input label="Supply batch number" maxLength={100} value={medicineForm.supplyBatch} onChange={event => setMedicineForm({ ...medicineForm, supplyBatch: event.target.value })} /><Select label="Printed expiry precision" value={medicineForm.supplyPrecision} onChange={event => setMedicineForm({ ...medicineForm, supplyPrecision: event.target.value, supplyExpiry: "" })} options={[{ value: "month", label: "Month" }, { value: "day", label: "Day" }]} /><DatePicker label="Printed supply expiry" mode={medicineForm.supplyPrecision === "month" ? "month" : "date"} value={medicineForm.supplyExpiry} onChange={value => setMedicineForm({ ...medicineForm, supplyExpiry: value })} /><Input label="MRP per base unit (INR)" inputMode="decimal" value={medicineForm.supplyMrp} error={errors.supplyMrp} onChange={event => setMedicineForm({ ...medicineForm, supplyMrp: event.target.value })} /></fieldset>}
          <Input label="Rack / shelf (optional)" maxLength={60} value={medicineForm.rackLocation} onChange={event => setMedicineForm({ ...medicineForm, rackLocation: event.target.value })} placeholder="e.g. A3 / Shelf 2" />
          <p className={styles.meta}>{capabilities?.inventoryMode === "billing_only" ? "Stock is not tracked at this branch. Catalogue selling price and actual supply details are checked when saving a bill." : "New catalogue items start with zero stock. Use Add batch to receive stock."} Prices are in INR per base unit.</p>
        </fieldset>
        <fieldset disabled={Boolean(busy)} className={styles.form} hidden={medicineTab !== "units"}>
          <div className={styles.fieldGrid}><Select label="Base unit" value={medicineForm.baseUnit} onChange={event => setMedicineForm({ ...medicineForm, baseUnit: event.target.value })} options={[{ value: "", label: "Select base unit" }, ...baseUnits.map(value => ({ value, label: value }))]} />
            <Select label="Pack unit" value={medicineForm.packUnit} onChange={event => setMedicineForm({ ...medicineForm, packUnit: event.target.value })} options={[{ value: "", label: "Select pack unit" }, ...packUnits.map(value => ({ value, label: value }))]} /></div>
          <Input label="Base units per pack" type="number" min="1" max="1000000" step="1" value={medicineForm.unitsPerPack} onChange={event => setMedicineForm({ ...medicineForm, unitsPerPack: event.target.value })} error={errors.unitsPerPack} />
          <p className={styles.meta}>Stock quantities use base units. Units can be edited only before stock or batch history exists. Existing unclassified quantities need review.</p>
          <div className={styles.fieldGrid}><Select label="Outer pack (optional)" value={medicineForm.outerPackUnit} onChange={event => setMedicineForm({ ...medicineForm, outerPackUnit: event.target.value, packsPerOuter: "" })} options={[{ value: "", label: "No outer pack" }, ...packUnits.filter(value => value !== medicineForm.packUnit && value !== medicineForm.baseUnit).map(value => ({ value, label: value }))]} /><Input label="Inner packs per outer pack" type="number" min="2" max="1000000" step="1" disabled={!medicineForm.outerPackUnit} value={medicineForm.packsPerOuter} onChange={event => setMedicineForm({ ...medicineForm, packsPerOuter: event.target.value })} /></div>
          <p className={styles.meta}>Record the printed relationship, for example 1 box = 10 strips and 1 strip = 10 tablets. No conversion factor is assumed.</p>
          <Input label="Barcode aliases" placeholder="Separate aliases with commas; keep leading zeros" value={medicineForm.barcodes} onChange={event => setMedicineForm({ ...medicineForm, barcodes: event.target.value })} error={errors.barcodes} />
          <div className={styles.fieldGrid}><Input label="HSN code" value={medicineForm.hsnCode} error={errors.hsnCode} readOnly={Boolean(editingMedicine)} onChange={event => setMedicineForm({ ...medicineForm, hsnCode: event.target.value })} />
            <Input label="GST rate (%)" type="number" min="0" max="100" step="0.01" value={medicineForm.gstRate} error={errors.gstRate} readOnly={Boolean(editingMedicine)} onChange={event => setMedicineForm({ ...medicineForm, gstRate: event.target.value })} /></div>
          <p className={styles.meta}>Document issue requires reviewed HSN and tax classification. Existing tax details are changed through that review.</p>
        </fieldset>
      </form>
    </Modal>
    <Modal open={Boolean(batchTarget)} onClose={() => setBatchTarget(null)} busy={busy === "batch"} title="Add batch" description={batchTarget?.name} size="md" bodyClassName={styles.dialog} footer={<><Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => setBatchTarget(null)}>Cancel</Button><Button size="sm" form="batch-form" type="submit" loading={busy === "batch"}>Save batch</Button></>}>
      <form id="batch-form" onSubmit={saveBatch} noValidate className={styles.form}>{batchError && <Alert variant="error" title="Check batch details">{batchError}</Alert>}<fieldset disabled={Boolean(busy)} className={styles.form}><div className={styles.fieldGrid}><Input label="Batch number *" value={batchForm.batchNumber} onChange={event => setBatchForm({ ...batchForm, batchNumber: event.target.value })} required /><DatePicker label="Expiry date *"  value={batchForm.expiryDate} onChange={value => setBatchForm({ ...batchForm, expiryDate: value })} required /></div><Input label="Unlinked inward reason *" maxLength={200} value={batchForm.unlinkedInwardReason} onChange={event => setBatchForm({ ...batchForm, unlinkedInwardReason: event.target.value })} required /><Input label="Quantity received *" type="number" min="1" step="1" inputMode="numeric" value={batchForm.quantity} onChange={event => setBatchForm({ ...batchForm, quantity: event.target.value })} required /><div className={styles.fieldGrid}><Input label="Purchase cost *" type="number" min="0" step="0.01" value={batchForm.purchaseCost} onChange={event => setBatchForm({ ...batchForm, purchaseCost: event.target.value })} required /><Input label="Selling price *" type="number" min="0" step="0.01" value={batchForm.sellingPrice} onChange={event => setBatchForm({ ...batchForm, sellingPrice: event.target.value })} required /></div></fieldset></form>
    </Modal>
    <Modal open={Boolean(prescription)} onClose={() => setPrescription(null)} busy={busy === "dispense"} title="Dispense prescription" footerClassName={styles.dispenseFooter} description={prescription?.patientId.name} size="lg" bodyClassName={styles.dialog} footer={<><div className={styles.subtotal}><span>Estimated subtotal</span><strong>{money(estimatedTotal)}</strong></div><Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => setPrescription(null)}>Cancel</Button><Button size="sm" type="submit" form="dispense-form" loading={busy === "dispense"} disabled={Boolean(prepared.error || prescriptionChanged || catalogError || pendingError || reading || pendingDispenseKey || stockLookupBusy || stockLookupError || query !== search.trim())}>Dispense & bill</Button></>}>
      <form id="dispense-form" onSubmit={dispense} className={styles.form}><Input type="search" maxLength={100} label="Find stock by name or barcode" value={search} onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} onChange={event => { setSearch(event.target.value); setFilter("all"); }} />{stockLookupBusy && <p role="status">Loading prescribed stock...</p>}{stockLookupError && <Alert variant="error" title="Stock lookup unavailable">{stockLookupError}</Alert>}<p className={styles.summary}>Choose stock and quantities. Unselected items stay pending.</p>{prescription?.prescriptions.map((rx, index) => <fieldset key={rx.id} className={styles.rx} disabled={Boolean(busy || pendingDispenseKey || stockLookupBusy)}><div><h3>{rx.name}</h3><p>{[rx.dosage, rx.frequency, rx.duration].filter(Boolean).join(" / ")}</p>{rx.instructions && <p>{rx.instructions}</p>}{rx.fulfillment?.mode === "quantity" ? <p>Authorized: {rx.fulfillment.authorizedQuantity} {rx.fulfillment.baseUnit}. Supplied: {rx.fulfillment.suppliedQuantity}. Remaining: {rx.fulfillment.remainingQuantity}.</p> : <p>No explicit quantity allowance. This row can be supplied once; further supply needs a new prescriber authorization.</p>}</div><div className={styles.mapping}><Select label={`Stock for ${rx.name}`} value={selections[index]?.medicineId || ""} onChange={event => selectStock(index, event.target.value)} options={[{ value: "", label: "Leave pending" }, ...stockOptions.filter(medicine => medicine.locationId === locationId).map(medicine => ({ value: medicine.id, label: `${[medicine.name, medicine.strength, medicine.genericName].filter(Boolean).join(" ? ")} / ${medicine.stockQuantity} ${medicine.unitDefinition?.baseUnit || "units"} / ${money(medicine.price)}`, disabled: medicine.stockQuantity <= 0 }))]} /><Input aria-label={`Quantity for ${rx.name}`} label="Quantity" type="number" inputMode="numeric" min="1" max={rx.fulfillment?.remainingQuantity ?? undefined} step="1" value={selections[index]?.quantity || ""} disabled={!selections[index]?.medicineId} onChange={event => setSelections(previous => previous.map((item, position) => position === index ? { ...item, quantity: Number(event.target.value) } : item))} /></div><details><summary>Original files for {rx.name}</summary><PharmacyPrescriptionAttachments sourceKind="clinic" locationId={locationId} prescriptionId={rx.id} canUpload={Boolean(capabilities?.actions.viewRxQueue && capabilities?.actions.dispense)} /></details></fieldset>)}{prescriptionChanged && <Alert variant="warning" title="Prescription changed">Close and reopen this prescription from the refreshed list before dispensing.</Alert>}{prepared.error && <p role="status" className={styles.meta}>{prepared.error}</p>}{catalogError && <Alert variant="error" title="Inventory unavailable">Close and refresh inventory before dispensing.</Alert>}</form>
    </Modal>
    <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} loading={busy === "delete"} title="Archive medicine?" description={`Remove ${deleting?.name || "this medicine"} from the inventory catalog? Existing bills and movement history are retained. Products with remaining stock or pending receipts/transfers must be resolved first.`} variant="danger" confirmLabel="Archive medicine" onConfirm={() => { if (deleting) void commit("delete", () => api.delete(`/medicines/${deleting.id}`), "Medicine archived", () => setDeleting(null)); }} />
  </div>;
}
