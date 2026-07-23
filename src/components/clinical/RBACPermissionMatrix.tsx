"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Table, Badge, Button, Modal, Select, useToast } from "@/components/ui";
import api from "@/lib/api";

export interface UserRoleRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId?: string;
  permissions: string[];
}

interface RBACPermissionMatrixProps {
  users: UserRoleRecord[];
  onRefresh: () => void;
}

const SYSTEM_PERMISSIONS = [
  "VIEW_EHR",
  "MANAGE_PATIENTS",
  "MANAGE_CLINICAL_NOTES",
  "EVALUATE_NEWS2",
  "ORDER_LABS",
  "RECORD_LAB_RESULTS",
  "ADMINISTER_MEDICATIONS",
  "FINALIZING_DISCHARGE",
  "VIEW_ANALYTICS",
  "ADMINISTRATIVE_GOVERNANCE",
];

export function RBACPermissionMatrix({ users, onRefresh }: RBACPermissionMatrixProps) {
  const [selectedUser, setSelectedUser] = useState<UserRoleRecord | null>(null);
  const [newRole, setNewRole] = useState("");
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newRole) return;
    setUpdating(true);
    try {
      await api.put(`/users/${selectedUser.id}/role`, { role: newRole });
      toast({
        title: "Role Updated",
        description: `Successfully assigned role ${newRole.toUpperCase()} to ${selectedUser.name}`,
        variant: "success",
      });
      setSelectedUser(null);
      onRefresh();
    } catch (err: any) {
      toast({
        title: "Role Update Failed",
        description: err.response?.data?.message || "Failed to update user role",
        variant: "error",
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Card className="shadow-md border-border">
      <CardHeader className="border-b border-border pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Role-Based Access Control (RBAC) & Dynamic Permissions</CardTitle>
            <p className="text-xs text-text-secondary mt-0.5">Database-backed permission matrix and user role governance</p>
          </div>
          <Button size="sm" variant="secondary" onClick={onRefresh}>Refresh Governance</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table
          columns={[
            { header: "User Name", accessor: (row) => <span className="font-bold text-xs text-text">{row.name}</span> },
            { header: "Email", accessor: (row) => <span className="text-xs text-text-secondary">{row.email}</span> },
            {
              header: "Assigned Role",
              accessor: (row) => (
                <Badge variant={row.role === "admin" ? "error" : row.role === "doctor" ? "primary" : "info"}>
                  {row.role.toUpperCase()}
                </Badge>
              ),
            },
            {
              header: "Active Permissions",
              accessor: (row) => (
                <div className="flex flex-wrap gap-1 max-w-md">
                  {(row.permissions && row.permissions.length > 0 ? row.permissions : ["VIEW_EHR"]).map((perm, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-hover border border-border text-text">
                      {perm}
                    </span>
                  ))}
                </div>
              ),
            },
            {
              header: "Actions",
              accessor: (row) => (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedUser(row);
                    setNewRole(row.role);
                  }}
                >
                  Edit Role
                </Button>
              ),
            },
          ]}
          data={users}
        />
      </CardContent>

      {/* Edit Role Modal */}
      {selectedUser && (
        <Modal isOpen={!!selectedUser} onClose={() => setSelectedUser(null)} title={`Modify Role for ${selectedUser.name}`}>
          <form onSubmit={handleUpdateRole} className="space-y-4">
            <Select
              label="Select User Role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              options={[
                { value: "admin", label: "Administrator (Full System Governance)" },
                { value: "doctor", label: "Attending Doctor (EHR, Notes, Orders, Discharge)" },
                { value: "receptionist", label: "Staff Nurse / Receptionist (MAR, Intake, Search)" },
                { value: "patient", label: "Patient (Personal Health Record Access)" },
              ]}
              required
            />

            <div className="p-3 bg-surface-hover rounded-xl border border-border space-y-1 text-xs">
              <div className="font-bold text-text">System Permissions Assigned to Role:</div>
              <div className="flex flex-wrap gap-1 pt-1">
                {SYSTEM_PERMISSIONS.map((perm, idx) => (
                  <span key={idx} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-primary-500/10 text-primary-700">
                    {perm}
                  </span>
                ))}
              </div>
            </div>

            <Button type="submit" loading={updating} fullWidth variant="primary">
              Save Role Governance
            </Button>
          </form>
        </Modal>
      )}
    </Card>
  );
}
