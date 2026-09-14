"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Building2,
  Layers,
  Shield,
  KeyRound,
  RotateCw,
  MapPin,
  Phone,
  Mail,
  UserCheck,
  Stethoscope,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  StatCard,
  Table,
  Column,
  Tabs,
  Select,
  SearchInput,
  Modal,
  Avatar,
  EmptyState,
  Spinner,
  SkeletonCard,
  useToast,
} from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

interface PlatformUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  organizationId: string | null;
  organizationName: string;
  organizationPlan?: string | null;
  organizationCity?: string | null;
  clinicId?: string | null;
  clinicName?: string | null;
  clinicCity?: string | null;
  createdAt: string;
}

interface HierarchyBranch {
  id: string;
  name: string;
  city: string;
  address?: string;
  phone?: string;
  members: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
    specialization?: string;
    shift?: string;
    isActive: boolean;
  }[];
}

interface HierarchyOrg {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  plan: string;
  status: string;
  branches: HierarchyBranch[];
  admins: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
    isActive: boolean;
  }[];
  unassignedMembers: any[];
  counts: {
    branches: number;
    admins: number;
    totalMembers: number;
  };
}

interface PlatformHierarchy {
  summary: {
    totalOrganizations: number;
    totalBranches: number;
    totalMembers: number;
    totalPlatformAdmins: number;
  };
  platformAdmins: any[];
  organizations: HierarchyOrg[];
}

