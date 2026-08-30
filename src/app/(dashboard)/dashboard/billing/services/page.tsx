"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { hasAnyPermission } from "@/lib/permissions";
import { useAuthStore } from "@/store/authStore";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  Button,
  Modal,
  Input,
  Select,
  Textarea,
  useToast,
  Badge,
  StatCard,
  Dropdown,
} from "@/components/ui";
import { Plus, FileText, Stethoscope, FlaskConical, Building2 } from "lucide-react";

interface ServiceItem {
  _id: string;
  id?: string;
  code: string;
  name: string;
  department: string;
  category: string;
  price: number;
  hsnSacCode: string;
  gstRate: number;
  isActive: boolean;
  description?: string;
}

export default function ServiceCatalogPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    department: "",
    category: "consultation",
    price: "",
    hsnSacCode: "999312",
    gstRate: "0",
    description: "",
    isActive: true,
  });

  const fetchServices = async () => {
    try {
      setLoading(true);
      const params: string[] = [];
      if (search) params.push(`search=${encodeURIComponent(search)}`);
      if (filterCategory) params.push(`category=${filterCategory}`);

      const queryString = params.length ? `?${params.join("&")}` : "";
      const res = await api.get(`/service-catalog${queryString}`);
      setServices(res.data?.data || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to load service catalog", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [search, filterCategory]);

  const handleOpenAddModal = () => {
    setEditingService(null);
    setFormData({
      code: "",
      name: "",
      department: "General Medicine",
      category: "consultation",
      price: "",
      hsnSacCode: "999312",
      gstRate: "0",
      description: "",
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (service: ServiceItem) => {
    setEditingService(service);
    setFormData({
      code: service.code,
      name: service.name,
      department: service.department,
      category: service.category,
      price: String(service.price),
      hsnSacCode: service.hsnSacCode || "999312",
      gstRate: String(service.gstRate || 0),
      description: service.description || "",
      isActive: service.isActive,
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.name || !formData.department || !formData.price) {
      toast({ title: "Validation Error", description: "Please fill in Code, Name, Department, and Price", variant: "error" });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        department: formData.department.trim(),
        category: formData.category,
        price: parseFloat(formData.price),
        hsnSacCode: formData.hsnSacCode.trim(),
        gstRate: parseFloat(formData.gstRate || "0"),
        description: formData.description.trim(),
        isActive: formData.isActive,
      };

      if (editingService) {
        await api.put(`/service-catalog/${editingService._id || editingService.id}`, payload);
        toast({ title: "Updated", description: "Service rate updated successfully", variant: "success" });
      } else {
        await api.post("/service-catalog", payload);
        toast({ title: "Created", description: "New service item added to catalog", variant: "success" });
      }

      setIsModalOpen(false);
      fetchServices();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Operation failed", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (service: ServiceItem) => {
    try {
      await api.delete(`/service-catalog/${service._id || service.id}`);
      toast({ title: "Deactivated", description: `${service.name} deactivated`, variant: "success" });
      fetchServices();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to deactivate service", variant: "error" });
    }
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      const res = await api.post("/service-catalog/seed");
      toast({ title: "Catalog Seeded", description: res.data?.message || "Default services added", variant: "success" });
      fetchServices();
    } catch (err: any) {
      toast({ title: "Seed Failed", description: err.response?.data?.message || "Could not seed catalog", variant: "error" });
    } finally {
      setSeeding(false);
    }
  };

  const getCategoryBadgeVariant = (category: string) => {
    switch (category) {
      case "consultation": return "primary";
      case "procedure": return "warning";
      case "lab_test": return "success";
      case "radiology": return "primary";
      case "bed_charge": return "danger";
      default: return "default";
    }
  };

  // Stats calculation
  const totalCount = services.length;
  const consultationCount = services.filter((s) => s.category === "consultation").length;
  const labCount = services.filter((s) => s.category === "lab_test").length;
  const bedCount = services.filter((s) => s.category === "bed_charge").length;

  return (
    <div className="space-y-6 w-full font-sans text-text antialiased animate-fade-up pb-8">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP EXECUTIVE HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-500/30 before:to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                Hospital Service Catalog & Rate Cards
              </h1>
              <Badge variant="primary" size="sm" className="font-semibold">
                Rate Master
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Master fee schedule, HSN/SAC codes, and GST rates for automated encounter & OPD/IPD billing.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {totalCount === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSeedDefaults}
                disabled={seeding}
                className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors"
              >
                Seed Default Rate Card
              </Button>
            )}
            {hasAnyPermission(user, "MANAGE_BILLING") && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenAddModal}
                className="font-semibold rounded-xl shadow-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Service Item
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. KPI STATS CARDS GRID
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Catalog Services"
          value={totalCount.toString()}
          description="Active chargemaster items"
          icon={<FileText className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Consultation Tariffs"
          value={consultationCount.toString()}
          description="OPD / Specialist rates"
          icon={<Stethoscope className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Diagnostic Lab Tests"
          value={labCount.toString()}
          description="Pathology & Lab tariff list"
          icon={<FlaskConical className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="IPD Bed Charges"
          value={bedCount.toString()}
          description="Ward / ICU room tariffs"
          icon={<Building2 className="w-5 h-5 text-text-secondary" />}
        />
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="w-full sm:w-72">
              <Input
                placeholder="Search by code, service name, HSN/SAC..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <Select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                options={[
                  { value: "", label: "All Categories" },
                  { value: "consultation", label: "Consultation" },
                  { value: "procedure", label: "Procedure" },
                  { value: "lab_test", label: "Lab Test" },
                  { value: "radiology", label: "Radiology" },
                  { value: "bed_charge", label: "Bed Charge" },
                  { value: "pharmacy", label: "Pharmacy" },
                  { value: "nursing", label: "Nursing Care" },
                  { value: "other", label: "Other" },
                ]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services Table */}
      <Card>
        <CardHeader className="p-4 border-b border-border flex justify-between items-center">
          <CardTitle className="text-base font-bold">Service Rate Schedule</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table
            loading={loading}
            columns={[
              {
                key: "code",
                header: "Service Code",
                sortable: true,
                render: (row: ServiceItem) => <span className="font-mono text-xs font-bold text-primary-600">{row.code}</span>,
              },
              {
                key: "name",
                header: "Service Name",
                sortable: true,
                render: (row: ServiceItem) => (
                  <div>
                    <p className="font-semibold text-text text-sm">{row.name}</p>
                    {row.description && <p className="text-xs text-text-muted">{row.description}</p>}
                  </div>
                ),
              },
              {
                key: "department",
                header: "Department",
                sortable: true,
                render: (row: ServiceItem) => <span className="text-xs font-medium text-text-secondary">{row.department}</span>,
              },
              {
                key: "category",
                header: "Category",
                sortable: true,
                render: (row: ServiceItem) => (
                  <Badge variant={getCategoryBadgeVariant(row.category)} className="capitalize text-[11px]">
                    {row.category.replace("_", " ")}
                  </Badge>
                ),
              },
              {
                key: "price",
                header: "Base Price (₹)",
                sortable: true,
                render: (row: ServiceItem) => <span className="font-bold text-text">₹{row.price.toLocaleString("en-IN")}</span>,
              },
              {
                key: "hsnSacCode",
                header: "SAC / HSN",
                render: (row: ServiceItem) => <span className="font-mono text-xs text-text-secondary">{row.hsnSacCode || "999312"}</span>,
              },
              {
                key: "gstRate",
                header: "GST Rate",
                render: (row: ServiceItem) => <span className="text-xs text-text-secondary">{row.gstRate || 0}%</span>,
              },
              {
                key: "isActive",
                header: "Status",
                render: (row: ServiceItem) => (
                  <Badge variant={row.isActive ? "success" : "danger"}>
                    {row.isActive ? "Active" : "Inactive"}
                  </Badge>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (row: ServiceItem) => (
                  <div className="flex items-center justify-end">
                    <Dropdown
                      align="right"
                      trigger={
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0 flex items-center justify-center rounded-lg cursor-pointer shrink-0" title="Row Actions">
                          <svg className="h-4 w-4 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                          </svg>
                        </Button>
                      }
                      items={[
                        { label: "Edit Rates & Tax", onClick: () => handleOpenEditModal(row) },
                        ...(row.isActive ? [{ label: "Deactivate Item", onClick: () => handleDeactivate(row) }] : []),
                      ]}
                    />
                  </div>
                ),
              },
            ]}
            data={services}
            emptyMessage="No services found in rate catalog. Click 'Seed Default Rate Card' to populate standard healthcare fees."
          />
        </CardContent>
      </Card>

      {/* Add/Edit Service Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingService ? `Edit Service: ${editingService.code}` : "Create Service Catalog Item"}
        size="md"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Service Code *"
              placeholder="e.g. SRV-CONS-001"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              disabled={!!editingService}
              required
            />
            <Input
              label="Service Name *"
              placeholder="e.g. Speciality Consultation"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Department *"
              placeholder="e.g. General Medicine"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              required
            />
            <Select
              label="Service Category *"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              options={[
                { value: "consultation", label: "Consultation" },
                { value: "procedure", label: "Procedure" },
                { value: "lab_test", label: "Lab Test" },
                { value: "radiology", label: "Radiology" },
                { value: "bed_charge", label: "Bed Charge" },
                { value: "pharmacy", label: "Pharmacy" },
                { value: "nursing", label: "Nursing Care" },
                { value: "other", label: "Other" },
              ]}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Price (₹) *"
              type="number"
              min="0"
              step="0.01"
              placeholder="500"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              required
            />
            <Input
              label="SAC / HSN Code"
              placeholder="999312"
              value={formData.hsnSacCode}
              onChange={(e) => setFormData({ ...formData, hsnSacCode: e.target.value })}
            />
            <Select
              label="GST Rate %"
              value={formData.gstRate}
              onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
              options={[
                { value: "0", label: "0% (Exempt Healthcare)" },
                { value: "5", label: "5%" },
                { value: "12", label: "12%" },
                { value: "18", label: "18%" },
                { value: "28", label: "28%" },
              ]}
            />
          </div>

          <Textarea
            label="Service Description (Optional)"
            placeholder="Clinical details, scope of procedure..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />

          <div className="flex justify-between border-t border-border pt-4 mt-6">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {editingService ? "Save Changes" : "Create Item"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
