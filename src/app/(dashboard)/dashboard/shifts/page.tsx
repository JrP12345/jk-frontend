"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Table,
  StatCard,
  Badge,
  Button,
  Input,
  Select,
  Modal,
  useToast,
  SkeletonCard,
} from "@/components/ui";
import {
  CalendarDays,
  Clock,
  UserCheck,
  Users,
  Building2,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  RefreshCw,
  Moon,
  Sun,
  Sunset,
  ShieldCheck,
  Stethoscope,
  Activity,
  ArrowRightLeft,
} from "lucide-react";

interface ShiftRosterItem {
  id: string;
  staffName: string;
  staffRole: "Nurse" | "Doctor" | "Technician" | "Admin" | "Pharmacist";
  shiftDate: string;
  shiftType: "morning" | "evening" | "night" | "general" | "on_call";
  startTime: string;
  endTime: string;
  ward: string;
  assignedPatientsCount: number;
  status: "scheduled" | "checked_in" | "checked_out" | "absent" | "swapped";
  checkInTime?: string;
  checkOutTime?: string;
  handoverNotes?: string;
  overtimeHours?: number;
}

interface Metrics {
  totalScheduled: number;
  checkedInCount: number;
  morningShifts: number;
  eveningShifts: number;
  nightShifts: number;
  nurseCount: number;
  totalPatientsAssigned: number;
  nurseToPatientRatio: string;
}

