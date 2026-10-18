"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { MoreHorizontal, Plus, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import api from "@/lib/api";
import { authScopeKey } from "@/lib/authScope";
import { hasAnyPermission } from "@/lib/permissions";
import { userFacingError } from "@/lib/userFacingError";
import { useAuthStore } from "@/store/authStore";
import { useLatestRead } from "@/hooks/useLatestRead";
import { Alert, Badge, Button, Card, ConfirmDialog, Dropdown, Input, Select, Table, Tabs, Textarea, useToast, type Column } from "@/components/ui";
import QueueDialog from "@/components/queue/QueueDialog";
import { emptyServiceForm, readServiceCatalog, serviceCategories, validateServiceForm, type ServiceForm, type ServiceItem } from "@/components/billing/serviceCatalog";
import { formatCurrency } from "@/lib/currency";

const money = (value: number) => formatCurrency(value, "INR");
const categoryLabel = (value: string) => serviceCategories.find(category => category.value === value)?.label || value;

export default function ServiceCatalogPage() {
  const { user } = useAuthStore();
  if (!hasAnyPermission(user, "VIEW_BILLING", "MANAGE_BILLING")) {
    return <Alert title="Billing access required">Ask your administrator for access to the service catalog.</Alert>;
  }
  return <ServiceCatalogWorkspace key={authScopeKey(user)} />;
}

