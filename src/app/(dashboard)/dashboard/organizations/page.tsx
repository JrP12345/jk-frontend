"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Table,
  Column,
  Spinner,
  Modal,
  Input,
  Dropdown,
  useToast,
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
  createdAt: string;
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  // Create New Organization Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    orgName: "",
    city: "",
    address: "",
    orgPhone: "",
    orgEmail: "",
    plan: "starter" as "starter" | "pro" | "enterprise",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });

  // 2FA Security OTP Modal State
  const [isMfaModalOpen, setIsMfaModalOpen] = useState(false);
  const [totpSecret, setTotpSecret] = useState<string>("");
  const [otpCode, setOtpCode] = useState<string>("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);

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

  const handleInitiate2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.orgName.trim() || !formData.city.trim() || !formData.adminName.trim() || !formData.adminEmail.trim() || !formData.adminPassword) {
      toast({ title: "Validation Error", description: "Organization, administrator name, administrator email, and administrator password are required.", variant: "warning" });
      return;
    }

    setSubmitting(true);
    try {
      const totpRes = await api.post("/onboarding/totp/setup");
      setTotpSecret(totpRes.data?.data?.secret || "");
      setOtpCode(""); // Leave blank so user performs real 2FA verification from Google Authenticator

      setIsModalOpen(false);
      setIsMfaModalOpen(true);
    } catch (err: any) {
      toast({
        title: "2FA Setup Failed",
        description: err.response?.data?.message || "Failed to initialize security authorization.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyAndCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.trim().length < 6) {
      toast({ title: "Validation Error", description: "Please enter the 6-digit authenticator code.", variant: "warning" });
      return;
    }

    setVerifyingOtp(true);
    try {
      await api.post("/onboarding/totp/verify", {
        token: otpCode.trim(),
        secret: totpSecret,
      });

      const createRes = await api.post(
        "/onboarding/organization",
        {
          org_name: formData.orgName,
          city: formData.city,
          address: formData.address || undefined,
          org_phone: formData.orgPhone || undefined,
          org_email: formData.orgEmail || undefined,
          plan: formData.plan,
          admin_name: formData.adminName,
          admin_email: formData.adminEmail,
          admin_password: formData.adminPassword,
        },
        {
          headers: undefined,
        }
      );

      const createdOrg = createRes.data?.data?.organization;
      if (createdOrg) {
        setOrganizations((prev) => [
          {
            id: createdOrg.id,
            name: createdOrg.name || formData.orgName,
            city: createdOrg.city || formData.city,
            address: formData.address,
            email: formData.orgEmail,
            phone: formData.orgPhone,
            plan: formData.plan,
            createdAt: new Date().toISOString(),
          },
          ...prev.filter((o) => o.id !== createdOrg.id),
        ]);
      }

      toast({
        title: "Organization Created",
        description: `${formData.orgName} (${formData.plan.toUpperCase()} Plan) registered successfully.`,
        variant: "success",
      });

      setIsMfaModalOpen(false);
      setOtpCode("");
      setFormData({
        orgName: "",
        city: "",
        address: "",
        orgPhone: "",
        orgEmail: "",
        plan: "starter",
        adminName: "",
        adminEmail: "",
        adminPassword: "",
      });
      fetchOrganizations();
    } catch (err: any) {
      toast({
        title: "Authorization Failed",
        description: err.response?.data?.message || "Invalid authenticator code or creation failed.",
        variant: "error",
      });
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Edit & Delete Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    city: "",
    address: "",
    phone: "",
    email: "",
    plan: "starter" as "starter" | "pro" | "enterprise",
  });
  const [updating, setUpdating] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingOrg, setDeletingOrg] = useState<Organization | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleOpenEditModal = (org: Organization) => {
    setEditingOrg(org);
    setEditFormData({
      name: org.name || "",
      city: org.city || "",
      address: org.address || "",
      phone: org.phone || "",
      email: org.email || "",
      plan: org.plan || "starter",
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
      header: "Organization",
      accessor: (org) => (
        <div className="space-y-0.5">
          <p className="font-bold text-text text-xs sm:text-sm">{org.name}</p>
          <p className="text-[11px] text-text-muted">{org.email || "No email listed"}</p>
        </div>
      ),
    },
    {
      header: "Plan",
      accessor: (org) => {
        const plan = org.plan || "starter";
        const variant = plan === "enterprise" ? "primary" : plan === "pro" ? "info" : "secondary";
        return (
          <div className="space-y-0.5">
            <Badge variant={variant as any} size="sm" className="uppercase font-extrabold text-[9px] tracking-wider">
              {plan}
            </Badge>
            <p className="text-[10px] text-text-muted">
              {org.maxClinics ?? 1} Branch · {org.maxDoctors ?? 2} Doctors · {org.maxStaff ?? 2} Staff
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
              {isInactive ? "Inactive" : "Active"}
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
                  label: isInactive ? "Activate Workspace" : "Deactivate Workspace",
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
          Only Root Admin accounts can view and manage all platform organizations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full font-sans text-text antialiased animate-fade-in pb-8">
      {/* Clean Enterprise Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 sm:p-5 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight">Organizations</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Manage multi-tenant organizations, subscription plans, and active workspaces.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          className="font-bold rounded-xl shadow-xs shrink-0 cursor-pointer"
          onClick={() => setIsModalOpen(true)}
        >
          + Create Organization
        </Button>
      </div>

      {/* Organizations Table Card */}
      <Card className="rounded-2xl border border-border bg-surface">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center">
              <Spinner size="md" label="Loading organizations..." />
            </div>
          ) : organizations.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-text-muted text-xs font-semibold">No organizations registered yet.</p>
              <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)} className="rounded-xl font-bold cursor-pointer">
                Create First Organization →
              </Button>
            </div>
          ) : (
            <Table
              columns={tableColumns}
              data={organizations}
              searchable={true}
              searchPlaceholder="Search organizations by name or city..."
            />
          )}
        </CardContent>
      </Card>

      {/* Modal: Create New Organization Form */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Organization"
        description="Set organization details and subscription tier."
      >
        <form onSubmit={handleInitiate2FA} className="space-y-4 pt-1">
          <Input
            label="Organization Name *"
            placeholder="e.g. Apollo Health System"
            value={formData.orgName}
            onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
            required
          />

          {/* Subscription Tier Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text">Subscription Tier *</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "starter", title: "Starter", desc: "1 Clinic, 2 Docs" },
                { id: "pro", title: "Pro", desc: "5 Clinics, 15 Docs" },
                { id: "enterprise", title: "Enterprise", desc: "Unlimited" },
              ].map((tier) => (
                <button
                  type="button"
                  key={tier.id}
                  onClick={() => setFormData({ ...formData, plan: tier.id as any })}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    formData.plan === tier.id
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
              placeholder="e.g. San Francisco"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              required
            />
            <Input
              label="Contact Email"
              type="email"
              placeholder="contact@hospital.com"
              value={formData.orgEmail}
              onChange={(e) => setFormData({ ...formData, orgEmail: e.target.value })}
            />
          </div>
          <Input
            label="Address"
            placeholder="123 Health Ave"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
          <Input
            label="Contact Phone"
            placeholder="+1 234 567 890"
            value={formData.orgPhone}
            onChange={(e) => setFormData({ ...formData, orgPhone: e.target.value })}
          />

          <div className="border-t border-border/40 pt-3 space-y-3">
            <p className="text-xs font-bold text-text">Organization Administrator</p>
            <Input label="Administrator Name *" value={formData.adminName} onChange={(e) => setFormData({ ...formData, adminName: e.target.value })} required />
            <Input label="Administrator Email *" type="email" value={formData.adminEmail} onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })} required />
            <Input label="Administrator Password *" type="password" value={formData.adminPassword} onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })} minLength={6} required />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={submitting} className="font-bold rounded-xl">
              Proceed to Security Verification →
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Google Authenticator 2FA Verification */}
      <Modal
        open={isMfaModalOpen}
        onClose={() => setIsMfaModalOpen(false)}
        title="Security Verification"
        description="Enter the 6-digit OTP code generated by your authenticator app."
      >
        <form onSubmit={handleVerifyAndCreateOrganization} className="space-y-4 pt-1">
          <div className="flex flex-col items-center justify-center p-4 bg-surface-alt rounded-2xl border border-border text-center space-y-2">
            <div>
              <p className="text-xs font-bold text-text">Authenticator Verification Required</p>
              <p className="text-[11px] text-text-muted mt-0.5">
                Enter the 6-digit security code from your Google Authenticator app.
              </p>
            </div>
            {totpSecret && (
              <div className="flex items-center gap-2 mt-1 bg-surface p-2 rounded-xl border border-border text-[10px] font-mono">
                <span className="text-text-muted select-none">Secret:</span>
                <span className="font-bold text-primary-600 dark:text-primary-400 select-all">{totpSecret}</span>
              </div>
            )}
          </div>

          <Input
            label="6-Digit Authenticator Code *"
            placeholder="123456"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            required
            autoComplete="off"
            className="text-center text-lg font-mono tracking-widest"
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsMfaModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={verifyingOtp} disabled={otpCode.length < 6} className="font-bold rounded-xl">
              Verify & Create Organization →
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Organization */}
      <Modal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Organization Details"
        description="Update subscription plan tier, name, or contact details."
      >
        <form onSubmit={handleUpdateOrganization} className="space-y-4 pt-1">
          <Input
            label="Organization Name *"
            value={editFormData.name}
            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
            required
          />

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text">Subscription Tier *</label>
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
          <Input
            label="Address"
            value={editFormData.address}
            onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
          />
          <Input
            label="Contact Phone"
            value={editFormData.phone}
            onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
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

          <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
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