export default function NursingShiftRosterPage() {
  const { toast } = useToast();
  const [shifts, setShifts] = useState<ShiftRosterItem[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalScheduled: 0,
    checkedInCount: 0,
    morningShifts: 0,
    eveningShifts: 0,
    nightShifts: 0,
    nurseCount: 0,
    totalPatientsAssigned: 0,
    nurseToPatientRatio: "1:4.0",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWard, setSelectedWard] = useState("ALL");
  const [selectedRole, setSelectedRole] = useState("ALL");
  const [selectedShiftType, setSelectedShiftType] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [activeShiftForHandover, setActiveShiftForHandover] = useState<ShiftRosterItem | null>(null);
  const [handoverText, setHandoverText] = useState("");

  const [formData, setFormData] = useState({
    staffName: "",
    staffRole: "Nurse",
    shiftDate: new Date().toISOString().split("T")[0],
    shiftType: "morning",
    startTime: "07:00",
    endTime: "15:00",
    ward: "ICU Ward A",
    assignedPatientsCount: 4,
  });

  useEffect(() => {
    fetchShifts();
  }, [selectedWard, selectedRole, selectedShiftType]);

  const fetchShifts = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (selectedWard !== "ALL") queryParams.append("ward", selectedWard);
      if (selectedRole !== "ALL") queryParams.append("staffRole", selectedRole);
      if (selectedShiftType !== "ALL") queryParams.append("shiftType", selectedShiftType);

      const res = await api.get(`/shifts?${queryParams.toString()}`);
      if (res.data && res.data.success) {
        setShifts(res.data.data.shifts || []);
        if (res.data.data.metrics) setMetrics(res.data.data.metrics);
      }
    } catch (err: any) {
      console.error("Error fetching shifts:", err);
      toast({
        title: "Error Loading Roster",
        description: err.response?.data?.message || "Failed to fetch shift roster",
        variant: "error",
      });
      setShifts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/shifts", formData);
      if (res.data && res.data.success) {
        toast({
          title: "Shift Assigned",
          description: `Successfully scheduled shift for ${formData.staffName}`,
          variant: "success",
        });
        setIsAssignModalOpen(false);
        fetchShifts();
      }
    } catch (err: any) {
      toast({
        title: "Assignment Failed",
        description: err.response?.data?.message || "Failed to schedule shift",
        variant: "error",
      });
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const res = await api.patch(`/shifts/${id}/status`, { status: newStatus });
      if (res.data && res.data.success) {
        toast({
          title: "Status Updated",
          description: `Shift status changed to ${newStatus}`,
          variant: "success",
        });
        fetchShifts();
      }
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.response?.data?.message || "Failed to update shift status",
        variant: "error",
      });
    }
  };

  const handleHandoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShiftForHandover) return;
    try {
      const res = await api.patch(`/shifts/${activeShiftForHandover.id}/handover`, {
        handoverNotes: handoverText,
      });
      if (res.data && res.data.success) {
        toast({
          title: "Handover Saved",
          description: "Shift clinical handover notes logged successfully.",
          variant: "success",
        });
        setIsHandoverModalOpen(false);
        setActiveShiftForHandover(null);
        fetchShifts();
      }
    } catch (err: any) {
      toast({
        title: "Handover Failed",
        description: err.response?.data?.message || "Failed to save handover notes",
        variant: "error",
      });
    }
  };

  const filteredShifts = shifts.filter(
    (s) =>
      s.staffName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.ward.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.staffRole.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "checked_in":
        return <Badge variant="success" dot pulse>Checked In</Badge>;
      case "checked_out":
        return <Badge variant="neutral">Checked Out</Badge>;
      case "absent":
        return <Badge variant="danger">Absent</Badge>;
      case "swapped":
        return <Badge variant="warning">Swapped</Badge>;
      default:
        return <Badge variant="primary">Scheduled</Badge>;
    }
  };

  const getShiftTypeBadge = (type: string) => {
    switch (type) {
      case "morning":
        return <Badge variant="info"><Sun className="w-3 h-3 mr-1" /> Morning</Badge>;
      case "evening":
        return <Badge variant="warning"><Sunset className="w-3 h-3 mr-1" /> Evening</Badge>;
      case "night":
        return <Badge variant="primary"><Moon className="w-3 h-3 mr-1" /> Night</Badge>;
      default:
        return <Badge variant="neutral"><Clock className="w-3 h-3 mr-1" /> {type}</Badge>;
    }
  };

  return (
    <div className="space-y-6 w-full font-sans text-text antialiased animate-fade-up pb-32 sm:pb-12">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP EXECUTIVE HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-500/30 before:to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                Staff Shifts & Duty Rostering
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                Staff Duty Roster
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Ward staffing coverage, clinical handover notes, nurse-to-patient ratios & shift check-ins.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full sm:w-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchShifts}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5 text-text-secondary" />
              Refresh
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAssignModalOpen(true)}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] font-semibold rounded-xl shadow-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Assign Shift Roster
            </Button>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. KPI STATS CARDS GRID
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Scheduled Staff"
          value={metrics.totalScheduled.toString()}
          description="Active Roster Shifts"
          icon={<Users className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Checked-In On Duty"
          value={metrics.checkedInCount.toString()}
          description="Verified On-Site"
          icon={<UserCheck className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Nurse-to-Patient Ratio"
          value={metrics.nurseToPatientRatio}
          description="Target Safe Care Standard"
          icon={<Stethoscope className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Inpatients Assigned"
          value={metrics.totalPatientsAssigned.toString()}
          description="Across Ward Beds"
          icon={<Building2 className="w-5 h-5 text-text-secondary" />}
        />
      </div>

      {/* Filters Bar & Search */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
          <div className="w-full md:w-80">
            <Input
              placeholder="Search staff name, ward, role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="w-4 h-4 text-text-muted" />}
            />
          </div>

          <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
            <Select
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              options={[
                { label: "All Wards", value: "ALL" },
                { label: "ICU Ward A", value: "ICU Ward A" },
                { label: "General Ward B", value: "General Ward B" },
                { label: "Pediatrics Ward C", value: "Pediatrics Ward C" },
                { label: "Emergency Dept", value: "Emergency Dept" },
              ]}
            />

            <Select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              options={[
                { label: "All Staff Roles", value: "ALL" },
                { label: "Nurse", value: "Nurse" },
                { label: "Doctor", value: "Doctor" },
                { label: "Technician", value: "Technician" },
                { label: "Admin", value: "Admin" },
              ]}
            />

            <Select
              value={selectedShiftType}
              onChange={(e) => setSelectedShiftType(e.target.value)}
              options={[
                { label: "All Shift Types", value: "ALL" },
                { label: "Morning (07:00-15:00)", value: "morning" },
                { label: "Evening (15:00-23:00)", value: "evening" },
                { label: "Night (23:00-07:00)", value: "night" },
                { label: "On Call", value: "on_call" },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Roster Table */}
      <Card padding="none" className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <Table
            loading={isLoading}
            mobileCardView
            data={filteredShifts}
            emptyMessage="No shifts found matching your criteria."
            renderMobileCard={(s: ShiftRosterItem) => (
              <div
                key={s.id}
                className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-3 relative overflow-hidden transition-all hover:border-primary-500/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-text text-sm">{s.staffName}</h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="neutral" size="sm" className="text-[10px]">{s.staffRole}</Badge>
                      <span className="text-xs text-text-muted">&bull; {s.ward}</span>
                    </div>
                  </div>
                  {getStatusBadge(s.status)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-2 px-3 rounded-xl bg-surface-alt/70 border border-border/50">
                  <div>
                    <span className="text-text-muted text-[10px] uppercase font-bold block">Shift Type</span>
                    <div className="mt-0.5">{getShiftTypeBadge(s.shiftType)}</div>
                  </div>
                  <div>
                    <span className="text-text-muted text-[10px] uppercase font-bold block">Duty Hours</span>
                    <span className="font-mono font-medium text-text mt-0.5 block">{s.startTime} - {s.endTime}</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-border/40 flex items-center justify-between text-text-secondary">
                    <span>Patients Assigned:</span>
                    <span className="font-bold text-text">{s.assignedPatientsCount}</span>
                  </div>
                </div>

                {s.handoverNotes && (
                  <div className="p-2.5 rounded-xl bg-surface-alt/50 border border-border/40 text-xs text-text-muted">
                    <span className="font-semibold text-text block mb-0.5">Handover Notes:</span>
                    <p className="line-clamp-2">{s.handoverNotes}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  {s.status === "scheduled" && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1 min-h-[42px] font-bold text-xs rounded-xl shadow-xs justify-center"
                      onClick={() => handleStatusUpdate(s.id, "checked_in")}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Check In
                    </Button>
                  )}
                  {s.status === "checked_in" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 min-h-[42px] font-bold text-xs rounded-xl justify-center"
                      onClick={() => handleStatusUpdate(s.id, "checked_out")}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Check Out
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 min-h-[42px] font-semibold text-xs rounded-xl justify-center"
                    onClick={() => {
                      setActiveShiftForHandover(s);
                      setHandoverText(s.handoverNotes || "");
                      setIsHandoverModalOpen(true);
                    }}
                  >
                    <FileText className="w-3.5 h-3.5 mr-1 text-text-muted" />
                    Handover
                  </Button>
                </div>
              </div>
            )}
            columns={[
              {
                key: "staff",
                header: "Staff Member & Role",
                render: (s: ShiftRosterItem) => (
                  <div>
                    <div className="font-semibold text-text text-sm">{s.staffName}</div>
                    <Badge variant="neutral" size="sm" className="mt-1">{s.staffRole}</Badge>
                  </div>
                ),
              },
              {
                key: "ward",
                header: "Ward Location & Assigned Patients",
                render: (s: ShiftRosterItem) => (
                  <div>
                    <div className="font-medium text-text text-xs sm:text-sm">{s.ward}</div>
                    <div className="text-xs text-text-muted mt-0.5">{s.assignedPatientsCount} Patients Assigned</div>
                  </div>
                ),
              },
              {
                key: "timing",
                header: "Shift Type & Timings",
                render: (s: ShiftRosterItem) => (
                  <div>
                    <div>{getShiftTypeBadge(s.shiftType)}</div>
                    <div className="text-xs text-text-secondary mt-1 font-mono">{s.startTime} - {s.endTime}</div>
                  </div>
                ),
              },
              {
                key: "status",
                header: "Duty Status & Handover",
                render: (s: ShiftRosterItem) => (
                  <div className="space-y-1">
                    <div>{getStatusBadge(s.status)}</div>
                    {s.handoverNotes && (
                      <div className="text-xs text-text-muted truncate max-w-xs" title={s.handoverNotes}>
                        📝 {s.handoverNotes}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (s: ShiftRosterItem) => (
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[32px] px-2.5 text-xs font-semibold"
                      onClick={() => {
                        setActiveShiftForHandover(s);
                        setHandoverText(s.handoverNotes || "");
                        setIsHandoverModalOpen(true);
                      }}
                    >
                      Handover
                    </Button>
                    {s.status === "scheduled" && (
                      <Button variant="primary" size="sm" className="min-h-[32px] px-2.5 text-xs font-semibold" onClick={() => handleStatusUpdate(s.id, "checked_in")}>
                        Check In
                      </Button>
                    )}
                    {s.status === "checked_in" && (
                      <Button variant="secondary" size="sm" className="min-h-[32px] px-2.5 text-xs font-semibold" onClick={() => handleStatusUpdate(s.id, "checked_out")}>
                        Check Out
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      {/* Modal: Assign Shift */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Shift Roster"
        description="Schedule nursing or medical staff for ward coverage"
        size="lg"
      >
        <form onSubmit={handleCreateShift} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Staff Member Name *</label>
            <Input
              required
              placeholder="e.g. Sr. Nurse Sarah Jenkins"
              value={formData.staffName}
              onChange={(e) => setFormData({ ...formData, staffName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Staff Role *</label>
              <Select
                value={formData.staffRole}
                onChange={(e) => setFormData({ ...formData, staffRole: e.target.value as any })}
                options={[
                  { label: "Nurse", value: "Nurse" },
                  { label: "Doctor", value: "Doctor" },
                  { label: "Technician", value: "Technician" },
                  { label: "Admin", value: "Admin" },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Ward Location *</label>
              <Select
                value={formData.ward}
                onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
                options={[
                  { label: "ICU Ward A", value: "ICU Ward A" },
                  { label: "General Ward B", value: "General Ward B" },
                  { label: "Pediatrics Ward C", value: "Pediatrics Ward C" },
                  { label: "Emergency Dept", value: "Emergency Dept" },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Shift Type</label>
              <Select
                value={formData.shiftType}
                onChange={(e) => setFormData({ ...formData, shiftType: e.target.value as any })}
                options={[
                  { label: "Morning (07:00 - 15:00)", value: "morning" },
                  { label: "Evening (15:00 - 23:00)", value: "evening" },
                  { label: "Night (23:00 - 07:00)", value: "night" },
                  { label: "On Call", value: "on_call" },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Assigned Patients Count</label>
              <Input
                type="number"
                value={formData.assignedPatientsCount}
                onChange={(e) => setFormData({ ...formData, assignedPatientsCount: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-border/60">
            <Button variant="outline" type="button" onClick={() => setIsAssignModalOpen(false)} className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px]">
              Cancel
            </Button>
            <Button variant="primary" type="submit" className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] font-semibold rounded-xl shadow-xs">
              Confirm Shift Schedule
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Handover Notes */}
      <Modal
        isOpen={isHandoverModalOpen}
        onClose={() => setIsHandoverModalOpen(false)}
        title="Shift Handover Notes"
        description={`Log clinical transition notes for ${activeShiftForHandover?.staffName || 'Staff'}`}
        size="md"
      >
        <form onSubmit={handleHandoverSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Clinical Transition & Patient Care Notes</label>
            <textarea
              rows={4}
              required
              placeholder="e.g. Bed 3 ventilator pressure adjusted. Meds administered at 14:00."
              value={handoverText}
              onChange={(e) => setHandoverText(e.target.value)}
              className="w-full p-3 bg-surface-alt border border-border rounded-xl text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-2 border-t border-border/60">
            <Button variant="outline" type="button" onClick={() => setIsHandoverModalOpen(false)} className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px]">
              Cancel
            </Button>
            <Button variant="primary" type="submit" className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] font-semibold rounded-xl shadow-xs">
              Save Clinical Handover
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