export default function PlatformUsersPage() {
  const router = useRouter();
  const { user: currentUser, impersonate } = useAuthStore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<string>("hierarchy");

  // Hierarchy Data
  const [hierarchy, setHierarchy] = useState<PlatformHierarchy | null>(null);
  const [loadingHierarchy, setLoadingHierarchy] = useState(true);
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>("all");

  // Global Directory Data
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedDirectoryOrg, setSelectedDirectoryOrg] = useState("all");

  // Impersonation modal & action
  const [targetUserToImpersonate, setTargetUserToImpersonate] = useState<{
    id: string;
    name: string;
    role: string;
    organizationName: string;
    clinicName?: string | null;
  } | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  // Fetch Hierarchy
  const fetchHierarchy = useCallback(async () => {
    try {
      setLoadingHierarchy(true);
      const res = await api.get("/admin/hierarchy");
      setHierarchy(res.data?.data || null);
    } catch (err: any) {
      toast({
        title: "Failed to Load Hierarchy",
        description: err.response?.data?.message || "Could not retrieve organization hierarchy.",
        variant: "error",
      });
    } finally {
      setLoadingHierarchy(false);
    }
  }, [toast]);

  // Fetch Flat Directory Users
  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append("q", searchQuery.trim());
      if (selectedRole !== "all") params.append("role", selectedRole);
      if (selectedDirectoryOrg !== "all") params.append("organizationId", selectedDirectoryOrg);

      const res = await api.get(`/admin/users?${params.toString()}`);
      setUsers(res.data?.data?.users || []);
    } catch (err: any) {
      toast({
        title: "Failed to Load Users",
        description: err.response?.data?.message || "Could not retrieve global platform users.",
        variant: "error",
      });
    } finally {
      setLoadingUsers(false);
    }
  }, [searchQuery, selectedRole, selectedDirectoryOrg, toast]);

  useEffect(() => {
    fetchHierarchy();
  }, [fetchHierarchy]);

  useEffect(() => {
    if (activeTab === "directory") {
      fetchUsers();
    }
  }, [activeTab, fetchUsers]);

  const handleStartImpersonation = async (target: {
    id: string;
    name: string;
    role: string;
    organizationName: string;
  }) => {
    try {
      setImpersonatingId(target.id);
      await impersonate({ userId: target.id });
      setTargetUserToImpersonate(null);
      toast({
        title: "Session Switched",
        description: `Now signed in as ${target.name} (${target.role.toUpperCase()}) for ${target.organizationName}.`,
        variant: "success",
      });
      router.push("/dashboard");
    } catch (err: any) {
      toast({
        title: "Impersonation Failed",
        description: err.response?.data?.message || "Could not start impersonation session.",
        variant: "error",
      });
    } finally {
      setImpersonatingId(null);
    }
  };

  const handleImpersonateOrgAdmin = async (org: HierarchyOrg) => {
    try {
      setImpersonatingId(org.id);
      await impersonate({ organizationId: org.id, role: "admin" });
      toast({
        title: "Workspace Entered as Admin",
        description: `Now signed in as Administrator for ${org.name}.`,
        variant: "success",
      });
      router.push("/dashboard");
    } catch (err: any) {
      toast({
        title: "Login Failed",
        description: err.response?.data?.message || "Could not impersonate organization admin.",
        variant: "error",
      });
    } finally {
      setImpersonatingId(null);
    }
  };

  // Filtered organizations for hierarchy view
  const filteredOrganizations = useMemo(() => {
    if (!hierarchy?.organizations) return [];
    if (selectedOrgFilter === "all") return hierarchy.organizations;
    return hierarchy.organizations.filter((o) => o.id === selectedOrgFilter);
  }, [hierarchy, selectedOrgFilter]);

  // Organization Select Options
  const organizationSelectOptions = useMemo(() => {
    const defaultOpt = [{ value: "all", label: "All Organizations (Global)" }];
    if (!hierarchy?.organizations) return defaultOpt;
    return [
      ...defaultOpt,
      ...hierarchy.organizations.map((o) => ({
        value: o.id,
        label: `${o.name} (${o.plan.toUpperCase()})`,
      })),
    ];
  }, [hierarchy]);

  // Global Table Columns
  const directoryColumns: Column<PlatformUser>[] = [
    {
      header: "User & Contact",
      accessor: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.name} size="sm" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-text text-xs sm:text-sm">{u.name}</span>
              {u.role === "root" && (
                <Badge variant="primary" size="sm" dot className="text-[9px] font-bold">
                  Root
                </Badge>
              )}
            </div>
            <p className="text-xs text-text-muted mt-0.5">{u.email || "No email"} {u.phone ? `• ${u.phone}` : ""}</p>
          </div>
        </div>
      ),
    },
    {
      header: "System Role",
      accessor: (u) => (
        <Badge
          variant={
            u.role === "root"
              ? "primary"
              : u.role === "admin"
              ? "info"
              : u.role === "doctor"
              ? "success"
              : u.role === "receptionist"
              ? "warning"
              : "neutral"
          }
          size="sm"
          className="uppercase text-[10px] font-bold"
        >
          {u.role}
        </Badge>
      ),
    },
    {
      header: "Workspace / Organization",
      accessor: (u) => (
        <div>
          <p className="font-semibold text-text text-xs">{u.organizationName}</p>
          {u.organizationPlan && (
            <Badge variant="secondary" size="sm" className="uppercase text-[9px] font-bold mt-0.5">
              {u.organizationPlan}
            </Badge>
          )}
        </div>
      ),
    },
    {
      header: "Branch / Clinic",
      accessor: (u) => (
        <div className="text-xs text-text-secondary">
          {u.clinicName ? (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-text-muted shrink-0" />
              <span>{u.clinicName}</span>
              {u.clinicCity && <span className="text-text-muted">({u.clinicCity})</span>}
            </div>
          ) : u.role === "root" ? (
            <span className="text-text-muted">Global Platform</span>
          ) : (
            <span className="text-text-muted">All Branches / Org-wide</span>
          )}
        </div>
      ),
    },
    {
      header: "Actions",
      align: "right",
      accessor: (u) => {
        const isSelf = u.id === currentUser?.id;
        return (
          <div className="flex justify-end">
            <Button
              size="xs"
              variant={isSelf ? "outline" : "primary"}
              disabled={isSelf}
              onClick={() =>
                setTargetUserToImpersonate({
                  id: u.id,
                  name: u.name,
                  role: u.role,
                  organizationName: u.organizationName,
                  clinicName: u.clinicName,
                })
              }
              className="font-semibold text-xs rounded-xl flex items-center gap-1.5 min-h-[34px]"
            >
              <KeyRound className="w-3.5 h-3.5" />
              {isSelf ? "Active Session" : "Login As"}
            </Button>
          </div>
        );
      },
    },
  ];

  if (currentUser?.role !== "root") {
    return (
      <EmptyState
        icon={<Shield className="w-8 h-8 text-primary-500" />}
        title="Superadmin Access Required"
        description="Only platform Root administrators have authority to access multi-tenant directory and impersonate users."
        action={
          <Button variant="primary" size="sm" onClick={() => router.push("/dashboard")}>
            Return to Dashboard
          </Button>
        }
      />
    );
  }

  const summary = hierarchy?.summary || {
    totalOrganizations: 0,
    totalBranches: 0,
    totalMembers: 0,
    totalPlatformAdmins: 1,
  };

  return (
    <div className="space-y-6 font-sans text-text antialiased animate-fade-up pb-12">
      {/* 1. HEADER BANNER */}
      <div className="relative overflow-hidden rounded-2xl border border-primary-500/20 bg-surface p-5 sm:p-6 shadow-xs before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-primary-600 before:via-primary-500 before:to-indigo-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                Platform Users & Impersonation Hub
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                Superadmin Console
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted max-w-2xl">
              Scalable multi-tenant organization & branch hierarchy with zero-password instant user impersonation.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchHierarchy();
                if (activeTab === "directory") fetchUsers();
              }}
              disabled={loadingHierarchy || loadingUsers}
              className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors min-h-[36px]"
            >
              <RotateCw className={`h-3.5 w-3.5 mr-1.5 text-text-secondary ${loadingHierarchy ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* 2. STATCARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Tenant Organizations"
          value={summary.totalOrganizations}
          icon={<Building2 className="w-5 h-5 text-primary-500" />}
          description="Active multi-tenant clients"
        />
        <StatCard
          title="Clinic Branches"
          value={summary.totalBranches}
          icon={<Layers className="w-5 h-5 text-emerald-500" />}
          description="Physical health facilities"
        />
        <StatCard
          title="Total Personnel"
          value={summary.totalMembers}
          icon={<Users className="w-5 h-5 text-blue-500" />}
          description="Doctors, staff & receptionists"
        />
        <StatCard
          title="Platform Superadmins"
          value={summary.totalPlatformAdmins}
          icon={<Shield className="w-5 h-5 text-purple-500" />}
          description="Root system operators"
        />
      </div>

      {/* 3. DUAL VIEW TABS */}
      <Tabs
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id)}
        variant="pills"
        tabs={[
          {
            id: "hierarchy",
            label: "Organization & Branch Hierarchy",
            icon: <Building2 className="w-4 h-4 mr-1.5" />,
            badge: summary.totalOrganizations,
          },
          {
            id: "directory",
            label: "Global Directory & Search",
            icon: <Users className="w-4 h-4 mr-1.5" />,
            badge: users.length ? users.length : undefined,
          },
        ]}
      />

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 1: HIERARCHICAL SCALABLE VIEW (ORG ➔ BRANCH ➔ MEMBERS)
         ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "hierarchy" && (
        <div className="space-y-6 animate-fade-in">
          {/* Organization Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3.5 rounded-2xl border border-border">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
              <Building2 className="w-4 h-4 text-primary-500" />
              <span>Select Tenant Scope:</span>
            </div>
            <div className="w-full sm:w-80">
              <Select
                value={selectedOrgFilter}
                onChange={(e) => setSelectedOrgFilter(e.target.value)}
                options={organizationSelectOptions}
                size="sm"
              />
            </div>
          </div>

          {loadingHierarchy ? (
            <div className="space-y-4 animate-fade-in" aria-busy="true" aria-label="Loading multi-tenant hierarchy">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : filteredOrganizations.length === 0 ? (
            <EmptyState
              icon={<Building2 className="w-8 h-8 text-primary-500" />}
              title="No Organizations Found"
              description="No tenant organizations registered yet or none match your filter."
            />
          ) : (
            <div className="space-y-6">
              {filteredOrganizations.map((org) => (
                <Card key={org.id} className="overflow-hidden border-border/80 shadow-2xs">
                  {/* Organization Card Header */}
                  <CardHeader className="bg-surface-alt/40 border-b border-border/60 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-500/10 text-primary-600 font-bold flex items-center justify-center text-sm shrink-0 border border-primary-500/20">
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-base sm:text-lg font-bold text-text">{org.name}</CardTitle>
                            <Badge
                              variant={
                                org.plan === "enterprise"
                                  ? "primary"
                                  : org.plan === "pro"
                                  ? "info"
                                  : "secondary"
                              }
                              size="sm"
                              className="uppercase text-[9px] font-bold"
                            >
                              {org.plan}
                            </Badge>
                            <Badge
                              variant={org.status === "active" ? "success" : "neutral"}
                              size="sm"
                              dot
                              className="text-[9px] font-semibold"
                            >
                              {org.status === "active" ? "Active" : "Suspended"}
                            </Badge>
                          </div>
                          <p className="text-xs text-text-muted mt-0.5">
                            {org.city || "Multi-Branch"} {org.email ? `• ${org.email}` : ""} {org.phone ? `• ${org.phone}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="xs"
                          variant="primary"
                          loading={impersonatingId === org.id}
                          onClick={() => handleImpersonateOrgAdmin(org)}
                          className="font-semibold text-xs rounded-xl flex items-center gap-1.5 min-h-[36px]"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          Login as Org Admin
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-6 space-y-6">
                    {/* 1. CLINIC BRANCHES SECTION */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-primary-500" />
                          Branches & Assigned Staff ({org.branches.length})
                        </h3>
                      </div>

                      {org.branches.length === 0 ? (
                        <div className="p-4 rounded-xl border border-dashed border-border/80 bg-surface-alt/30 text-xs text-text-muted text-center">
                          No clinic branches registered in this organization yet.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {org.branches.map((branch) => (
                            <div
                              key={branch.id}
                              className="p-4 rounded-xl border border-border/80 bg-surface hover:border-border-focus transition-all space-y-3 shadow-2xs"
                            >
                              <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2.5">
                                <div>
                                  <p className="font-bold text-sm text-text flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                                    {branch.name}
                                  </p>
                                  <p className="text-xs text-text-muted mt-0.5">
                                    {branch.city} {branch.address ? `• ${branch.address}` : ""}
                                  </p>
                                </div>
                                <Badge variant="secondary" size="sm" className="text-[10px]">
                                  {branch.members.length} {branch.members.length === 1 ? "Staff" : "Staff"}
                                </Badge>
                              </div>

                              {/* Branch Staff List */}
                              {branch.members.length === 0 ? (
                                <p className="text-xs text-text-muted italic py-1">
                                  No doctors or staff assigned to this branch yet.
                                </p>
                              ) : (
                                <div className="space-y-2 divide-y divide-border/40">
                                  {branch.members.map((member) => (
                                    <div
                                      key={member.id}
                                      className="pt-2 flex items-center justify-between gap-2 text-xs"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <Avatar name={member.name} size="xs" />
                                        <div className="min-w-0">
                                          <p className="font-semibold text-text truncate">{member.name}</p>
                                          <div className="flex items-center gap-1.5 text-text-muted text-[11px] truncate">
                                            <span className="capitalize">{member.role}</span>
                                            {member.specialization && <span>• {member.specialization}</span>}
                                            {member.shift && <span>• {member.shift} Shift</span>}
                                          </div>
                                        </div>
                                      </div>
                                      <Button
                                        size="xs"
                                        variant="outline"
                                        onClick={() =>
                                          setTargetUserToImpersonate({
                                            id: member.id,
                                            name: member.name,
                                            role: member.role,
                                            organizationName: org.name,
                                            clinicName: branch.name,
                                          })
                                        }
                                        className="rounded-lg text-[11px] font-semibold h-7 px-2 shrink-0 flex items-center gap-1"
                                      >
                                        <KeyRound className="w-3 h-3 text-amber-500" />
                                        Login As
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 2. ORG ADMINS & OWNERS */}
                    {org.admins.length > 0 && (
                      <div className="space-y-3 pt-3 border-t border-border/60">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-amber-500" />
                          Organization Administrators ({org.admins.length})
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {org.admins.map((adm) => (
                            <div
                              key={adm.id}
                              className="p-3 rounded-xl border border-border/70 bg-surface-alt/20 flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Avatar name={adm.name} size="sm" />
                                <div className="min-w-0">
                                  <p className="font-bold text-xs text-text truncate">{adm.name}</p>
                                  <p className="text-[11px] text-text-muted truncate">{adm.email || "No email"}</p>
                                </div>
                              </div>
                              <Button
                                size="xs"
                                variant="primary"
                                onClick={() =>
                                  setTargetUserToImpersonate({
                                    id: adm.id,
                                    name: adm.name,
                                    role: adm.role,
                                    organizationName: org.name,
                                  })
                                }
                                className="font-semibold text-xs rounded-lg h-7 px-2 shrink-0 flex items-center gap-1"
                              >
                                <KeyRound className="w-3 h-3" />
                                Login As
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 3. UNASSIGNED OR ORG-WIDE PERSONNEL */}
                    {org.unassignedMembers.length > 0 && (
                      <div className="space-y-3 pt-3 border-t border-border/60">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-blue-500" />
                          Org-Wide / Unassigned Staff ({org.unassignedMembers.length})
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {org.unassignedMembers.map((mem) => (
                            <div
                              key={mem.id}
                              className="p-3 rounded-xl border border-border/70 bg-surface-alt/20 flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Avatar name={mem.name} size="sm" />
                                <div className="min-w-0">
                                  <p className="font-bold text-xs text-text truncate">{mem.name}</p>
                                  <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                                    <Badge variant="secondary" size="sm" className="uppercase text-[8px]">
                                      {mem.role}
                                    </Badge>
                                    <span className="truncate">{mem.email || mem.phone}</span>
                                  </div>
                                </div>
                              </div>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() =>
                                  setTargetUserToImpersonate({
                                    id: mem.id,
                                    name: mem.name,
                                    role: mem.role,
                                    organizationName: org.name,
                                  })
                                }
                                className="font-semibold text-xs rounded-lg h-7 px-2 shrink-0 flex items-center gap-1"
                              >
                                <KeyRound className="w-3 h-3 text-amber-500" />
                                Login As
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 2: GLOBAL FLAT DIRECTORY & SEARCH
         ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "directory" && (
        <div className="space-y-4 animate-fade-in">
          {/* Controls Bar */}
          <Card className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div className="sm:col-span-6">
                <SearchInput
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(val) => setSearchQuery(val)}
                  size="sm"
                />
              </div>

              <div className="sm:col-span-3">
                <Select
                  value={selectedDirectoryOrg}
                  onChange={(e) => setSelectedDirectoryOrg(e.target.value)}
                  options={organizationSelectOptions}
                  size="sm"
                />
              </div>

              <div className="sm:col-span-3">
                <Select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  options={[
                    { value: "all", label: "All Roles" },
                    { value: "admin", label: "Admins / Owners" },
                    { value: "doctor", label: "Doctors" },
                    { value: "receptionist", label: "Receptionists" },
                    { value: "patient", label: "Patients" },
                  ]}
                  size="sm"
                />
              </div>
            </div>
          </Card>

          {/* Directory Table */}
          <div className="bg-surface rounded-2xl border border-border shadow-2xs overflow-hidden">
            <Table<PlatformUser>
              columns={directoryColumns}
              data={users}
              loading={loadingUsers}
              mobileCardView
              renderMobileCard={(u: PlatformUser) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <div
                    key={u.id}
                    className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-3 relative overflow-hidden transition-all hover:border-primary-500/30"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={u.name} size="sm" />
                        <div className="min-w-0">
                          <p className="font-bold text-text text-sm truncate">{u.name}</p>
                          <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                            {u.phone && (
                              <a href={`tel:${u.phone}`} className="hover:text-text truncate">
                                {u.phone}
                              </a>
                            )}
                            {u.email && (
                              <span className="truncate">&bull; {u.email}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <Badge
                        variant={
                          u.role === "root"
                            ? "primary"
                            : u.role === "admin"
                            ? "info"
                            : u.role === "doctor"
                            ? "success"
                            : "secondary"
                        }
                        size="sm"
                        className="uppercase text-[10px] font-bold shrink-0"
                      >
                        {u.role}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs py-2 px-3 rounded-xl bg-surface-alt/70 border border-border/50">
                      <div>
                        <span className="text-text-muted text-[10px] uppercase font-bold block">Organization</span>
                        <span className="font-semibold text-text truncate mt-0.5 block">{u.organizationName}</span>
                      </div>
                      <div>
                        <span className="text-text-muted text-[10px] uppercase font-bold block">Branch</span>
                        <span className="font-semibold text-text truncate mt-0.5 block">{u.clinicName || "All Branches"}</span>
                      </div>
                    </div>

                    <div className="pt-1">
                      <Button
                        size="sm"
                        variant={isSelf ? "outline" : "primary"}
                        disabled={isSelf}
                        onClick={() =>
                          setTargetUserToImpersonate({
                            id: u.id,
                            name: u.name,
                            role: u.role,
                            organizationName: u.organizationName,
                            clinicName: u.clinicName,
                          })
                        }
                        className="w-full font-semibold text-xs rounded-xl min-h-[42px] justify-center shadow-xs"
                      >
                        <KeyRound className="w-4 h-4 mr-1.5" />
                        {isSelf ? "Active Session (You)" : `Login As ${u.name}`}
                      </Button>
                    </div>
                  </div>
                );
              }}
              emptyMessage="No users found matching current filters."
            />
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          IMPERSONATION CONFIRMATION MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(targetUserToImpersonate)}
        onClose={() => setTargetUserToImpersonate(null)}
        title="Confirm User Impersonation"
        description="You will enter this user's clinical workstation with their exact role and workspace permissions."
      >
        {targetUserToImpersonate && (
          <div className="space-y-4 pt-1">
            <div className="p-4 bg-primary-500/10 border border-primary-500/20 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm text-text">{targetUserToImpersonate.name}</p>
                <Badge variant="primary" size="sm" className="uppercase font-bold text-[10px]">
                  {targetUserToImpersonate.role}
                </Badge>
              </div>
              <p className="text-xs text-text-muted">
                Organization: <strong className="text-text">{targetUserToImpersonate.organizationName}</strong>
              </p>
              {targetUserToImpersonate.clinicName && (
                <p className="text-xs text-text-muted">
                  Branch: <strong className="text-text">{targetUserToImpersonate.clinicName}</strong>
                </p>
              )}
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400 space-y-1">
              <p className="font-bold">Sticky Return Banner Active</p>
              <p>
                A high-visibility banner will stay pinned at the top allowing you to return to Root Superadmin at any time in 1 click.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTargetUserToImpersonate(null)}
                className="w-full sm:w-auto min-h-[36px]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={impersonatingId === targetUserToImpersonate.id}
                onClick={() => handleStartImpersonation(targetUserToImpersonate)}
                className="w-full sm:w-auto min-h-[36px] font-semibold rounded-xl shadow-xs flex items-center justify-center gap-1.5"
              >
                <KeyRound className="w-4 h-4" />
                Proceed to Login As {targetUserToImpersonate.name}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
