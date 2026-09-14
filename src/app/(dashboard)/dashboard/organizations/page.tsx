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
import ImageUpload from "@/components/ui/ImageUpload";
import { useR2Upload } from "@/hooks/useR2Upload";
import {
  Building2,
  ShieldCheck,
  Crown,
  RotateCw,
  Plus,
  Search,
  ArrowRight,
  ArrowLeft,
  MoreHorizontal,
  Edit3,
  Trash2,
  KeyRound,
  Copy,
  Check,
  CheckCircle2,
  MapPin,
  Mail,
  Phone,
  Shield,
  Layers,
  Eye,
  EyeOff,
  Users,
  UserCheck,
  Power,
  Zap,
  Sparkles,
} from "lucide-react";

interface Organization {
  id: string;
  name: string;
  city: string;
  address?: string;
  email?: string;
  phone?: string;
  logo_url?: string;
  images?: string[];
  image_url?: string;
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "active" | "inactive" | "starter" | "pro" | "enterprise">("all");

  // Create New Organization Modal State (2-Step Wizard)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [formData, setFormData] = useState({
    orgName: "",
    city: "",
    address: "",
    orgPhone: "",
    orgEmail: "",
    plan: "starter" as "starter" | "pro" | "enterprise",
    trialDays: 15,
    taxId: "",
    licenseNumber: "",
    currency: "INR",
    timezone: "Asia/Kolkata",
    adminName: "",
    adminEmail: "",
    adminPhone: "",
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
  const { uploadFile } = useR2Upload();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editFormData, setEditFormData] = useState<{
    name: string;
    city: string;
    address: string;
    phone: string;
    email: string;
    plan: "starter" | "pro" | "enterprise";
    taxId: string;
    licenseNumber: string;
    currency: string;
    timezone: string;
    logo_url: File | string | null;
    image_url: File | string | null;
  }>({
    name: "",
    city: "",
    address: "",
    phone: "",
    email: "",
    plan: "starter",
    taxId: "",
    licenseNumber: "",
    currency: "INR",
    timezone: "Asia/Kolkata",
    logo_url: null,
    image_url: null,
  });
  const [updating, setUpdating] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingOrg, setDeletingOrg] = useState<Organization | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { user, switchOrg, impersonate } = useAuthStore();
  const router = useRouter();
  const { toast } = useToast();

  const [membersModalOrg, setMembersModalOrg] = useState<Organization | null>(null);
  const [orgMembersList, setOrgMembersList] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      setIsRefreshing(true);
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
      setIsRefreshing(false);
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

  const handleLoginAsOrgAdmin = async (org: Organization) => {
    try {
      setImpersonatingUserId(org.id);
      await impersonate({ organizationId: org.id, role: "admin" });
      toast({
        title: "Workspace Entered as Admin",
        description: `Now logged in as Administrator for ${org.name}.`,
        variant: "success",
      });
      router.push("/dashboard");
    } catch (err: any) {
      toast({
        title: "Login Failed",
        description: err.response?.data?.message || "Failed to impersonate organization admin.",
        variant: "error",
      });
    } finally {
      setImpersonatingUserId(null);
    }
  };

  const handleOpenMembersModal = async (org: Organization) => {
    setMembersModalOrg(org);
    setLoadingMembers(true);
    try {
      const res = await api.get(`/onboarding/organizations/${org.id}/members`);
      setOrgMembersList(res.data?.data?.members || []);
    } catch (err: any) {
      toast({
        title: "Failed to load members",
        description: err.response?.data?.message || "Could not fetch members list.",
        variant: "error",
      });
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleImpersonateMember = async (member: any) => {
    try {
      setImpersonatingUserId(member.id);
      await impersonate({ userId: member.id });
      toast({
        title: "Session Switched",
        description: `Now signed in as ${member.name} (${member.role.toUpperCase()}) for ${membersModalOrg?.name}.`,
        variant: "success",
      });
      setMembersModalOrg(null);
      router.push("/dashboard");
    } catch (err: any) {
      toast({
        title: "Impersonation Failed",
        description: err.response?.data?.message || "Could not impersonate user.",
        variant: "error",
      });
    } finally {
      setImpersonatingUserId(null);
    }
  };

  const handleGeneratePassword = () => {
    const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lowers = "abcdefghijkmnopqrstuvwxyz";
    const numbers = "23456789";
    const specials = "!@#$%^&*";
    const all = uppers + lowers + numbers + specials;

    const passChars = [
      uppers[Math.floor(Math.random() * uppers.length)],
      lowers[Math.floor(Math.random() * lowers.length)],
      numbers[Math.floor(Math.random() * numbers.length)],
      specials[Math.floor(Math.random() * specials.length)],
    ];
    for (let i = passChars.length; i < 12; i++) {
      passChars.push(all[Math.floor(Math.random() * all.length)]);
    }
    const securePass = passChars.sort(() => 0.5 - Math.random()).join("");

    setFormData((prev) => ({ ...prev, adminPassword: securePass }));
    setShowAdminPassword(true);
    toast({
      title: "Password Generated",
      description: "Secure administrator password generated.",
      variant: "info",
    });
  };

  const handleCreateOrganizationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitting) return;

    if (
      !formData.orgName.trim() ||
      !formData.city.trim() ||
      !formData.adminName.trim() ||
      !formData.adminEmail.trim() ||
      !formData.adminPassword
    ) {
      toast({
        title: "Validation Error",
        description: "Organization name, city, admin name, admin email, and admin password are required.",
        variant: "warning",
      });
      return;
    }

    if (
      formData.adminPassword.length < 8 ||
      !/[A-Z]/.test(formData.adminPassword) ||
      !/[a-z]/.test(formData.adminPassword) ||
      !/[0-9]/.test(formData.adminPassword) ||
      !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.adminPassword)
    ) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 8 characters and include uppercase, lowercase, number, and a special character.",
        variant: "warning",
      });
      return;
    }

    if (/^[0-9+\s-]{6,}$/.test(formData.city.trim())) {
      toast({
        title: "Validation Error",
        description: "City appears to be a phone number. Please enter a valid city name (e.g. Mumbai, New York).",
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
        maxClinics: formData.plan === "enterprise" ? 99 : formData.plan === "pro" ? 5 : 1,
        maxDoctors: formData.plan === "enterprise" ? 999 : formData.plan === "pro" ? 15 : 2,
        maxStaff: formData.plan === "enterprise" ? 999 : formData.plan === "pro" ? 25 : 5,
        trialDays: formData.trialDays || 15,
        taxId: formData.taxId.trim() || undefined,
        licenseNumber: formData.licenseNumber.trim() || undefined,
        currency: formData.currency,
        timezone: formData.timezone,
        admin_name: formData.adminName.trim(),
        admin_email: formData.adminEmail.trim().toLowerCase(),
        admin_phone: formData.adminPhone.trim() ? formData.adminPhone.trim() : undefined,
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
        trialDays: 15,
        taxId: "",
        licenseNumber: "",
        currency: "INR",
        timezone: "Asia/Kolkata",
        adminName: "",
        adminEmail: "",
        adminPhone: "",
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
    const text = `ANANT Healthcare OS - Administrator Credentials\nOrganization: ${createdCredentialsSummary.orgName}\nLogin Portal: ${createdCredentialsSummary.loginUrl}\nEmail: ${createdCredentialsSummary.adminEmail}\nPassword: ${createdCredentialsSummary.adminPassword}`;
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
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
      plan: (org.plan as any) || "starter",
      taxId: org.taxId || "",
      licenseNumber: org.licenseNumber || "",
      currency: org.currency || "INR",
      timezone: org.timezone || "Asia/Kolkata",
      logo_url: org.logo_url || null,
      image_url: org.image_url || null,
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg) return;

    if (/^[0-9+\s-]{6,}$/.test(editFormData.city.trim())) {
      toast({
        title: "Validation Error",
        description: "City appears to be a phone number. Please enter a valid city name.",
        variant: "warning",
      });
      return;
    }

    setUpdating(true);
    try {
      let finalLogoUrl = editFormData.logo_url;
      let finalImageUrl = editFormData.image_url;

      if (finalLogoUrl instanceof File) {
        toast({ title: "Uploading...", description: "Uploading brand logo", variant: "default" });
        const res = await uploadFile(finalLogoUrl);
        finalLogoUrl = res.publicUrl;
      }

      if (finalImageUrl instanceof File) {
        toast({ title: "Uploading...", description: "Uploading cover image", variant: "default" });
        const res = await uploadFile(finalImageUrl);
        finalImageUrl = res.publicUrl;
      }

      const res = await api.put(`/organizations/${editingOrg.id}`, {
        name: editFormData.name,
        city: editFormData.city,
        address: editFormData.address || undefined,
        phone: editFormData.phone || undefined,
        email: editFormData.email || undefined,
        plan: editFormData.plan,
        maxClinics: editFormData.plan === "enterprise" ? 99 : editFormData.plan === "pro" ? 5 : 1,
        maxDoctors: editFormData.plan === "enterprise" ? 999 : editFormData.plan === "pro" ? 15 : 2,
        maxStaff: editFormData.plan === "enterprise" ? 999 : editFormData.plan === "pro" ? 25 : 5,
        taxId: editFormData.taxId || undefined,
        licenseNumber: editFormData.licenseNumber || undefined,
        currency: editFormData.currency,
        timezone: editFormData.timezone,
        logo_url: typeof finalLogoUrl === "string" ? finalLogoUrl : undefined,
        image_url: typeof finalImageUrl === "string" ? finalImageUrl : undefined,
      });

      const updated = res.data?.data;
      if (updated) {
        setOrganizations((prev) =>
          prev.map((o) => (o.id === editingOrg.id ? { ...o, ...updated } : o))
        );
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
        prev.map((o) =>
          o.id === org.id ? { ...o, status: newStatus, isActive: newStatus === "active" } : o
        )
      );

      toast({
        title: isCurrentlyInactive ? "Organization Reactivated" : "Organization Suspended",
        description: isCurrentlyInactive
          ? `${org.name} workspace has been reactivated.`
          : `${org.name} workspace access has been suspended.`,
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
      accessor: (org) => {
        const isCurrentOrg = user?.organization_id === org.id;
        const orgLogo = org.logo_url || org.image_url;
        return (
          <div className="flex items-center gap-3 min-w-[240px]">
            {orgLogo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={orgLogo}
                alt={org.name}
                className="w-10 h-10 rounded-xl object-cover border border-border/80 shadow-xs shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20 flex items-center justify-center font-bold text-sm shrink-0">
                {org.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-text text-xs sm:text-sm">{org.name}</span>
                {isCurrentOrg && (
                  <Badge variant="primary" size="sm" dot pulse className="text-[10px] font-bold">
                    Active Workspace
                  </Badge>
                )}
                {org.images && org.images.length > 0 && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-surface-alt text-text-muted border border-border/60">
                    📷 {org.images.length} photos
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span>{org.email || "No email listed"}</span>
                {org.taxId && <span>&bull; Tax ID: {org.taxId}</span>}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      header: "Plan & Capacity",
      accessor: (org) => {
        const plan = org.plan || "starter";
        const variant = plan === "enterprise" ? "primary" : plan === "pro" ? "info" : "secondary";
        return (
          <div className="space-y-1 min-w-[150px]">
            <div className="flex items-center gap-1.5">
              <Badge variant={variant as any} size="sm" className="uppercase font-bold text-[10px] tracking-wide">
                {plan}
              </Badge>
              <span className="text-[10px] text-text-muted font-bold px-1.5 py-0.5 rounded bg-surface-alt border border-border/60">
                {org.currency || "INR"}
              </span>
            </div>
            <p className="text-xs text-text-muted">
              {org.maxClinics ?? (plan === "enterprise" ? "Unlimited" : plan === "pro" ? 5 : 1)} Branches &bull;{" "}
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
          <Badge
            variant={isInactive ? "neutral" : "success"}
            size="sm"
            dot
            pulse={!isInactive}
            className="font-semibold text-[11px]"
          >
            {isInactive ? "Suspended" : "Active"}
          </Badge>
        );
      },
    },
    {
      header: "Location",
      accessor: (org) => (
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span>{org.city || "Not specified"}</span>
        </div>
      ),
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
              variant={isCurrentOrg ? "secondary" : "primary"}
              size="xs"
              loading={switchingId === org.id}
              onClick={() => handleEnterWorkspace(org.id, org.name)}
              className="text-xs font-semibold rounded-lg shrink-0 shadow-xs min-h-[36px]"
            >
              {isCurrentOrg ? "Active Workspace" : "Enter Workspace"}
              {!isCurrentOrg && <ArrowRight className="w-3.5 h-3.5 ml-1" />}
            </Button>
            <Dropdown
              align="right"
              width="w-48"
              trigger={
                <Button
                  size="xs"
                  variant="outline"
                  className="h-9 w-9 p-0 flex items-center justify-center rounded-lg text-text-secondary hover:text-text min-h-[36px] min-w-[36px]"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              }
              items={[
                {
                  label: "Login as Admin",
                  icon: <KeyRound className="w-4 h-4 text-amber-500" />,
                  onClick: () => handleLoginAsOrgAdmin(org),
                },
                {
                  label: "Members & Impersonate",
                  icon: <Users className="w-4 h-4 text-primary-500" />,
                  onClick: () => handleOpenMembersModal(org),
                },
                { divider: true, label: "" },
                {
                  label: "Edit Details",
                  icon: <Edit3 className="w-4 h-4 text-text-muted" />,
                  onClick: () => handleOpenEditModal(org),
                },
                {
                  label: isInactive ? "Reactivate Workspace" : "Suspend Workspace",
                  icon: <Power className={`w-4 h-4 ${isInactive ? "text-emerald-500" : "text-amber-500"}`} />,
                  onClick: () => handleToggleOrgStatus(org),
                },
                { divider: true, label: "" },
                {
                  label: "Delete Organization",
                  icon: <Trash2 className="w-4 h-4 text-danger" />,
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
      <div className="py-16 text-center space-y-4 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-surface-alt border border-border flex items-center justify-center mx-auto text-text-secondary">
          <Shield className="w-6 h-6 text-primary-500" />
        </div>
        <div>
          <h2 className="text-base font-bold text-text">Root Super-Admin Access Required</h2>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            Only platform super-administrators can view and manage multi-tenant organizations across the system.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/dashboard")}
          className="rounded-xl font-semibold"
        >
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full font-sans text-text antialiased animate-fade-up pb-32 sm:pb-12">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. EXECUTIVE TOP BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-500/30 before:to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                Organizations & Tenants
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                Root Super Admin
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Multi-tenant healthcare organizations, subscription quotas, and active workspace contexts.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchOrganizations}
              disabled={isRefreshing}
              className="w-full sm:w-auto min-h-[42px] sm:min-h-[36px] rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors justify-center"
            >
              <RotateCw className={`h-3.5 w-3.5 mr-1.5 text-text-secondary ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button
              variant="primary"
              size="sm"
              className="w-full sm:w-auto min-h-[42px] sm:min-h-[36px] font-semibold rounded-xl shadow-xs justify-center"
              onClick={() => {
                setWizardStep(1);
                setIsModalOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Create Org
            </Button>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. KPI PLATFORM METRICS
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Workspaces"
          value={stats.total.toString()}
          description={`${stats.active} Active · ${stats.inactive} Suspended`}
          icon={<Building2 className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Starter Tier"
          value={stats.starterCount.toString()}
          description="Single-Clinic Setups"
          icon={<ShieldCheck className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Pro Tier"
          value={stats.proCount.toString()}
          description="Multi-Branch Centers"
          icon={<Zap className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Enterprise Tier"
          value={stats.enterpriseCount.toString()}
          description="Unlimited Facilities"
          icon={<Crown className="w-5 h-5 text-text-secondary" />}
        />
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          3. FILTER TABS & SEARCH BAR
         ────────────────────────────────────────────────────────────────────────── */}
      <Card className="p-3.5 sm:p-4 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Segmented Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-surface-alt/70 rounded-xl border border-border/70 overflow-x-auto no-scrollbar touch-pan-x w-fit max-w-full">
            {[
              { id: "all", label: "All", count: stats.total },
              { id: "active", label: "Active", count: stats.active },
              { id: "inactive", label: "Suspended", count: stats.inactive },
              { id: "starter", label: "Starter", count: stats.starterCount },
              { id: "pro", label: "Pro", count: stats.proCount },
              { id: "enterprise", label: "Enterprise", count: stats.enterpriseCount },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 min-h-[36px] sm:min-h-[30px]",
                  activeTab === tab.id
                    ? "bg-surface text-text shadow-xs font-bold border border-border/60"
                    : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                    activeTab === tab.id
                      ? "bg-primary-500/20 text-primary-700 dark:text-primary-300"
                      : "bg-surface-alt text-text-muted"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, city, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-alt border border-border/80 rounded-xl text-xs sm:text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            />
          </div>
        </div>
      </Card>

      {/* ──────────────────────────────────────────────────────────────────────────
          4. ORGANIZATIONS DATA TABLE & RESPONSIVE CARDS
         ────────────────────────────────────────────────────────────────────────── */}
      <div>
        <Table
          columns={tableColumns}
          data={filteredOrganizations}
          searchable={false}
          loading={loading}
          emptyMessage="No tenant organizations registered yet."
          renderMobileCard={(org: Organization) => {
            const isCurrentOrg = user?.organization_id === org.id;
            const isInactive = org.status === "inactive" || org.isActive === false;
            const plan = org.plan || "starter";

            return (
              <div
                key={org.id}
                className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-3 relative overflow-hidden transition-all hover:border-primary-500/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {org.logo_url || org.image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={org.logo_url || org.image_url}
                        alt={org.name}
                        className="w-10 h-10 rounded-xl object-cover border border-border/80 shadow-xs shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20 flex items-center justify-center font-bold text-sm shrink-0">
                        {org.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-text text-sm truncate">{org.name}</span>
                        {isCurrentOrg && (
                          <Badge variant="primary" size="sm" dot className="text-[9px] font-bold uppercase">
                            Active
                          </Badge>
                        )}
                        {org.images && org.images.length > 0 && (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-surface-alt text-text-muted border border-border/60">
                            📷 {org.images.length}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted mt-0.5 truncate">{org.email || "No email listed"}</p>
                    </div>
                  </div>
                  <Badge
                    variant={plan === "enterprise" ? "primary" : plan === "pro" ? "info" : "secondary"}
                    size="sm"
                    className="uppercase text-[9px] font-bold shrink-0"
                  >
                    {plan}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-xs text-text-secondary pt-1 border-t border-border/40">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span>{org.city}</span>
                  </div>
                  <Badge variant={isInactive ? "neutral" : "success"} size="sm" dot className="text-[10px]">
                    {isInactive ? "Suspended" : "Active"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                  <Button
                    variant={isCurrentOrg ? "secondary" : "primary"}
                    size="sm"
                    loading={switchingId === org.id}
                    onClick={() => handleEnterWorkspace(org.id, org.name)}
                    className="text-xs font-semibold rounded-xl flex-1 min-h-[40px] justify-center"
                  >
                    {isCurrentOrg ? "Active Workspace" : "Enter Workspace"}
                    {!isCurrentOrg && <ArrowRight className="w-3.5 h-3.5 ml-1" />}
                  </Button>
                  <Dropdown
                    align="right"
                    width="w-48"
                    trigger={
                      <Button
                        size="xs"
                        variant="outline"
                        className="h-10 w-10 p-0 flex items-center justify-center rounded-xl text-text-secondary hover:text-text min-h-[40px] min-w-[40px]"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    }
                    items={[
                      {
                        label: "Login as Admin",
                        icon: <KeyRound className="w-4 h-4 text-amber-500" />,
                        onClick: () => handleLoginAsOrgAdmin(org),
                      },
                      {
                        label: "Members & Impersonate",
                        icon: <Users className="w-4 h-4 text-primary-500" />,
                        onClick: () => handleOpenMembersModal(org),
                      },
                      { divider: true, label: "" },
                      {
                        label: "Edit Details",
                        icon: <Edit3 className="w-4 h-4 text-text-muted" />,
                        onClick: () => handleOpenEditModal(org),
                      },
                      {
                        label: isInactive ? "Reactivate Workspace" : "Suspend Workspace",
                        icon: <Power className={`w-4 h-4 ${isInactive ? "text-emerald-500" : "text-amber-500"}`} />,
                        onClick: () => handleToggleOrgStatus(org),
                      },
                      { divider: true, label: "" },
                      {
                        label: "Delete Organization",
                        icon: <Trash2 className="w-4 h-4 text-danger" />,
                        variant: "danger",
                        onClick: () => handleOpenDeleteModal(org),
                      },
                    ]}
                  />
                </div>
              </div>
            );
          }}
        />
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          5. 2-STEP ORGANIZATION PROVISIONING WIZARD
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Provision Tenant Organization"
        description="Set up an organization workspace, subscription tier, and primary administrator."
        size="lg"
      >
        {/* Wizard Step Progress Indicator */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4 text-xs font-semibold">
          <div
            className={cn(
              "flex items-center gap-2",
              wizardStep === 1 ? "text-primary-600 dark:text-primary-400 font-bold" : "text-text-muted"
            )}
          >
            <span
              className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[11px]",
                wizardStep === 1 ? "bg-primary-500 text-white font-bold" : "bg-surface-alt border border-border"
              )}
            >
              1
            </span>
            <span>Organization & Tier</span>
          </div>
          <div className="h-0.5 flex-1 mx-3 bg-border/60" />
          <div
            className={cn(
              "flex items-center gap-2",
              wizardStep === 2 ? "text-primary-600 dark:text-primary-400 font-bold" : "text-text-muted"
            )}
          >
            <span
              className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[11px]",
                wizardStep === 2 ? "bg-primary-500 text-white font-bold" : "bg-surface-alt border border-border"
              )}
            >
              2
            </span>
            <span>Administrator & Branch</span>
          </div>
        </div>

        <form onSubmit={handleCreateOrganizationSubmit} className="flex flex-col max-h-[75vh]" autoComplete="off">
          {/* STEP 1: Organization & Subscription Tier */}
          {wizardStep === 1 && (
            <>
              <div className="overflow-y-auto flex-1 space-y-4 pr-1 pb-3">
                <Input
                  label="Organization Name *"
                  placeholder="e.g. Apollo Healthcare System"
                  value={formData.orgName}
                  onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
                  autoComplete="off"
                  required
                />

              {/* Subscription Tier Radio Cards */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-text">Subscription Plan Tier *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: "starter", title: "Starter", desc: "1 Clinic · 2 Doctors · 5 Staff", icon: <ShieldCheck className="w-4 h-4" /> },
                    { id: "pro", title: "Pro", desc: "5 Clinics · 15 Doctors · Multi-Branch", icon: <Zap className="w-4 h-4" /> },
                    { id: "enterprise", title: "Enterprise", desc: "Unlimited Capacity · Dedicated AI", icon: <Crown className="w-4 h-4" /> },
                  ].map((tier) => (
                    <button
                      type="button"
                      key={tier.id}
                      onClick={() => setFormData({ ...formData, plan: tier.id as any })}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all cursor-pointer select-none",
                        formData.plan === tier.id
                          ? "border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400 font-bold shadow-xs"
                          : "border-border/80 hover:bg-surface-hover text-text-secondary"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold uppercase tracking-wide">{tier.title}</p>
                        {tier.icon}
                      </div>
                      <p className="text-[10px] opacity-80 leading-snug">{tier.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-alt border border-border/80 space-y-1">
                <Input
                  label="Free Trial Duration (Days) *"
                  type="number"
                  min={1}
                  max={365}
                  placeholder="15"
                  value={formData.trialDays || 15}
                  onChange={(e) => setFormData({ ...formData, trialDays: Number(e.target.value) || 15 })}
                />
                <p className="text-[10px] text-text-muted">
                  Root Admin Override: Configure initial trial period for this tenant.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Input
                  label="Contact Phone Number"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={formData.orgPhone}
                  onChange={(e) => setFormData({ ...formData, orgPhone: e.target.value })}
                  autoComplete="off"
                />
                <Input
                  label="Contact Email"
                  type="email"
                  placeholder="contact@apollo.health"
                  value={formData.orgEmail}
                  onChange={(e) => setFormData({ ...formData, orgEmail: e.target.value })}
                  autoComplete="off"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Input
                  label="City *"
                  placeholder="e.g. Mumbai, New York"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  autoComplete="off"
                  required
                />
                <Input
                  label="Physical / Facility Address"
                  placeholder="Street address, building, suite"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  autoComplete="off"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
            </div>

            {/* Static Footer — Step 1 Action Buttons */}
            <div className="shrink-0 flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-border/80 bg-surface/95 backdrop-blur-md">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px]">
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={!formData.orgName.trim() || !formData.city.trim()}
                onClick={() => setWizardStep(2)}
                className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] font-semibold rounded-xl shadow-xs"
              >
                Configure Administrator
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </>
        )}

        {/* STEP 2: Administrator & Primary Branch */}
        {wizardStep === 2 && (
          <>
            <div className="overflow-y-auto flex-1 space-y-4 pr-1 pb-3 animate-fade-in">
              <div className="p-3.5 bg-surface-alt rounded-2xl border border-border/80 space-y-1.5">
                <p className="text-xs font-bold text-text">Primary Clinic Branch</p>
                <Input
                  placeholder={formData.orgName ? `${formData.orgName}` : "Clinic Branch Name"}
                  value={formData.clinicName}
                  onChange={(e) => setFormData({ ...formData, clinicName: e.target.value })}
                  autoComplete="off"
                  className="text-xs"
                />
              </div>

              <div className="space-y-3.5 border-t border-border/60 pt-3">
                <p className="text-xs font-bold text-text">Primary Administrator Account</p>
                <Input
                  label="Administrator Name *"
                  placeholder="Dr. Jay Patel"
                  value={formData.adminName}
                  onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                  autoComplete="off"
                  required
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Input
                    label="Administrator Email *"
                    type="email"
                    placeholder="admin@apollo.health"
                    value={formData.adminEmail}
                    onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                    hint="Each organization administrator must have a unique email address."
                    autoComplete="off"
                    required
                  />
                  <Input
                    label="Administrator Phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.adminPhone}
                    onChange={(e) => setFormData({ ...formData, adminPhone: e.target.value })}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Input
                    label="Administrator Password *"
                    type={showAdminPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={formData.adminPassword}
                    onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                    minLength={6}
                    autoComplete="new-password"
                    required
                  />
                  <div className="flex justify-between items-center pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="text-[11px] font-semibold text-text-muted hover:text-text cursor-pointer inline-flex items-center gap-1"
                    >
                      {showAdminPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {showAdminPassword ? "Hide password" : "Show password"}
                    </button>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="text-[11px] font-bold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      Generate Secure Password
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
            </div>

            {/* Static Footer — Step 2 Action Buttons */}
            <div className="shrink-0 flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-2 pt-3 border-t border-border/80 bg-surface/95 backdrop-blur-md">
              <Button type="button" variant="outline" size="sm" onClick={() => setWizardStep(1)} className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px]">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Back
              </Button>
              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px]">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={submitting}
                  className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] font-semibold rounded-xl shadow-xs"
                >
                  Provision Workspace
                </Button>
              </div>
            </div>
          </>
        )}
      </form>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          6. POST-CREATION CREDENTIALS SUMMARY MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        title="Workspace Provisioned Successfully"
        description="Save or securely transmit the administrator login credentials below."
      >
        <div className="space-y-4 pt-1">
          {createdCredentialsSummary && (
            <div className="space-y-3">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                    {createdCredentialsSummary.orgName}
                  </p>
                  <Badge variant="success" size="sm" className="text-[10px] font-bold uppercase">
                    Provisioned
                  </Badge>
                </div>
                <p className="text-xs text-text-secondary">
                  Primary administrator account created and linked to this workspace.
                </p>
              </div>

              <div className="space-y-2.5 bg-surface-alt p-4 rounded-2xl border border-border/80 text-xs">
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-text-muted font-medium">Login Portal:</span>
                  <span className="font-semibold text-text select-all">{createdCredentialsSummary.loginUrl}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-text-muted font-medium">Administrator Email:</span>
                  <span className="font-semibold text-text select-all">{createdCredentialsSummary.adminEmail}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-text-muted font-medium">Password:</span>
                  <span className="font-mono font-bold text-primary-600 dark:text-primary-400 select-all">
                    {createdCredentialsSummary.adminPassword}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyCredentials}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] font-semibold rounded-xl"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
              {isCopied ? "Copied" : "Copy Credentials"}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setIsSummaryModalOpen(false)}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] font-semibold rounded-xl shadow-xs"
            >
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          7. EDIT ORGANIZATION MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Organization Details"
        description="Update subscription plan tier, facility name, or contact details."
      >
        <form onSubmit={handleUpdateOrganization} className="flex flex-col max-h-[75vh]" autoComplete="off">
          <div className="overflow-y-auto flex-1 space-y-4 pr-1 pb-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <ImageUpload
                label="Organization Brand Logo"
                helperText="Square icon (PNG, JPG, SVG)"
                value={editFormData.logo_url}
                onChange={(val) => setEditFormData({ ...editFormData, logo_url: val })}
              />
              <ImageUpload
                label="Cover / Hero Photo"
                helperText="Header photo (PNG, JPG)"
                value={editFormData.image_url}
                onChange={(val) => setEditFormData({ ...editFormData, image_url: val })}
              />
            </div>

            <Input
              label="Organization Name *"
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              autoComplete="off"
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
                    className={cn(
                      "p-2.5 rounded-xl border text-left transition-all cursor-pointer select-none",
                      editFormData.plan === tier.id
                        ? "border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400 font-bold shadow-xs"
                        : "border-border/80 hover:bg-surface-hover text-text-secondary"
                    )}
                  >
                    <p className="text-xs font-bold capitalize">{tier.title}</p>
                    <p className="text-[10px] opacity-80 mt-0.5">{tier.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Input
                label="Contact Phone Number"
                type="tel"
                placeholder="+91 98765 43210"
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                autoComplete="off"
              />
              <Input
                label="Contact Email"
                type="email"
                placeholder="contact@apollo.health"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                autoComplete="off"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Input
                label="City *"
                placeholder="e.g. Mumbai, New York"
                value={editFormData.city}
                onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                autoComplete="off"
                required
              />
              <Input
                label="Physical / Facility Address"
                placeholder="Street address, building, suite"
                value={editFormData.address}
                onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                autoComplete="off"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Input
                label="Tax ID / GSTIN"
                placeholder="22AAAAA0000A1Z5"
                value={editFormData.taxId}
                onChange={(e) => setEditFormData({ ...editFormData, taxId: e.target.value })}
                autoComplete="off"
              />
              <Input
                label="License Number"
                placeholder="HOSP-REG-2026-8901"
                value={editFormData.licenseNumber}
                onChange={(e) => setEditFormData({ ...editFormData, licenseNumber: e.target.value })}
                autoComplete="off"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Select
                label="Currency"
                value={editFormData.currency}
                onChange={(e) => setEditFormData({ ...editFormData, currency: e.target.value })}
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
                value={editFormData.timezone}
                onChange={(e) => setEditFormData({ ...editFormData, timezone: e.target.value })}
                options={[
                  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST +5:30)" },
                  { value: "America/New_York", label: "America/New_York (EST -5:00)" },
                  { value: "Europe/London", label: "Europe/London (GMT +0:00)" },
                  { value: "Asia/Dubai", label: "Asia/Dubai (GST +4:00)" },
                ]}
              />
            </div>
          </div>

          {/* Static Footer — Edit Action Buttons */}
          <div className="shrink-0 flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-border/80 bg-surface/95 backdrop-blur-md">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)} className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px]">
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={updating} className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] font-semibold rounded-xl shadow-xs">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          8. DELETE CONFIRMATION MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Tenant Organization"
        description="Are you sure you want to delete this organization? All linked clinics, appointments, and staff records will be removed."
      >
        <div className="space-y-4 pt-1">
          {deletingOrg && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs space-y-1">
              <p className="font-bold text-red-600 dark:text-red-400 text-sm">{deletingOrg.name}</p>
              <p className="text-text-secondary">City: {deletingOrg.city} &bull; Plan: {deletingOrg.plan?.toUpperCase()}</p>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-border/60">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsDeleteModalOpen(false)} className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px]">
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={deleting}
              onClick={handleDeleteOrganization}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] font-semibold rounded-xl shadow-xs"
            >
              Delete Organization
            </Button>
          </div>
        </div>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          9. ORGANIZATION MEMBERS & IMPERSONATION MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={!!membersModalOrg}
        onClose={() => setMembersModalOrg(null)}
        title={membersModalOrg ? `Members of ${membersModalOrg.name}` : "Organization Members"}
        description="View registered doctors, administrators, and staff in this organization. Impersonate any account to view the platform directly in their place."
        size="lg"
      >
        <div className="space-y-4 pt-1">
          {loadingMembers ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Spinner size="lg" label="Loading members directory..." />
              <p className="text-xs text-text-muted">Fetching registered accounts for this tenant...</p>
            </div>
          ) : orgMembersList.length === 0 ? (
            <div className="py-12 text-center text-text-muted bg-surface-alt/40 border border-border/70 rounded-2xl">
              <Users className="w-8 h-8 mx-auto mb-2 text-text-muted opacity-60" />
              <p className="font-semibold text-text text-sm">No Members Found</p>
              <p className="text-xs text-text-muted mt-1">This organization has no associated accounts yet.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              <div className="text-xs font-semibold text-text-muted uppercase tracking-wider px-1">
                {orgMembersList.length} Registered {orgMembersList.length === 1 ? "Member" : "Members"}
              </div>
              <div className="divide-y divide-border/60 rounded-2xl border border-border/80 overflow-hidden bg-surface">
                {orgMembersList.map((member) => (
                  <div
                    key={member.id}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-surface-alt/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 font-bold flex items-center justify-center shrink-0 text-xs border border-primary-500/20">
                        {member.name ? member.name.charAt(0).toUpperCase() : "?"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-xs sm:text-sm text-text truncate">{member.name}</p>
                          <Badge
                            variant={
                              member.role === "admin"
                                ? "primary"
                                : member.role === "doctor"
                                ? "info"
                                : member.role === "receptionist"
                                ? "warning"
                                : "neutral"
                            }
                            size="sm"
                            className="uppercase text-[9px] font-bold shrink-0"
                          >
                            {member.role}
                          </Badge>
                        </div>
                        <p className="text-xs text-text-muted truncate mt-0.5">
                          {member.email || "No email"} {member.phone ? `• ${member.phone}` : ""}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="xs"
                      variant="primary"
                      loading={impersonatingUserId === member.id}
                      onClick={() => handleImpersonateMember(member)}
                      className="font-semibold text-xs rounded-xl flex items-center gap-1.5 shrink-0 min-h-[34px]"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      Login As
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMembersModalOrg(null)}
              className="w-full sm:w-auto min-h-[40px] sm:min-h-[36px]"
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

