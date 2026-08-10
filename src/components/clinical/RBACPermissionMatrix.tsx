"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Table,
  Badge,
  Button,
  Modal,
  Select,
  Input,
  Checkbox,
  Tabs,
  useToast,
  Spinner,
  cn,
} from "@/components/ui";
import api from "@/lib/api";

export interface UserRoleRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId?: string;
  permissions?: string[];
}

export interface RoleRecord {
  id?: string;
  name: string;
  description: string;
  permissions: string[];
  isSystemRole: boolean;
}

export interface PermissionItem {
  code: string;
  name: string;
  category: string;
  description: string;
}

interface RBACPermissionMatrixProps {
  users: UserRoleRecord[];
  onRefresh: () => void;
}

export function RBACPermissionMatrix({ users, onRefresh }: RBACPermissionMatrixProps) {
  const { toast } = useToast();

  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [permissionsCatalog, setPermissionsCatalog] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // User Role Switcher Modal State
  const [selectedUser, setSelectedUser] = useState<UserRoleRecord | null>(null);
  const [targetRole, setTargetRole] = useState("");
  const [roleUpdating, setRoleUpdating] = useState(false);

  // Matrix Active Selected Role for Editing Permissions
  const [activeMatrixRole, setActiveMatrixRole] = useState<string>("doctor");
  const [matrixPermissions, setMatrixPermissions] = useState<string[]>([]);
  const [savingMatrix, setSavingMatrix] = useState(false);

  // Custom Role Builder State
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([]);
  const [creatingRole, setCreatingRole] = useState(false);

  // Search Query States
  const [matrixSearchQuery, setMatrixSearchQuery] = useState("");
  const [customSearchQuery, setCustomSearchQuery] = useState("");

  // Preset Role Permission Mapping Fallbacks
  const PRESET_PERMISSIONS_MAP: Record<string, string[]> = {
    clinic_manager: [
      "VIEW_PATIENTS", "MANAGE_PATIENTS", "OPD_CHECKIN", "QUEUE_MANAGE",
      "VIEW_APPOINTMENTS", "MANAGE_APPOINTMENTS", "INVOICE_VIEW", "INVOICE_CREATE",
      "INVOICE_COLLECT", "PHARMACY_VIEW", "PHARMACY_DISPENSE", "LAB_VIEW", "INVENTORY_VIEW"
    ],
    receptionist: [
      "VIEW_PATIENTS", "MANAGE_PATIENTS", "OPD_CHECKIN", "QUEUE_MANAGE",
      "VIEW_APPOINTMENTS", "MANAGE_APPOINTMENTS"
    ],
    cashier: [
      "VIEW_PATIENTS", "INVOICE_VIEW", "INVOICE_CREATE", "INVOICE_COLLECT"
    ],
    pharmacist: [
      "PHARMACY_VIEW", "PHARMACY_MANAGE", "PHARMACY_DISPENSE", "INVENTORY_VIEW"
    ],
    nurse: [
      "VIEW_PATIENTS", "EVALUATE_NEWS2", "VITALS_RECORD", "MAR_ADMINISTER", "BED_TRANSFER"
    ],
    doctor: [
      "VIEW_PATIENTS", "VIEW_EHR", "MANAGE_CLINICAL_NOTES", "PRESCRIBE_MEDICINE", "ORDER_LAB_TESTS"
    ],
    lab_tech: [
      "LAB_VIEW", "LAB_MANAGE", "LAB_COLLECT_SAMPLE", "LAB_UPLOAD_RESULT"
    ],
  };

  const getPresetPermissions = (presetRoleName: string): string[] => {
    const presetRoleObj = roles.find((r) => r.name === presetRoleName);
    let perms: string[] = presetRoleObj?.permissions || [];

    if (perms.length === 0 && PRESET_PERMISSIONS_MAP[presetRoleName]) {
      perms = PRESET_PERMISSIONS_MAP[presetRoleName];
    }

    if (presetRoleName === "clinic_manager") {
      const catalogManagerCodes = permissionsCatalog
        .map((p) => p.code)
        .filter((code) =>
          code.startsWith("OPD_") ||
          code.startsWith("INVOICE_") ||
          code.startsWith("PHARMACY_") ||
          code.startsWith("PATIENT_") ||
          code.startsWith("QUEUE_") ||
          code.startsWith("APPOINTMENT_")
        );
      perms = Array.from(new Set([...PRESET_PERMISSIONS_MAP.clinic_manager, ...catalogManagerCodes]));
    }

    return perms;
  };

  const isPresetActive = (presetRoleName: string): boolean => {
    const perms = getPresetPermissions(presetRoleName);
    if (perms.length === 0) return false;
    return perms.every((p) => newRolePermissions.includes(p));
  };

  const handleTogglePresetPermissions = (presetRoleName: string) => {
    const permsTarget = getPresetPermissions(presetRoleName);
    if (permsTarget.length === 0) {
      toast({
        title: "No Permissions Found",
        description: `Could not find preset permissions for '${presetRoleName}'.`,
        variant: "warning",
      });
      return;
    }

    const isActive = permsTarget.every((p) => newRolePermissions.includes(p));
    let updated: string[] = [];

    if (isActive) {
      // Deselect all permissions associated with this preset
      updated = newRolePermissions.filter((p) => !permsTarget.includes(p));
      toast({
        title: "Preset Role Deselected",
        description: `Deselected permissions for '${presetRoleName.replace("_", " ").toUpperCase()}'. Total selected: ${updated.length}`,
        variant: "info",
      });
    } else {
      // Select all permissions associated with this preset
      updated = Array.from(new Set([...newRolePermissions, ...permsTarget]));
      toast({
        title: "Preset Role Selected! ⚡",
        description: `Selected ${permsTarget.length} permissions for '${presetRoleName.replace("_", " ").toUpperCase()}'. Total selected: ${updated.length}`,
        variant: "success",
      });
    }

    setNewRolePermissions(updated);
  };

  const fetchRBACData = async () => {
    try {
      setLoading(true);
      const [rolesRes, catalogRes] = await Promise.all([
        api.get("/roles").catch(() => ({ data: { data: [] } })),
        api.get("/permissions").catch(() => ({ data: { data: [] } })),
      ]);

      const loadedRoles: RoleRecord[] = rolesRes.data?.data || [];
      const loadedCatalog: PermissionItem[] = catalogRes.data?.data || [];

      setRoles(loadedRoles);
      setPermissionsCatalog(loadedCatalog);

      if (loadedRoles.length > 0) {
        const defaultRole = loadedRoles.find((r) => r.name === "doctor") || loadedRoles[0];
        setActiveMatrixRole(defaultRole.name);
        setMatrixPermissions(defaultRole.permissions || []);
      }
    } catch (err: any) {
      toast({
        title: "Failed to Load Governance Matrix",
        description: err.response?.data?.message || "Could not fetch roles and permissions catalog",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRBACData();
  }, []);

  const MANDATORY_ADMIN_PERMISSIONS = [
    "ADMINISTRATIVE_GOVERNANCE",
    "MANAGE_STAFF",
    "MANAGE_CLINICS",
    "MANAGE_ORGANIZATION",
    "MANAGE_BILLING",
    "VIEW_PATIENTS",
    "MANAGE_PATIENTS",
    "VIEW_ANALYTICS",
    "VIEW_AUDIT_LOGS",
  ];

  // When active matrix role changes, sync matrix permissions state
  const handleRoleSelectChange = (roleName: string) => {
    setActiveMatrixRole(roleName);
    const found = roles.find((r) => r.name === roleName);
    let perms = found?.permissions || [];
    if (roleName === "admin" || roleName === "root") {
      perms = Array.from(new Set([...perms, ...MANDATORY_ADMIN_PERMISSIONS]));
    }
    setMatrixPermissions(perms);
  };

  const handleToggleMatrixPermission = (code: string) => {
    const isMandatoryAdminPerm =
      (activeMatrixRole === "admin" || activeMatrixRole === "root") &&
      MANDATORY_ADMIN_PERMISSIONS.includes(code);

    if (isMandatoryAdminPerm) {
      toast({
        title: "Protected Core Entitlement 🔒",
        description: `'${code}' is a mandatory administrative governance permission and cannot be disabled on the ${activeMatrixRole.toUpperCase()} role.`,
        variant: "warning",
      });
      return;
    }

    setMatrixPermissions((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]
    );
  };

  const handleSaveMatrixPermissions = async () => {
    if (!activeMatrixRole) return;
    try {
      setSavingMatrix(true);
      await api.put(`/roles/${activeMatrixRole}`, {
        permissions: matrixPermissions,
      });

      toast({
        title: "Role Permissions Updated",
        description: `Successfully saved ${matrixPermissions.length} permissions for role '${activeMatrixRole.toUpperCase()}'`,
        variant: "success",
      });

      // Update local state
      setRoles((prev) =>
        prev.map((r) => (r.name === activeMatrixRole ? { ...r, permissions: matrixPermissions } : r))
      );
      onRefresh();
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err.response?.data?.message || "Failed to update role permissions",
        variant: "error",
      });
    } finally {
      setSavingMatrix(false);
    }
  };

  const handleAssignUserRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !targetRole) return;
    try {
      setRoleUpdating(true);
      await api.put(`/users/${selectedUser.id}/role`, { role: targetRole });
      toast({
        title: "User Role Updated",
        description: `Assigned role '${targetRole.toUpperCase()}' to ${selectedUser.name}`,
        variant: "success",
      });
      setSelectedUser(null);
      onRefresh();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.response?.data?.message || "Failed to reassign user role",
        variant: "error",
      });
    } finally {
      setRoleUpdating(false);
    }
  };

  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    try {
      setCreatingRole(true);
      const res = await api.post("/roles", {
        name: newRoleName,
        description: newRoleDesc,
        permissions: newRolePermissions,
      });

      toast({
        title: "Custom Role Created",
        description: `Facility role '${res.data?.data?.name || newRoleName}' created successfully.`,
        variant: "success",
      });

      setCustomModalOpen(false);
      setNewRoleName("");
      setNewRoleDesc("");
      setNewRolePermissions([]);
      fetchRBACData();
    } catch (err: any) {
      toast({
        title: "Role Creation Failed",
        description: err.response?.data?.message || "Could not create custom role",
        variant: "error",
      });
    } finally {
      setCreatingRole(false);
    }
  };

  // Group permission catalog by category
  const permissionCategories = Array.from(
    new Set(permissionsCatalog.map((p) => p.category || "General Governance"))
  );

  const selectedRoleObj = roles.find((r) => r.name === activeMatrixRole);

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Spinner size="lg" label="Loading Role-Based Access Control Governance..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-text">RBAC Permission Matrix & Governance Console</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Database-backed permission tables, granular system entitlement policies, and role management.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="xs"
            variant="outline"
            onClick={() => setCustomModalOpen(true)}
            className="rounded-xl font-semibold"
          >
            + Create Custom Role
          </Button>
          <Button size="xs" variant="primary" onClick={fetchRBACData} className="rounded-xl font-bold">
            Refresh Matrix
          </Button>
        </div>
      </div>

      <Tabs
        tabs={[
          {
            id: "matrix",
            label: `Role Permission Matrix (${roles.length} Roles)`,
            content: (
              <Card className="rounded-2xl border border-border bg-surface shadow-xs">
                <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base font-bold text-text">
                      Granular Entitlement Matrix
                    </CardTitle>
                    <CardDescription className="text-xs text-text-muted">
                      Select a role below to view and modify its active system permissions.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      size="sm"
                      value={activeMatrixRole}
                      onChange={(e) => handleRoleSelectChange(e.target.value)}
                      options={roles.map((r) => ({
                        value: r.name,
                        label: `${r.isSystemRole ? "🔒" : "⚙️"} ${r.name.toUpperCase()} (${(r.permissions || []).length} perms)`,
                      }))}
                      className="w-56 text-xs font-semibold"
                    />

                    <Button
                      size="sm"
                      variant="primary"
                      onClick={handleSaveMatrixPermissions}
                      loading={savingMatrix}
                      className="rounded-xl font-bold shrink-0"
                    >
                      Save Matrix Changes
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 space-y-5">
                  {/* Selected Role Meta Banner */}
                  {selectedRoleObj && (
                    <div className="p-3 bg-surface-alt rounded-xl border border-border/80 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-text text-sm capitalize">{selectedRoleObj.name} Role</span>
                          <Badge variant={selectedRoleObj.isSystemRole ? "neutral" : "primary"}>
                            {selectedRoleObj.isSystemRole ? "System Built-in" : "Custom Facility Role"}
                          </Badge>
                          <Badge variant="success" size="sm">
                            {matrixPermissions.length} Active Permissions
                          </Badge>
                        </div>
                        <p className="text-text-muted mt-0.5">{selectedRoleObj.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setMatrixPermissions(permissionsCatalog.map((p) => p.code))}
                        >
                          Select All
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setMatrixPermissions([])}
                        >
                          Clear All
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Grouped Permission Checkbox Grid */}
                  <div className="space-y-6">
                    {permissionCategories.map((cat) => {
                      const catPerms = permissionsCatalog.filter((p) => p.category === cat);
                      return (
                        <div key={cat} className="space-y-2">
                          <h4 className="text-xs font-bold text-primary-600 uppercase tracking-wider border-b border-border/60 pb-1">
                            {cat}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {catPerms.map((perm) => {
                              const isProtectedAdminPerm =
                                (activeMatrixRole === "admin" || activeMatrixRole === "root") &&
                                MANDATORY_ADMIN_PERMISSIONS.includes(perm.code);
                              const isChecked = isProtectedAdminPerm || matrixPermissions.includes(perm.code);

                              return (
                                <div
                                  key={perm.code}
                                  onClick={() => handleToggleMatrixPermission(perm.code)}
                                  className={cn(
                                    "p-3 rounded-xl border transition-all cursor-pointer select-none relative overflow-hidden",
                                    isProtectedAdminPerm
                                      ? "bg-amber-500/10 border-amber-500/40 text-text shadow-2xs"
                                      : isChecked
                                      ? "bg-primary-500/10 border-primary-500/40 text-text shadow-2xs"
                                      : "bg-surface-alt/50 border-border/60 text-text-muted hover:border-border"
                                  )}
                                >
                                  <div className="flex items-start gap-2.5">
                                    <Checkbox
                                      checked={isChecked}
                                      onChange={() => {}}
                                      className="mt-0.5 pointer-events-none"
                                    />
                                      <div className="space-y-0.5 min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 justify-between">
                                          <p className="font-bold text-xs text-text truncate">{perm.name}</p>
                                          {isProtectedAdminPerm && (
                                            <span
                                              title="Mandatory System Core Entitlement: Protected to prevent administrative lockout."
                                              className="shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center gap-1 cursor-help"
                                            >
                                              <span>🔒</span> System Core
                                            </span>
                                          )}
                                        </div>
                                        <p className="font-mono text-[10px] text-text-muted">{perm.code}</p>
                                        <p className="text-[11px] text-text-secondary leading-snug">{perm.description}</p>
                                        {isProtectedAdminPerm && (
                                          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold pt-1 flex items-center gap-1">
                                            <span>🔒</span> Mandatory Admin Entitlement (Prevents Self-Lockout)
                                          </p>
                                        )}
                                      </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ),
          },
          {
            id: "users",
            label: `Staff Role Assignments (${users.length} Users)`,
            content: (
              <Card className="rounded-2xl border border-border bg-surface shadow-xs">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold">Staff Role Assignments</CardTitle>
                  <CardDescription className="text-xs text-text-muted">
                    Assign and manage active operational roles for organization staff members.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Table
                    columns={[
                      {
                        header: "Staff Member",
                        accessor: (u) => (
                          <div className="space-y-0.5">
                            <span className="font-bold text-xs text-text block">{u.name}</span>
                            <span className="text-[11px] text-text-muted">{u.email}</span>
                          </div>
                        ),
                      },
                      {
                        header: "Assigned System Role",
                        accessor: (u) => {
                          let variant: "error" | "primary" | "warning" | "success" | "neutral" = "neutral";
                          if (u.role === "admin" || u.role === "root") variant = "error";
                          else if (u.role === "doctor") variant = "primary";
                          else if (u.role === "receptionist" || u.role === "nurse") variant = "warning";
                          return (
                            <Badge variant={variant} className="capitalize font-bold">
                              {u.role}
                            </Badge>
                          );
                        },
                      },
                      {
                        header: "Granted Permission Codes",
                        accessor: (u) => {
                          const userRoleObj = roles.find((r) => r.name === u.role);
                          const perms = userRoleObj?.permissions || u.permissions || [];
                          return (
                            <div className="flex flex-wrap gap-1 max-w-lg">
                              {perms.slice(0, 5).map((p, i) => (
                                <Badge key={i} variant="neutral" size="sm" className="font-mono text-[9px]">
                                  {p}
                                </Badge>
                              ))}
                              {perms.length > 5 && (
                                <span className="text-[10px] text-text-muted self-center">
                                  +{perms.length - 5} more
                                </span>
                              )}
                            </div>
                          );
                        },
                      },
                      {
                        header: "Actions",
                        align: "right",
                        accessor: (u) => (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => {
                              setSelectedUser(u);
                              setTargetRole(u.role);
                            }}
                            className="rounded-lg font-semibold"
                          >
                            Edit Role
                          </Button>
                        ),
                      },
                    ]}
                    data={users}
                    searchable={true}
                    searchPlaceholder="Search staff by name, email, or role..."
                  />
                </CardContent>
              </Card>
            ),
          },
        ]}
      />

      {/* User Role Switcher Modal */}
      {selectedUser && (
        <Modal
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          title={`✏️ Modify Role for ${selectedUser.name}`}
        >
          <form onSubmit={handleAssignUserRole} className="space-y-4 text-xs">
            <div className="p-3 bg-surface-alt rounded-xl border border-border space-y-1">
              <span className="font-bold text-text block">{selectedUser.name}</span>
              <span className="text-text-muted">{selectedUser.email}</span>
            </div>

            <Select
              label="Select Operational Role *"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              options={roles.map((r) => ({
                value: r.name,
                label: `${r.name.toUpperCase()} — ${r.description}`,
              }))}
              required
            />

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedUser(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={roleUpdating}>
                Save Role Assignment
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Custom Role Builder Modal */}
      <Modal
        isOpen={customModalOpen}
        onClose={() => setCustomModalOpen(false)}
        title="⚙️ Create New Facility Custom Role"
        size="2xl"
      >
        <form onSubmit={handleCreateCustomRole} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Role Name *"
              placeholder="e.g. TPA Desk Officer, Multi-Desk Manager, Chief Radiologist"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              required
            />

            <Input
              label="Role Description"
              placeholder="Describe the duties and scope of this custom role..."
              value={newRoleDesc}
              onChange={(e) => setNewRoleDesc(e.target.value)}
            />
          </div>

          {/* Quick Preset Role Combiner Bar */}
          <div className="space-y-2 p-3.5 rounded-xl bg-primary-500/10 border border-primary-500/30">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-primary-600 dark:text-primary-400">⚡ Combine Role Presets</span>
              <span className="text-[10px] text-text-muted">Click to merge permissions from existing system roles</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { id: "receptionist", label: "Receptionist Desk" },
                { id: "cashier", label: "Cashier Invoicing" },
                { id: "pharmacist", label: "Pharmacy Dispensing" },
                { id: "nurse", label: "Nursing & Triage" },
                { id: "doctor", label: "Doctor Clinical" },
                { id: "lab_tech", label: "Lab Tech LIS" },
                { id: "clinic_manager", label: "All-In-One Clinic Manager" },
              ].map((preset) => {
                const active = isPresetActive(preset.id);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleTogglePresetPermissions(preset.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 select-none",
                      active
                        ? "bg-primary-600 text-white border border-primary-500 shadow-md ring-2 ring-primary-500/30"
                        : "bg-surface border border-border/80 text-text hover:bg-primary-500/10 hover:border-primary-500/50 hover:text-primary-600"
                    )}
                  >
                    <span>{active ? "✓" : "+"}</span>
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>
            {newRolePermissions.length > 0 && (
              <div className="flex items-center justify-between text-[11px] pt-1.5 text-text-secondary border-t border-primary-500/20">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  ✓ {newRolePermissions.length} Total Permissions Selected
                </span>
                <button
                  type="button"
                  onClick={() => setNewRolePermissions([])}
                  className="text-red-500 hover:underline font-semibold cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          {/* Search Permission Input */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-text text-xs">System Permissions Catalog</span>
              <span className="text-[11px] text-text-muted">
                {customSearchQuery.trim()
                  ? `Showing matching search results`
                  : `Select granular permissions below`}
              </span>
            </div>

            <Input
              placeholder="🔍 Search permissions by name, code, or description (e.g. invoice, queue, dispense)..."
              value={customSearchQuery}
              onChange={(e) => setCustomSearchQuery(e.target.value)}
              className="text-xs"
            />

            <div className="max-h-[460px] overflow-y-auto p-4 bg-surface-alt rounded-xl border border-border/80 space-y-5">
              {permissionCategories.map((cat) => {
                const catPerms = permissionsCatalog.filter((p) => {
                  if (p.category !== cat) return false;
                  if (!customSearchQuery.trim()) return true;
                  const q = customSearchQuery.toLowerCase();
                  return (
                    p.name.toLowerCase().includes(q) ||
                    p.code.toLowerCase().includes(q) ||
                    (p.description || "").toLowerCase().includes(q) ||
                    (p.category || "").toLowerCase().includes(q)
                  );
                });

                if (catPerms.length === 0) return null;

                const allCatCodes = catPerms.map((p) => p.code);
                const isCatAllSelected = allCatCodes.every((code) => newRolePermissions.includes(code));

                const toggleCatSelect = () => {
                  if (isCatAllSelected) {
                    setNewRolePermissions(newRolePermissions.filter((code) => !allCatCodes.includes(code)));
                  } else {
                    setNewRolePermissions(Array.from(new Set([...newRolePermissions, ...allCatCodes])));
                  }
                };

                return (
                  <div key={cat} className="space-y-2.5">
                    <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                      <h4 className="text-[11px] font-bold text-primary-600 uppercase tracking-wider">
                        {cat} ({catPerms.length})
                      </h4>
                      <button
                        type="button"
                        onClick={toggleCatSelect}
                        className="text-[10px] text-primary-600 hover:underline font-bold cursor-pointer"
                      >
                        {isCatAllSelected ? "Deselect Category" : "Select Category All"}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {catPerms.map((perm) => {
                        const isChecked = newRolePermissions.includes(perm.code);
                        return (
                          <div
                            key={perm.code}
                            onClick={() => {
                              if (isChecked) {
                                setNewRolePermissions(newRolePermissions.filter((p) => p !== perm.code));
                              } else {
                                setNewRolePermissions([...newRolePermissions, perm.code]);
                              }
                            }}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                              isChecked
                                ? "bg-primary-500/10 border-primary-500/40 text-text shadow-2xs font-semibold"
                                : "bg-surface/60 border-border/60 text-text-muted hover:border-border"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <Checkbox
                                checked={isChecked}
                                onChange={() => {}}
                                className="mt-0.5 pointer-events-none"
                              />
                              <div className="min-w-0">
                                <p className="font-bold text-xs text-text truncate">{perm.name}</p>
                                <p className="font-mono text-[9px] text-text-muted">{perm.code}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-border flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setCustomModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={creatingRole}>
              Create Custom Role
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
