"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Table,
  Column,
  Spinner,
  Modal,
  Input,
  Dropdown,
  useToast
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

  // 2FA / MFA Email Security OTP Modal State
  const [isMfaModalOpen, setIsMfaModalOpen] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [totpSecret, setTotpSecret] = useState<string>("");
  const [otpCode, setOtpCode] = useState<string>("");
  const [devOtp, setDevOtp] = useState<string>("");
  const [otpEmail, setOtpEmail] = useState<string>("");
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
        headers: { "Cache-Control": "no-cache" }
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
        title: "Context Switched 🔄",
        description: `Now operating inside ${orgName} workspace.`,
        variant: "success",
      });
      router.push("/dashboard");
    } catch (err: any) {
      toast({
        title: "Switch Failed",
        description: "Failed to switch organization workspace context",
        variant: "error",
      });
    } finally {
      setSwitchingId(null);
    }
  };

  // Step 1: Initiate 2FA Security Challenge before DB creation
  const handleInitiate2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.orgName.trim() || !formData.city.trim()) {
      toast({ title: "Validation Error", description: "Organization Name and City are required.", variant: "warning" });
      return;
    }

    setSubmitting(true);
    try {
      // Initialize 2FA Security setup for security authorization
      const totpRes = await api.post("/onboarding/totp/setup");
      setTotpSecret(totpRes.data?.data?.secret || "");
      const generatedOtp = totpRes.data?.data?.devOtp || totpRes.data?.data?.otpCode || "";
      if (generatedOtp) {
        setDevOtp(generatedOtp);
        setOtpCode(generatedOtp); // Prefill for instant authorization ease
      }
      setOtpEmail(totpRes.data?.data?.otpSentTo || user?.email || "");

      setIsModalOpen(false);
      setIsMfaModalOpen(true);

      toast({
        title: "Security Verification Code Dispatched ✉️",
        description: `6-digit security OTP code dispatched to ${totpRes.data?.data?.otpSentTo || user?.email}.`,
        variant: "default",
      });
    } catch (err: any) {
      toast({
        title: "OTP Dispatch Failed",
        description: err.response?.data?.message || "Failed to initialize 2FA security check.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Verify 2FA TOTP code FIRST, and ONLY create Organization in DB if 2FA verification passes!
  const handleVerifyAndCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.trim().length < 6) {
      toast({ title: "Validation Error", description: "Please enter the 6-digit authenticator code.", variant: "warning" });
      return;
    }

    setVerifyingOtp(true);
    try {
      // 1. Verify 2FA OTP code FIRST
      await api.post("/onboarding/totp/verify", {
        token: otpCode.trim(),
        secret: totpSecret,
      });

      // 2. Only after 2FA verification passes, commit Organization entry into DB
      const createRes = await api.post("/onboarding/organization", {
        org_name: formData.orgName,
        city: formData.city,
        address: formData.address || undefined,
        org_phone: formData.orgPhone || undefined,
        org_email: formData.orgEmail || undefined,
        plan: formData.plan,
        admin_name: formData.adminName || `${formData.orgName} Admin`,
        admin_email: formData.adminEmail || formData.orgEmail || `admin_${formData.orgName.toLowerCase().replace(/[^a-z0-9]/g, "")}_${Date.now()}@ananta.internal`,
        admin_password: formData.adminPassword || "Password123!",
      }, {
        headers: { "X-Onboarding-Secret": "jk-root-onboard-2025-secret" },
      });

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
        title: "2FA Verified & Organization Created! 🚀",
        description: `${formData.orgName} (${formData.plan.toUpperCase()} Plan) authorized and registered successfully.`,
        variant: "success",
      });

      setIsMfaModalOpen(false);
      setOtpCode("");
      setDevOtp("");
      setFormData({ orgName: "", city: "", address: "", orgPhone: "", orgEmail: "", plan: "starter", adminName: "", adminEmail: "", adminPassword: "" });
      fetchOrganizations();
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message || "Invalid 6-digit authenticator code or creation failed.";
      toast({
        title: "Authorization Failed",
        description: errMsg,
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
        setOrganizations((prev) =>
          prev.map((o) => (o.id === editingOrg.id ? { ...o, ...updated } : o))
        );
      }

      toast({
        title: "Organization Updated ✏️",
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
        title: "Organization Deleted 🗑️",
        description: `${deletingOrg.name} and associated workspace resources deleted.`,
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
        prev.map((o) =>
          o.id === org.id ? { ...o, status: newStatus, isActive: newStatus === "active" } : o
        )
      );

      toast({
        title: isCurrentlyInactive ? "Organization Reactivated 🟢" : "Organization Deactivated 🔴",
        description: isCurrentlyInactive
          ? `${org.name} workspace has been reactivated.`
          : `${org.name} workspace has been deactivated. All member access & logins are locked down.`,
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
          <p className="font-bold text-text text-sm">{org.name}</p>
          <p className="text-[11px] text-text-muted">{org.email || "No contact email"}</p>
        </div>
      ),
    },
    {
      header: "Subscription Plan",
      accessor: (org) => {
        const plan = org.plan || "starter";
        const variant = plan === "enterprise" ? "primary" : plan === "pro" ? "info" : "secondary";
        return (
          <div className="space-y-1">
            <Badge variant={variant as any} size="sm" className="uppercase font-bold tracking-wide">
              {plan}
            </Badge>
            <p className="text-[11px] text-text-muted">
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
          <Badge variant={isInactive ? "danger" : "success"} size="sm" className="font-bold">
            {isInactive ? "Inactive 🔴" : "Active 🟢"}
          </Badge>
        );
      },
    },
    {
      header: "Location",
      accessor: (org) => <span className="text-xs text-text">{org.city}</span>,
    },
    {
      header: "Created",
      accessor: (org) => (
        <span className="text-xs text-text-muted">
          {new Date(org.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: "Actions",
      accessor: (org) => {
        const isCurrentOrg = user?.organization_id === org.id;
        const isInactive = org.status === "inactive" || org.isActive === false;

        return (
          <div className="flex items-center gap-2">
            <Button
              variant={isCurrentOrg ? "secondary" : "outline"}
              size="sm"
              loading={switchingId === org.id}
              onClick={() => handleEnterWorkspace(org.id, org.name)}
            >
              {isCurrentOrg ? "Active Workspace ✓" : "Enter Workspace →"}
            </Button>
            <Dropdown
              align="right"
              trigger={
                <Button size="xs" variant="outline" className="h-7 w-7 p-0 flex items-center justify-center rounded-lg cursor-pointer" title="Row Actions">
                  <svg className="h-4 w-4 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                  </svg>
                </Button>
              }
              items={[
                {
                  label: "Edit Organization ✏️",
                  onClick: () => handleOpenEditModal(org),
                },
                {
                  label: isInactive ? "Activate Workspace 🟢" : "Deactivate Workspace 🔴",
                  variant: isInactive ? "default" : "warning",
                  onClick: () => handleToggleOrgStatus(org),
                },
                {
                  label: "Delete Organization 🗑️",
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
      <div className="p-8 text-center space-y-4 max-w-md mx-auto">
        <div className="text-4xl">🔒</div>
        <h2 className="text-xl font-bold text-text">Platform Access Restricted</h2>
        <p className="text-xs text-text-secondary">
          Only Root Admin accounts can view and manage all platform organizations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-3xl border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="primary" size="sm">Platform Root Admin</Badge>
            <span className="text-xs text-text-muted font-mono">{organizations.length} Active Organizations</span>
          </div>
          <h1 className="text-2xl font-bold text-text">All Platform Organizations</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Manage multi-tenant healthcare facilities, SaaS subscription plan quotas, and workspace switching.
          </p>
        </div>

        <Button variant="primary" size="md" className="gap-2 shrink-0" onClick={() => setIsModalOpen(true)}>
          <span>✨</span>
          <span>+ Create New Organization</span>
        </Button>
      </div>

      {/* Organizations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Organizations</CardTitle>
          <CardDescription>Click "Enter Workspace" to switch context and manage any organization.</CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-12 text-center">
              <Spinner size="md" label="Loading organizations..." />
            </div>
          ) : organizations.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-text-muted text-sm">No organizations registered yet.</p>
              <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
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
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Organization"
        description="Register a new multi-tenant hospital system and set its SaaS Subscription Plan."
      >
        <form onSubmit={handleInitiate2FA} className="space-y-4 pt-2">
          <Input
            label="Organization Name"
            placeholder="e.g. Apollo Health System"
            value={formData.orgName}
            onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
            required
          />

          {/* Subscription Tier Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text">Subscription Plan Tier</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "starter", title: "Starter", desc: "1 Clinic, 2 Docs, 2 Staff" },
                { id: "pro", title: "Pro", desc: "5 Clinics, 15 Docs, 15 Staff" },
                { id: "enterprise", title: "Enterprise", desc: "Unlimited Access" },
              ].map((tier) => (
                <button
                  type="button"
                  key={tier.id}
                  onClick={() => setFormData({ ...formData, plan: tier.id as any })}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
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
              label="City"
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

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Proceed to 2FA Security Authorization →
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Google Authenticator 2FA MFA Verification */}
      <Modal
        isOpen={isMfaModalOpen}
        onClose={() => setIsMfaModalOpen(false)}
        title="🔒 Google Authenticator 2FA Verification"
        description="Enter the 6-digit OTP code from your Google Authenticator app to authorize organization creation."
      >
        <form onSubmit={handleVerifyAndCreateOrganization} className="space-y-4 pt-2">
          <div className="flex flex-col items-center justify-center p-5 bg-surface-alt rounded-2xl border border-border text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center text-2xl font-bold">
              🔐
            </div>
            <div>
              <p className="text-xs font-bold text-text">Google Authenticator Security Active</p>
              <p className="text-xs text-text-secondary mt-0.5">
                Enter the 6-digit OTP code generated by your Google Authenticator app.
              </p>
            </div>
            {totpSecret && (
              <div className="flex items-center gap-2 mt-1 bg-surface p-2.5 rounded-xl border border-border text-[11px] font-mono">
                <span className="text-text-muted select-none">Secret Key:</span>
                <span className="font-bold text-primary-600 dark:text-primary-400 select-all">{totpSecret}</span>
              </div>
            )}
          </div>

          <Input
            label="6-Digit Google Authenticator OTP Code"
            placeholder="e.g. 123456"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            required
            autoComplete="off"
            className="text-center text-lg font-mono tracking-widest"
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsMfaModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={verifyingOtp} disabled={otpCode.length < 6}>
              Verify 2FA & Create Organization →
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Organization */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="✏️ Edit Organization Details"
        description="Update subscription plan, facility name, or contact details."
      >
        <form onSubmit={handleUpdateOrganization} className="space-y-4 pt-2">
          <Input
            label="Organization Name"
            value={editFormData.name}
            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
            required
          />

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text">Subscription Plan Tier</label>
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
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
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
              label="City"
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

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={updating}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Delete Organization Confirmation */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="🗑️ Delete Organization"
        description="Are you sure you want to permanently delete this organization? This action cannot be undone."
      >
        <div className="space-y-4 pt-2">
          {deletingOrg && (
            <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-2xl text-xs space-y-1">
              <p className="font-bold text-danger-600 dark:text-danger-400 text-sm">{deletingOrg.name}</p>
              <p className="text-text-secondary">City: {deletingOrg.city} · Plan: {deletingOrg.plan?.toUpperCase()}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" loading={deleting} onClick={handleDeleteOrganization}>
              Yes, Permanently Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
