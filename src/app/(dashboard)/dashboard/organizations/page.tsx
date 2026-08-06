"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import {
  Card,
  CardContent,
  Button,
  Badge,
  Table,
  Column,
  Spinner,
  Modal,
  Input,
  Select,
  Checkbox,
  Dropdown,
  StatCard,
  useToast,
  cn,
} from "@/components/ui";

interface Organization {
  id: string;
  name: string;
  city: string;
  address?: string;
  email?: string;
  phone?: string;
  plan?: "starter" | "pro" | "enterprise";
  status?: "active" | "inactive";
  isActive?: boolean;
  maxClinics?: number;
  maxDoctors?: number;
  maxStaff?: number;
  taxId?: string;
  licenseNumber?: string;
  currency?: string;
  timezone?: string;
  createdAt: string;
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "active" | "inactive" | "starter" | "pro" | "enterprise">("all");

  // Create New Organization Modal State (2-Step Wizard)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [formData, setFormData] = useState({
    orgName: "",
    city: "",
    address: "",
    orgPhone: "",
    orgEmail: "",
    plan: "starter" as "starter" | "pro" | "enterprise",
    taxId: "",
    licenseNumber: "",
    currency: "INR",
    timezone: "Asia/Kolkata",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    clinicName: "",
    sendWelcomeEmail: true,
  });

  // Post-Creation Credentials Summary Modal
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [createdCredentialsSummary, setCreatedCredentialsSummary] = useState<{
    orgName: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
    loginUrl: string;
  } | null>(null);

  // Edit & Delete Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    city: "",
    address: "",
    phone: "",
    email: "",
    plan: "starter" as "starter" | "pro" | "enterprise",
    taxId: "",
    licenseNumber: "",
    currency: "INR",
    timezone: "Asia/Kolkata",
  });
  const [updating, setUpdating] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingOrg, setDeletingOrg] = useState<Organization | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { user, switchOrg } = useAuthStore();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/organizations?t=${Date.now()}`, {
        headers: { "Cache-Control": "no-cache" },
      });
      setOrganizations(res.data.data || []);
    } catch (err: any) {
      toast({
        title: "Error Loading Organizations",
        description: err.response?.data?.message || "Failed to fetch platform organizations",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // Platform Metrics
  const stats = useMemo(() => {
    const total = organizations.length;
    const active = organizations.filter((o) => o.status !== "inactive" && o.isActive !== false).length;
    const inactive = total - active;
    const starterCount = organizations.filter((o) => (o.plan || "starter") === "starter").length;
    const proCount = organizations.filter((o) => o.plan === "pro").length;
    const enterpriseCount = organizations.filter((o) => o.plan === "enterprise").length;

    return { total, active, inactive, starterCount, proCount, enterpriseCount };
  }, [organizations]);

  // Filtered List
  const filteredOrganizations = useMemo(() => {
    return organizations.filter((org) => {
      const matchesSearch =
        org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        org.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (org.email && org.email.toLowerCase().includes(searchQuery.toLowerCase()));

      const isInactive = org.status === "inactive" || org.isActive === false;
      const currentPlan = org.plan || "starter";

      if (!matchesSearch) return false;

      if (activeTab === "active") return !isInactive;
      if (activeTab === "inactive") return isInactive;
      if (activeTab === "starter") return currentPlan === "starter";
      if (activeTab === "pro") return currentPlan === "pro";
      if (activeTab === "enterprise") return currentPlan === "enterprise";

      return true;
    });
  }, [organizations, searchQuery, activeTab]);

  const handleEnterWorkspace = async (orgId: string, orgName: string) => {
    try {
      setSwitchingId(orgId);
      await switchOrg(orgId);
      toast({
        title: "Workspace Context Switched",
        description: `Now operating inside ${orgName} workspace.`,
        variant: "success",
      });
      router.push("/dashboard");
    } catch {
      toast({
        title: "Switch Failed",
        description: "Failed to switch organization workspace context",
        variant: "error",
      });
    } finally {
      setSwitchingId(null);
    }
  };

  const handleGeneratePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let pass = "";
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, adminPassword: pass }));
    setShowAdminPassword(true);
    toast({ title: "Password Generated", description: "Secure administrator password generated.", variant: "info" });
  };

  const handleCreateOrganizationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitting) return;

    if (!formData.orgName.trim() || !formData.city.trim() || !formData.adminName.trim() || !formData.adminEmail.trim() || !formData.adminPassword) {
      toast({
        title: "Validation Error",
        description: "Organization name, city, admin name, admin email, and admin password are required.",
        variant: "warning",
      });
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/onboarding/organization", {
        org_name: formData.orgName.trim(),
        city: formData.city.trim(),
        address: formData.address.trim() || undefined,
        org_phone: formData.orgPhone.trim() ? formData.orgPhone.trim() : undefined,
        org_email: formData.orgEmail.trim() ? formData.orgEmail.trim() : undefined,
        plan: formData.plan,
        taxId: formData.taxId.trim() || undefined,
        licenseNumber: formData.licenseNumber.trim() || undefined,
        currency: formData.currency,
        timezone: formData.timezone,
        admin_name: formData.adminName.trim(),
        admin_email: formData.adminEmail.trim().toLowerCase(),
        admin_password: formData.adminPassword,
        clinic_name: formData.clinicName.trim() || undefined,
        sendWelcomeEmail: formData.sendWelcomeEmail,
      });

      const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      setCreatedCredentialsSummary({
        orgName: formData.orgName.trim(),
        adminName: formData.adminName.trim(),
        adminEmail: formData.adminEmail.trim().toLowerCase(),
        adminPassword: formData.adminPassword,
        loginUrl: `${origin}/login`,
      });

      toast({
        title: "Organization Provisioned",
        description: `${formData.orgName} (${formData.plan.toUpperCase()} Tier) created successfully.`,
        variant: "success",
      });

      setIsModalOpen(false);
      setWizardStep(1);
      setIsSummaryModalOpen(true);
      setFormData({
        orgName: "",
        city: "",
        address: "",
        orgPhone: "",
        orgEmail: "",
        plan: "starter",
        taxId: "",
        licenseNumber: "",
        currency: "INR",
        timezone: "Asia/Kolkata",
        adminName: "",
        adminEmail: "",
        adminPassword: "",
        clinicName: "",
        sendWelcomeEmail: true,
      });
      fetchOrganizations();
    } catch (err: any) {
      toast({
        title: "Creation Failed",
        description: err.response?.data?.message || "Failed to create organization.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdCredentialsSummary) return;
    const text = `ANANTA Healthcare OS - Administrator Credentials\nOrganization: ${createdCredentialsSummary.orgName}\nLogin Portal: ${createdCredentialsSummary.loginUrl}\nEmail: ${createdCredentialsSummary.adminEmail}\nPassword: ${createdCredentialsSummary.adminPassword}`;
    navigator.clipboard.writeText(text);
    toast({
      title: "Credentials Copied",
      description: "Administrator email, password & portal link copied to clipboard.",
      variant: "success",
    });
  };

  const handleOpenEditModal = (org: Organization) => {
    setEditingOrg(org);
    setEditFormData({
      name: org.name || "",
      city: org.city || "",
      address: org.address || "",
      phone: org.phone || "",
      email: org.email || "",
      plan: org.plan || "starter",
      taxId: org.taxId || "",
      licenseNumber: org.licenseNumber || "",
      currency: org.currency || "INR",
      timezone: org.timezone || "Asia/Kolkata",
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg) return;

    setUpdating(true);
    try {
      const res = await api.put(`/organizations/${editingOrg.id}`, {
        name: editFormData.name,
        city: editFormData.city,
        address: editFormData.address || undefined,
        phone: editFormData.phone || undefined,
        email: editFormData.email || undefined,
        plan: editFormData.plan,
        taxId: editFormData.taxId || undefined,
        licenseNumber: editFormData.licenseNumber || undefined,
        currency: editFormData.currency,
        timezone: editFormData.timezone,
      });

      const updated = res.data?.data;
      if (updated) {
        setOrganizations((prev) => prev.map((o) => (o.id === editingOrg.id ? { ...o, ...updated } : o)));
      }

      toast({
        title: "Organization Updated",
        description: `${editFormData.name} details successfully updated.`,
        variant: "success",
      });

      setIsEditModalOpen(false);
      fetchOrganizations();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.response?.data?.message || "Failed to update organization details.",
        variant: "error",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleOpenDeleteModal = (org: Organization) => {
    setDeletingOrg(org);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteOrganization = async () => {
    if (!deletingOrg) return;

    setDeleting(true);
    try {
      await api.delete(`/organizations/${deletingOrg.id}`);
      setOrganizations((prev) => prev.filter((o) => o.id !== deletingOrg.id));

      toast({
        title: "Organization Deleted",
        description: `${deletingOrg.name} has been removed.`,
        variant: "success",
      });

      setIsDeleteModalOpen(false);
      setDeletingOrg(null);
    } catch (err: any) {
      toast({
        title: "Deletion Failed",
        description: err.response?.data?.message || "Failed to delete organization.",
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleOrgStatus = async (org: Organization) => {
    const isCurrentlyInactive = org.status === "inactive" || org.isActive === false;
    const newStatus = isCurrentlyInactive ? "active" : "inactive";

    try {
      await api.put(`/organizations/${org.id}`, { status: newStatus });

      setOrganizations((prev) =>
        prev.map((o) => (o.id === org.id ? { ...o, status: newStatus, isActive: newStatus === "active" } : o))
      );

      toast({
        title: isCurrentlyInactive ? "Organization Reactivated" : "Organization Deactivated",
        description: isCurrentlyInactive
          ? `${org.name} workspace has been reactivated.`
          : `${org.name} workspace access has been locked.`,
        variant: isCurrentlyInactive ? "success" : "warning",
      });

      fetchOrganizations();
    } catch (err: any) {
      toast({
        title: "Status Update Failed",
        description: err.response?.data?.message || "Failed to update organization status.",
        variant: "error",
      });
    }
  };

  const tableColumns: Column<Organization>[] = [
    {
      header: "Organization & Identifiers",
      accessor: (org) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-text text-xs sm:text-sm">{org.name}</span>
            {user?.organization_id === org.id && (
              <Badge variant="primary" size="sm" className="text-[9px] px-1.5 py-0 font-extrabold uppercase">
                Active Workspace
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-text-muted">
            {org.email || "No email listed"}
            {org.taxId ? ` · Tax ID: ${org.taxId}` : ""}
          </p>
        </div>
      ),
    },
    {
      header: "Plan & Quotas",
      accessor: (org) => {
        const plan = org.plan || "starter";
        const variant = plan === "enterprise" ? "primary" : plan === "pro" ? "info" : "secondary";
        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Badge variant={variant as any} size="sm" className="uppercase font-extrabold text-[9px] tracking-wider">
                {plan}
              </Badge>
              <span className="text-[10px] text-text-muted font-bold">{org.currency || "INR"}</span>
            </div>
            <p className="text-[10px] text-text-muted">
              {org.maxClinics ?? (plan === "enterprise" ? "Unlimited" : plan === "pro" ? 5 : 1)} Branch ·{" "}
              {org.maxDoctors ?? (plan === "enterprise" ? "Unlimited" : plan === "pro" ? 15 : 2)} Docs
            </p>
          </div>
        );
      },
    },
    {
      header: "Status",
      accessor: (org) => {
        const isInactive = org.status === "inactive" || org.isActive === false;
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span className={`w-2 h-2 rounded-full ${isInactive ? "bg-red-500" : "bg-emerald-500 animate-pulse"}`} />
            <span className={isInactive ? "text-text-muted" : "text-text"}>
              {isInactive ? "Suspended" : "Active"}
            </span>
          </div>
        );
      },
    },
    {
      header: "Location",
      accessor: (org) => <span className="text-xs text-text-secondary">{org.city}</span>,
    },
    {
      header: "Actions",
      align: "right",
      accessor: (org) => {
        const isCurrentOrg = user?.organization_id === org.id;
        const isInactive = org.status === "inactive" || org.isActive === false;

        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant={isCurrentOrg ? "secondary" : "outline"}
              size="sm"
              loading={switchingId === org.id}
              onClick={() => handleEnterWorkspace(org.id, org.name)}
              className="text-xs font-semibold rounded-lg cursor-pointer shrink-0"
            >
              {isCurrentOrg ? "Active Workspace" : "Enter Workspace →"}
            </Button>
            <Dropdown
              align="right"
              trigger={
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 flex items-center justify-center rounded-lg border-border hover:bg-surface-hover hover:text-text cursor-pointer transition-colors shrink-0"
                  title="Row Actions"
                >
                  <svg className="h-4 w-4 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                  </svg>
                </Button>
              }
              items={[
                {
                  label: "Edit Details",
                  onClick: () => handleOpenEditModal(org),
                },
                {
                  label: isInactive ? "Activate Workspace" : "Suspend Workspace",
                  variant: isInactive ? "default" : "warning",
                  onClick: () => handleToggleOrgStatus(org),
                },
                {
                  label: "Delete Organization",
                  variant: "danger",
                  onClick: () => handleOpenDeleteModal(org),
                },
              ]}
            />
          </div>
        );
      },
    },
  ];

  if (user?.role !== "root") {
    return (
      <div className="p-8 text-center space-y-3 max-w-md mx-auto">
        <h2 className="text-lg font-bold text-text">Access Restricted</h2>
        <p className="text-xs text-text-secondary">
          Only Root Super Admin accounts can view and manage all platform organizations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full font-sans text-text antialiased animate-fade-in pb-8">
      {/* Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 sm:p-5 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight">Organizations & Tenants</h1>
            <Badge variant="primary" size="sm" className="font-extrabold text-[10px] uppercase">
              Root Super Admin
            </Badge>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Manage multi-tenant healthcare organizations, subscription quotas, and active workspace contexts.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          className="font-bold rounded-xl shadow-xs shrink-0 cursor-pointer"
          onClick={() => {
            setWizardStep(1);
            setIsModalOpen(true);
          }}
        >
          + Create Organization
        </Button>
      </div>

      {/* KPI Stats Summary Cards using Design System StatCard Component */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          title="Total Workspaces"
          value={stats.total}
          description={`${stats.active} Active · ${stats.inactive} Suspended`}
        />
        <StatCard
          title="Starter Tier"
          value={stats.starterCount}
          description="Single-Clinic Tier"
        />
        <StatCard
          title="Pro Tier"
          value={stats.proCount}
          description="Multi-Branch Clinics"
        />
        <StatCard
          title="Enterprise Tier"
          value={stats.enterpriseCount}
          description="Unlimited Capacity"
        />
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-2xl border border-border">
        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: "all", label: `All (${stats.total})` },
            { id: "active", label: `Active (${stats.active})` },
            { id: "inactive", label: `Suspended (${stats.inactive})` },
            { id: "starter", label: `Starter (${stats.starterCount})` },
            { id: "pro", label: `Pro (${stats.proCount})` },
            { id: "enterprise", label: `Enterprise (${stats.enterpriseCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer",
                activeTab === tab.id
                  ? "bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/30"
                  : "text-text-secondary hover:text-text hover:bg-surface-hover"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="w-full sm:w-64">
          <Input
            placeholder="Search by name or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-xs h-9"
          />
        </div>
      </div>

      {/* Organizations Table Card (Desktop) & Responsive Cards (Mobile) */}
      <Card className="rounded-2xl border border-border bg-surface overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center">
              <Spinner size="md" label="Loading platform organizations..." />
            </div>
          ) : filteredOrganizations.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-text-muted text-xs font-semibold">No organizations match the selected criteria.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setActiveTab("all");
                }}
                className="rounded-xl font-bold cursor-pointer"
              >
                Clear Search & Filters
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden sm:block">
                <Table columns={tableColumns} data={filteredOrganizations} searchable={false} />
              </div>

              {/* Mobile Card List View */}
              <div className="block sm:hidden divide-y divide-border">
                {filteredOrganizations.map((org) => {
                  const isCurrentOrg = user?.organization_id === org.id;
                  const isInactive = org.status === "inactive" || org.isActive === false;
                  const plan = org.plan || "starter";

                  return (
                    <div key={org.id} className="p-4 space-y-3 bg-surface">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-text text-sm">{org.name}</span>
                            {isCurrentOrg && (
                              <Badge variant="primary" size="sm" className="text-[8px] px-1 py-0 uppercase">
                                Active
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-text-muted">{org.email || "No email listed"}</p>
                        </div>
                        <Badge
                          variant={plan === "enterprise" ? "primary" : plan === "pro" ? "info" : "secondary"}
                          size="sm"
                          className="uppercase text-[9px] font-extrabold"
                        >
                          {plan}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-xs text-text-secondary pt-1">
                        <span>City: <strong>{org.city}</strong></span>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${isInactive ? "bg-red-500" : "bg-emerald-500"}`} />
                          <span>{isInactive ? "Suspended" : "Active"}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                        <Button
                          variant={isCurrentOrg ? "secondary" : "outline"}
                          size="sm"
                          loading={switchingId === org.id}
                          onClick={() => handleEnterWorkspace(org.id, org.name)}
                          className="text-xs font-semibold rounded-lg w-full"
                        >
                          {isCurrentOrg ? "Active Workspace" : "Enter Workspace →"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal: 2-Step Responsive Create Organization Wizard */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Tenant Organization"
        description="Provision a new healthcare organization workspace and administrator."
      >
        {/* Wizard Step Progress Bar */}
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4 text-xs font-bold">
          <div className={`flex items-center gap-2 ${wizardStep === 1 ? "text-primary-600 dark:text-primary-400" : "text-text-muted"}`}>
            <span className="w-5 h-5 rounded-full bg-primary-500/20 flex items-center justify-center text-[10px]">1</span>
            <span>Organization & Tier</span>
          </div>
          <div className="h-0.5 flex-1 mx-3 bg-border" />
          <div className={`flex items-center gap-2 ${wizardStep === 2 ? "text-primary-600 dark:text-primary-400" : "text-text-muted"}`}>
            <span className="w-5 h-5 rounded-full bg-primary-500/20 flex items-center justify-center text-[10px]">2</span>
            <span>Administrator & Options</span>
          </div>
        </div>

        <form onSubmit={handleCreateOrganizationSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* STEP 1: Organization & Subscription Tier */}
          {wizardStep === 1 && (
            <div className="space-y-4 animate-fade-in">
              <Input
                label="Organization Name *"
                placeholder="e.g. Apollo Healthcare System"
                value={formData.orgName}
                onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
                required
              />

              {/* Subscription Tier Radio Cards */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text">Subscription Plan Tier *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: "starter", title: "Starter", desc: "1 Clinic · 2 Doctors · 5 Staff" },
                    { id: "pro", title: "Pro", desc: "5 Clinics · 15 Doctors · Multi-Branch" },
                    { id: "enterprise", title: "Enterprise", desc: "Unlimited Capacity · Dedicated AI" },
                  ].map((tier) => (
                    <button
                      type="button"
                      key={tier.id}
                      onClick={() => setFormData({ ...formData, plan: tier.id as any })}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all cursor-pointer",
                        formData.plan === tier.id
                          ? "border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400 font-bold shadow-xs"
                          : "border-border hover:bg-surface-hover text-text-secondary"
                      )}
                    >
                      <p className="text-xs font-bold uppercase">{tier.title}</p>
                      <p className="text-[10px] opacity-80 mt-1 leading-snug">{tier.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="City *"
                  placeholder="e.g. San Francisco"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                />
                <Input
                  label="Contact Email"
                  type="email"
                  placeholder="contact@apollo.health"
                  value={formData.orgEmail}
                  onChange={(e) => setFormData({ ...formData, orgEmail: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Tax ID / GSTIN (Optional)"
                  placeholder="22AAAAA0000A1Z5"
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                />
                <Input
                  label="License No. (Optional)"
                  placeholder="HOSP-REG-2026-8901"
                  value={formData.licenseNumber}
                  onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label="Currency"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  options={[
                    { value: "INR", label: "INR (₹)" },
                    { value: "USD", label: "USD ($)" },
                    { value: "EUR", label: "EUR (€)" },
                    { value: "GBP", label: "GBP (£)" },
                    { value: "AED", label: "AED (د.إ)" },
                  ]}
                />

                <Select
                  label="Operating Timezone"
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  options={[
                    { value: "Asia/Kolkata", label: "Asia/Kolkata (IST +5:30)" },
                    { value: "America/New_York", label: "America/New_York (EST -5:00)" },
                    { value: "Europe/London", label: "Europe/London (GMT +0:00)" },
                    { value: "Asia/Dubai", label: "Asia/Dubai (GST +4:00)" },
                  ]}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={!formData.orgName.trim() || !formData.city.trim()}
                  onClick={() => setWizardStep(2)}
                  className="font-bold rounded-xl"
                >
                  Configure Administrator →
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Administrator & Primary Branch */}
          {wizardStep === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-3 bg-surface-alt rounded-xl border border-border space-y-1">
                <p className="text-xs font-bold text-text">Primary Hospital / Clinic Branch</p>
                <Input
                  placeholder={formData.orgName ? `${formData.orgName} (Main Branch)` : "Main Clinic Branch Name"}
                  value={formData.clinicName}
                  onChange={(e) => setFormData({ ...formData, clinicName: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-3 border-t border-border pt-3">
                <p className="text-xs font-bold text-text">Organization Administrator Account</p>
                <Input
                  label="Administrator Name *"
                  placeholder="Dr. Jay Patel"
                  value={formData.adminName}
                  onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                  required
                />
                <Input
                  label="Administrator Email *"
                  type="email"
                  placeholder="admin@apollo.health"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  hint="Each organization administrator must have a unique email address."
                  required
                />
                <div>
                  <Input
                    label="Administrator Password *"
                    type={showAdminPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={formData.adminPassword}
                    onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                    minLength={6}
                    required
                  />
                  <div className="flex justify-between items-center pt-1.5">
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="text-[11px] font-semibold text-text-muted hover:text-text cursor-pointer"
                    >
                      {showAdminPassword ? "Hide password" : "Show password"}
                    </button>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="text-[11px] font-bold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
                    >
                      + Generate Secure Password
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <Checkbox
                    id="sendWelcomeEmailToggle"
                    checked={formData.sendWelcomeEmail}
                    onChange={(e) => setFormData({ ...formData, sendWelcomeEmail: e.target.checked })}
                    label="Send automated welcome email with login portal URL & credentials"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setWizardStep(1)}>
                  ← Back
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" loading={submitting} className="font-bold rounded-xl">
                    Create & Provision Workspace
                  </Button>
                </div>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Modal: Post-Creation Credentials Summary */}
      <Modal
        open={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        title="Workspace Provisioned Successfully"
        description="Save or copy the administrator login credentials below."
      >
        <div className="space-y-4 pt-1">
          {createdCredentialsSummary && (
            <div className="space-y-3">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-extrabold text-emerald-700 dark:text-emerald-400 text-sm">
                    {createdCredentialsSummary.orgName}
                  </p>
                  <Badge variant="success" size="sm" className="text-[9px] font-extrabold uppercase">
                    Provisioned
                  </Badge>
                </div>
                <p className="text-xs text-text-secondary">
                  Primary administrator account created and linked to workspace.
                </p>
              </div>

              <div className="space-y-2 bg-surface-alt p-3.5 rounded-xl border border-border text-xs">
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-text-muted">Login Portal URL:</span>
                  <span className="font-bold text-text select-all">{createdCredentialsSummary.loginUrl}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-text-muted">Administrator Email:</span>
                  <span className="font-bold text-text select-all">{createdCredentialsSummary.adminEmail}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-text-muted">Administrator Password:</span>
                  <span className="font-mono font-bold text-primary-600 dark:text-primary-400 select-all">
                    {createdCredentialsSummary.adminPassword}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyCredentials}
              className="font-bold rounded-xl"
            >
              📋 Copy Credentials
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setIsSummaryModalOpen(false)}
              className="font-bold rounded-xl"
            >
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Edit Organization */}
      <Modal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Organization Details"
        description="Update subscription plan tier, name, or contact details."
      >
        <form onSubmit={handleUpdateOrganization} className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1">
          <Input
            label="Organization Name *"
            value={editFormData.name}
            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
            required
          />

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text">Subscription Plan Tier *</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "starter", title: "Starter", desc: "1 Clinic, 2 Docs" },
                { id: "pro", title: "Pro", desc: "5 Clinics, 15 Docs" },
                { id: "enterprise", title: "Enterprise", desc: "Unlimited" },
              ].map((tier) => (
                <button
                  type="button"
                  key={tier.id}
                  onClick={() => setEditFormData({ ...editFormData, plan: tier.id as any })}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    editFormData.plan === tier.id
                      ? "border-primary-500 bg-primary-500/10 text-primary-600 font-bold"
                      : "border-border hover:bg-surface-hover text-text-secondary"
                  }`}
                >
                  <p className="text-xs font-bold capitalize">{tier.title}</p>
                  <p className="text-[10px] opacity-80 mt-0.5">{tier.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="City *"
              value={editFormData.city}
              onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
              required
            />
            <Input
              label="Contact Email"
              type="email"
              value={editFormData.email}
              onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Tax ID / GSTIN"
              value={editFormData.taxId}
              onChange={(e) => setEditFormData({ ...editFormData, taxId: e.target.value })}
            />
            <Input
              label="License Number"
              value={editFormData.licenseNumber}
              onChange={(e) => setEditFormData({ ...editFormData, licenseNumber: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={updating} className="font-bold rounded-xl">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Delete Organization Confirmation */}
      <Modal
        open={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Organization"
        description="Are you sure you want to delete this organization? This action cannot be undone."
      >
        <div className="space-y-4 pt-1">
          {deletingOrg && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs space-y-1">
              <p className="font-bold text-red-600 dark:text-red-400 text-sm">{deletingOrg.name}</p>
              <p className="text-text-secondary">City: {deletingOrg.city} · Plan: {deletingOrg.plan?.toUpperCase()}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" size="sm" loading={deleting} onClick={handleDeleteOrganization} className="font-bold rounded-xl">
              Delete Organization
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