function ServiceCatalogWorkspace() {
  const { user } = useAuthStore();
  const scope = authScopeKey(user);
  const canManage = hasAnyPermission(user, "MANAGE_BILLING");
  const { toast } = useToast();
  const startRead = useLatestRead();
  const alive = useRef(true);
  const writeLock = useRef(false);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState("name");
  const [status, setStatus] = useState("all");
  const [editor, setEditor] = useState<{ service: ServiceItem | null } | null>(null);
  const [form, setForm] = useState<ServiceForm>(emptyServiceForm);
  const [formTab, setFormTab] = useState("service");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ service: ServiceItem; active: boolean } | null>(null);
  const [seedOpen, setSeedOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const fetchServices = useCallback(async () => {
    const request = startRead();
    setLoading(true);
    setLoadError(null);
    try {
      const data = await readServiceCatalog(request.signal);
      if (!request.isCurrent()) return;
      setServices(data);
      setLoaded(true);
    } catch {
      if (request.isCurrent()) setLoadError("Services could not be loaded. Check your connection and try again.");
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [startRead]);
  useEffect(() => { void fetchServices(); }, [fetchServices]);

  const openEditor = (service: ServiceItem | null) => {
    if (!canManage || busy || loading || loadError) return;
    setForm(service ? {
      code: service.code, name: service.name, department: service.department, category: service.category,
      price: String(service.price), hsnSacCode: service.hsnSacCode || "", gstRate: String(service.gstRate ?? 0),
      description: service.description || "", isActive: service.isActive,
    } : emptyServiceForm());
    setFormTab("service");
    setFormError(null);
    setEditor({ service });
  };
  const commit = async (kind: string, action: () => Promise<unknown>, success: string, done: () => void) => {
    if (writeLock.current || !canManage || loading || loadError || authScopeKey(useAuthStore.getState().user) !== scope) return;
    writeLock.current = true;
    setBusy(kind);
    try {
      await action();
      if (!alive.current || authScopeKey(useAuthStore.getState().user) !== scope) return;
      done();
      toast({ title: success, variant: "success" });
      await fetchServices();
    } catch (error) {
      if (alive.current && authScopeKey(useAuthStore.getState().user) === scope) {
        const response = (error as { response?: { status?: number; data?: { message?: string } } })?.response;
        const message = kind === "save" && response?.status === 409 ? "This service code is already in use. Choose another code or edit the existing service."
          : userFacingError(response?.data?.message, "Your request could not be completed. Check the catalog before retrying.");
        if (kind === "save") setFormError(message);
        toast({ title: "Could not save", description: message, variant: "error" });
      }
    } finally {
      writeLock.current = false;
      if (alive.current) setBusy(null);
    }
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!editor || writeLock.current) return;
    const invalid = validateServiceForm(form);
    if (invalid) { setFormTab(invalid.tab); setFormError(invalid.message); return; }
    setFormError(null);
    const payload = {
      ...form, code: form.code.trim().toUpperCase(), name: form.name.trim(), department: form.department.trim(),
      price: Number(form.price), gstRate: Number(form.gstRate), hsnSacCode: form.hsnSacCode.trim(), description: form.description.trim(),
    };
    const service = editor.service;
    void commit("save", () => service ? api.put(`/service-catalog/${service._id || service.id}`, payload) : api.post("/service-catalog", payload), service ? "Service updated" : "Service added", () => setEditor(null));
  };
  const update = <K extends keyof ServiceForm>(key: K, value: ServiceForm[K]) => setForm(current => ({ ...current, [key]: value }));
  const disabled = Boolean(busy || loading || loadError);
  const term = search.trim().toLowerCase();
  const filtered = services.filter(service =>
    (status === "all" || service.isActive === (status === "active")) && (!category || service.category === category) &&
    (!term || [service.code, service.name, service.department, service.hsnSacCode, service.description].some(value => value?.toLowerCase().includes(term))))
    .sort((a, b) => sort === "price-low" ? a.price - b.price : sort === "price-high" ? b.price - a.price : String(a[sort as "code" | "name" | "category" | "department"]).localeCompare(String(b[sort as "code" | "name" | "category" | "department"])));
  const count = loaded ? services.length : undefined;
  const activeCount = loaded ? services.filter(service => service.isActive).length : undefined;
  const actions = (service: ServiceItem) => canManage ? <Dropdown align="right" trigger={
    <Button variant="ghost" size="sm" className="h-11 min-h-11 w-11 min-w-11 p-0" aria-label={`Actions for ${service.name}`} disabled={disabled}><MoreHorizontal size={18} /></Button>
  } items={[
    { label: "Edit service", onClick: () => openEditor(service) },
    { label: service.isActive ? "Deactivate" : "Reactivate", onClick: () => { if (!disabled) setConfirmation({ service, active: !service.isActive }); } },
  ]} /> : null;
  const columns: Column<ServiceItem>[] = [
    { key: "name", header: "Service", render: service => <div className="grid min-w-0 gap-1 wrap-anywhere [&>strong]:text-sm [&>strong]:font-semibold [&>span]:text-xs [&>span]:text-text-muted"><strong>{service.name}</strong><span>{service.code}{service.description ? ` \u00b7 ${service.description}` : ""}</span></div> },
    { key: "category", header: "Category", width: "8rem", render: service => <span className="whitespace-nowrap">{categoryLabel(service.category)}</span> },
    { key: "department", header: "Department" },
    { key: "price", header: "Base price", width: "7rem", align: "right", render: service => <strong className="whitespace-nowrap tabular-nums">{money(service.price)}</strong> },
    { key: "gstRate", header: "GST / SAC", width: "6rem", render: service => <div className="grid min-w-0 gap-1 wrap-anywhere [&>strong]:text-sm [&>strong]:font-semibold [&>span]:text-xs [&>span]:text-text-muted"><span className="text-text">{service.gstRate ?? 0}% GST</span><span>{service.hsnSacCode || "Not set"}</span></div> },
    { key: "isActive", header: "Status", width: "6rem", render: service => <Badge variant={service.isActive ? "success" : "default"} size="sm" dot>{service.isActive ? "Active" : "Inactive"}</Badge> },
    ...(canManage ? [{ key: "actions", header: "", align: "right" as const, render: actions }] : []),
  ];
  const noMatches = Boolean(search || category || status !== "all");
  const emptyMessage = noMatches ? "No services match these filters." : "No services yet.";
  const gstOptions = [...new Set([0, 5, 12, 18, 28, Number(form.gstRate)])].sort((a, b) => a - b).map(rate => ({ value: String(rate), label: `${rate}%` }));

  return <div className="grid w-full min-w-0 gap-3 sm:gap-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="page-title">Services {count !== undefined && <span className="ml-1 text-xs font-normal tracking-normal text-text-muted tabular-nums">{count}</span>}</h1><p className="mt-1 hidden text-xs text-text-muted sm:block">Service rates and tax details for patient bills.</p></div>
      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <Button variant="ghost" size="sm" className="h-11 min-h-11 w-11 min-w-11 p-0" aria-label="Refresh services" onClick={() => void fetchServices()} disabled={loading || Boolean(busy)}><RefreshCw size={18} className={loading ? "animate-spin" : ""} /></Button>
        {canManage && <Button size="sm" aria-label="Add service" onClick={() => openEditor(null)} disabled={disabled}><Plus size={16} /><span className="sm:hidden">Add</span><span className="hidden sm:inline">Add service</span></Button>}
      </div>
    </header>

    <section aria-label="Service filters"><Card padding="sm" contentClassName="grid min-w-0 gap-3 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
      <Tabs className="min-w-0 [&_[role=tablist]]:gap-1 [&_[role=tab]]:min-h-11 [&_[role=tab]]:gap-1 [&_[role=tab]]:px-2 [&_[role=tab]]:text-xs [&_[role=tab]>span]:ml-0" variant="pills" activeTab={status} onChange={setStatus} scrollActiveIntoView={false} tabs={[
        { id: "all", label: "All", badge: count }, { id: "active", label: "Active", badge: activeCount },
        { id: "inactive", label: "Inactive", badge: count !== undefined && activeCount !== undefined ? count - activeCount : undefined },
      ]} />
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 [&>button]:min-h-11">
        <Input type="search" aria-label="Search services" placeholder="Search services" value={search} onChange={event => setSearch(event.target.value)} leftIcon={<Search size={16} />} />
        <Button variant="outline" size="sm" aria-expanded={filtersOpen} aria-controls="service-filters" onClick={() => setFiltersOpen(open => !open)}><SlidersHorizontal size={16} /> Filters{category ? " (1)" : ""}</Button>
      </div>
      {filtersOpen && <div id="service-filters" className="col-span-full grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
        <Select label="Category" value={category} onChange={event => setCategory(event.target.value)} options={[{ value: "", label: "All categories" }, ...serviceCategories]} />
        <Select label="Sort by" value={sort} onChange={event => setSort(event.target.value)} options={[
          { value: "name", label: "Name" }, { value: "code", label: "Code" }, { value: "category", label: "Category" }, { value: "department", label: "Department" },
          { value: "price-low", label: "Price: low to high" }, { value: "price-high", label: "Price: high to low" },
        ]} />
      </div>}
    </Card></section>

    {loadError && <Alert variant="error" title="Catalog unavailable" action={<Button variant="outline" size="sm" onClick={() => void fetchServices()}>Try again</Button>}>{loadError}</Alert>}
    <section className="min-w-0 md:overflow-hidden md:rounded-container md:border md:border-border md:bg-surface [&_table]:min-w-3xl" aria-label="Service catalog" aria-busy={loading}>
      <Table variant="flat" density="compact" fitContent searchable={false} showColumnVisibility={false} pagination={filtered.length > 10} loading={loading && !loaded}
        columns={columns} data={filtered} emptyMessage={loadError && !loaded ? "Results are unavailable. Please try again." : emptyMessage}
        renderMobileCard={service => <article><Card padding="sm" contentClassName="grid min-w-0 gap-2.5">
          <div className="flex items-start justify-between gap-2"><div className="grid min-w-0 gap-1 wrap-anywhere [&>strong]:text-sm [&>strong]:font-semibold [&>span]:text-xs [&>span]:text-text-muted"><strong>{service.name}</strong><span>{service.code} &middot; {categoryLabel(service.category)}</span></div>{actions(service)}</div>
          <div className="flex items-center justify-between gap-2 text-xs text-text-muted wrap-anywhere"><span>{service.department}</span><Badge variant={service.isActive ? "success" : "default"} size="sm" dot>{service.isActive ? "Active" : "Inactive"}</Badge></div>
          {service.description && <p className="text-xs text-text-muted wrap-anywhere">{service.description}</p>}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border pt-2.5 [&>strong]:text-sm [&>strong]:tabular-nums [&_small]:text-xs [&_small]:font-normal [&_small]:text-text-muted [&>span]:text-xs [&>span]:text-text-muted [&>span]:wrap-anywhere"><strong>{money(service.price)} <small>base</small></strong><span>{service.gstRate ?? 0}% GST &middot; SAC/HSN {service.hsnSacCode || "Not set"}</span></div>
        </Card></article>} />
    </section>
    {loaded && !loadError && <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
      <span>{filtered.length} of {services.length} services</span>
      {noMatches && <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setCategory(""); setStatus("all"); }}>Clear filters</Button>}
      {canManage && services.length === 0 && <Button variant="outline" size="sm" onClick={() => setSeedOpen(true)} disabled={disabled}>Add default services</Button>}
    </div>}

    <QueueDialog open={Boolean(editor)} onClose={() => setEditor(null)} title={editor?.service ? "Edit service" : "Add service"}
      description={editor?.service ? editor.service.code : "Create a billable service for your organization."} size="md" busy={Boolean(busy)}
      footer={<><Button variant="outline" disabled={Boolean(busy)} onClick={() => setEditor(null)}>Cancel</Button><Button form="service-form" type="submit" loading={busy === "save"} disabled={loading || Boolean(loadError)}>Save service</Button></>}>
      <form id="service-form" noValidate onSubmit={save} className="grid content-start gap-3">
        <Tabs variant="pills" activeTab={formTab} onChange={setFormTab} scrollActiveIntoView={false} tabs={[{ id: "service", label: "Service" }, { id: "pricing", label: "Pricing & tax" }]} />
        {formError && <Alert variant="error" title="Check service details">{formError}</Alert>}
        <fieldset disabled={Boolean(busy)} className="m-0 min-w-0 border-0 p-0">
          <div hidden={formTab !== "service"} className="grid gap-3 [&[hidden]]:hidden">
            <div className="grid gap-3 min-[400px]:grid-cols-2">
              <Input label="Service name *" value={form.name} onChange={event => update("name", event.target.value)} required />
              <Input label="Service code *" placeholder="CONS-001" value={form.code} onChange={event => update("code", event.target.value.toUpperCase())} disabled={Boolean(editor?.service)} required />
              <Select label="Category" value={form.category} onChange={event => update("category", event.target.value)} options={serviceCategories} />
              <Input label="Department *" value={form.department} onChange={event => update("department", event.target.value)} required />
            </div>
            <Textarea label="Description" value={form.description} onChange={event => update("description", event.target.value)} rows={2} placeholder="Optional service details" />
            {editor?.service && <p className="text-xs leading-relaxed text-text-muted">The service code stays fixed. Use the catalog menu to deactivate or reactivate a service.</p>}
          </div>
          <div hidden={formTab !== "pricing"} className="grid gap-3 [&[hidden]]:hidden">
            <div className="grid gap-3 min-[400px]:grid-cols-2">
              <Input label="Base price (INR) *" type="number" min="0" step="0.01" inputMode="decimal" value={form.price} onChange={event => update("price", event.target.value)} required />
              <Select label="GST rate" value={form.gstRate} onChange={event => update("gstRate", event.target.value)} options={gstOptions} />
            </div>
            <Input label="SAC / HSN code" value={form.hsnSacCode} onChange={event => update("hsnSacCode", event.target.value)} placeholder="999312" />
            <p className="text-xs leading-relaxed text-text-muted">Enter the base price before GST. A zero price is allowed. Confirm the applicable tax rate for this service.</p>
          </div>
        </fieldset>
      </form>
    </QueueDialog>
    <ConfirmDialog open={Boolean(confirmation)} onClose={() => setConfirmation(null)} loading={busy === "status"}
      title={confirmation?.active ? "Reactivate service?" : "Deactivate service?"} description={`${confirmation?.service.name || "This service"} will be marked ${confirmation?.active ? "active" : "inactive"}. You can change this later.`}
      confirmLabel={confirmation?.active ? "Reactivate" : "Deactivate"} variant={confirmation?.active ? "primary" : "danger"} onConfirm={() => {
        if (!confirmation) return;
        const { service, active } = confirmation;
        void commit("status", () => active ? api.put(`/service-catalog/${service._id || service.id}`, { isActive: true }) : api.delete(`/service-catalog/${service._id || service.id}`), active ? "Service reactivated" : "Service deactivated", () => setConfirmation(null));
      }} />
    <ConfirmDialog open={seedOpen} onClose={() => setSeedOpen(false)} loading={busy === "seed"} title="Add default services?"
      description="Add the starter catalog. Review its prices and tax details before billing patients." confirmLabel="Add defaults" onConfirm={() => {
        void commit("seed", () => api.post("/service-catalog/seed"), "Default services added", () => setSeedOpen(false));
      }} />
  </div>;
}
