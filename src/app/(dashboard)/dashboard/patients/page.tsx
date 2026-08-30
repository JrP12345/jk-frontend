"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PatientService } from "@/services/patient.service";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Table,
  Column,
  Button,
  Input,
  Select,
  Textarea,
  Modal,
  useToast,
  Badge,
  StatCard,
  SkeletonTable,
  Dropdown,
  cn,
} from "@/components/ui";
import {
  UserPlus,
  RotateCw,
  Search,
  Users,
  FileText,
  User,
  UserCheck,
  MoreHorizontal,
  AlertCircle,
  CalendarPlus,
  Activity,
  ArrowLeft,
  ArrowRight,
  Mail,
  Phone,
  Droplets,
  HeartPulse,
} from "lucide-react";

interface PatientUser {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  phone: string;
}

interface PatientRecord {
  _id: string;
  id: string;
  userId: PatientUser;
  organizationId?: string;
  dob?: string;
  gender?: string;
  bloodGroup?: string;
  allergies?: string[];
  conditions?: string[];
  mrn?: string;
  createdAt?: string;
}

export default function PatientsDirectoryPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Register New Patient Modal State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null);
  const [registerForm, setRegisterForm] = useState({
    name: "",
    phone: "",
    email: "",
    dob: "",
    gender: "male",
    bloodGroup: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    allergies: "",
    conditions: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "Spouse",
  });

  const resetRegisterForm = () => {
    setRegisterForm({
      name: "",
      phone: "",
      email: "",
      dob: "",
      gender: "male",
      bloodGroup: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      allergies: "",
      conditions: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelation: "Spouse",
    });
    setDuplicateWarning(null);
  };

  const handleRegisterSubmit = async (e: React.FormEvent, forceIgnoreDuplicate = false) => {
    if (e) e.preventDefault();
    if (!registerForm.name.trim() || (!registerForm.phone.trim() && !registerForm.email.trim())) {
      toast({
        title: "Validation Error",
        description: "Patient Full Name and either Phone or Email are required.",
        variant: "error",
      });
      return;
    }

    try {
      setRegisterLoading(true);
      const payload: Record<string, unknown> = {
        name: registerForm.name.trim(),
        phone: registerForm.phone.trim() || undefined,
        email: registerForm.email.trim().toLowerCase() || undefined,
        dob: registerForm.dob ? registerForm.dob : undefined,
        gender: registerForm.gender,
        bloodGroup: registerForm.bloodGroup || undefined,
        address: registerForm.address.trim() || undefined,
        city: registerForm.city.trim() || undefined,
        state: registerForm.state.trim() || undefined,
        pincode: registerForm.pincode.trim() || undefined,
        allergies: registerForm.allergies ? registerForm.allergies.split(",").map((s) => s.trim()).filter(Boolean) : [],
        conditions: registerForm.conditions ? registerForm.conditions.split(",").map((s) => s.trim()).filter(Boolean) : [],
        ignoreDuplicate: forceIgnoreDuplicate,
      };

      if (registerForm.emergencyContactName.trim() && registerForm.emergencyContactPhone.trim()) {
        payload.emergencyContacts = [
          {
            name: registerForm.emergencyContactName.trim(),
            relationship: registerForm.emergencyContactRelation,
            phone: registerForm.emergencyContactPhone.trim(),
          },
        ];
      }

      const res = await PatientService.createPatient(payload);
      const created = res.data || res;
      toast({
        title: "Patient Registered 🏥",
        description: `${registerForm.name} has been enrolled into the EMR directory.`,
        variant: "success",
      });
      setIsRegisterOpen(false);
      resetRegisterForm();
      fetchPatients();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setDuplicateWarning(err.response?.data?.details || err.response?.data?.data || err.response?.data);
        toast({
          title: "Potential Duplicate Record Found",
          description: "An existing patient record with similar details was detected. Review below to proceed.",
          variant: "warning",
        });
      } else {
        toast({
          title: "Registration Failed",
          description: err.response?.data?.message || err.message || "Failed to register patient profile.",
          variant: "error",
        });
      }
    } finally {
      setRegisterLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      setIsRefreshing(true);
      const queryParams = new URLSearchParams();
      if (search.trim()) queryParams.set("search", search.trim());
      if (genderFilter !== "all") queryParams.set("gender", genderFilter);
      queryParams.set("page", String(page));
      queryParams.set("limit", "10");

      const res = await api.get(`/patients?${queryParams.toString()}`);
      const rawData = res.data.data || [];

      const totalHeader = res.headers["x-total-count"] || res.headers["total-count"];
      const pagesHeader = res.headers["x-total-pages"] || res.headers["total-pages"];

      const list = Array.isArray(rawData) ? rawData : [];

      setPatients(list);
      if (totalHeader) setTotalCount(Number(totalHeader));
      else setTotalCount(list.length);

      if (pagesHeader) setTotalPages(Number(pagesHeader));
      else setTotalPages(1);
    } catch (err: any) {
      toast({
        title: "Unable to Load Patients",
        description: err.response?.data?.message || "Could not retrieve patient records.",
        variant: "error",
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [page, genderFilter]);

  // Debounced auto-search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchPatients();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPatients();
  };

  const calculateAge = (dobString?: string) => {
    if (!dobString) return "N/A";
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return dobString;
    const diffMs = Date.now() - dob.getTime();
    const ageDate = new Date(diffMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970) + " yrs";
  };

  const maleCount = patients.filter((p) => p.gender === "male").length;
  const femaleCount = patients.filter((p) => p.gender === "female").length;

  const columns: Column<PatientRecord>[] = [
    {
      header: "Patient Identity",
      render: (p) => {
        const uName = p.userId?.name || "Patient Profile";
        const uEmail = p.userId?.email || "";
        const uPhone = p.userId?.phone || "";
        return (
          <div className="space-y-0.5 min-w-[160px]">
            <p className="font-bold text-text text-xs sm:text-sm">{uName}</p>
            <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap">
              {uEmail && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="w-3 h-3 text-text-muted shrink-0" />
                  {uEmail}
                </span>
              )}
              {uPhone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="w-3 h-3 text-text-muted shrink-0" />
                  {uPhone}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: "MRN Code",
      render: (p) => {
        const pid = p.id || p._id;
        const mrnCode = p.mrn || `MRN-${pid.substring(0, 6).toUpperCase()}`;
        return (
          <span className="font-mono text-xs font-bold text-text-secondary px-2 py-0.5 rounded-lg bg-surface-alt border border-border/60">
            {mrnCode}
          </span>
        );
      },
    },
    {
      key: "gender",
      header: "Demographics",
      render: (p) => (
        <div className="space-y-0.5 min-w-[100px]">
          <Badge variant="outline" size="sm" className="capitalize text-[10px] font-bold">
            {p.gender || "Unspecified"}
          </Badge>
          <p className="text-xs text-text-muted">{calculateAge(p.dob)}</p>
        </div>
      ),
    },
    {
      key: "bloodGroup",
      header: "Blood Group",
      render: (p) =>
        p.bloodGroup ? (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-mono font-bold text-[11px]">
            <Droplets className="w-3 h-3 shrink-0" />
            <span>{p.bloodGroup}</span>
          </div>
        ) : (
          <span className="text-text-muted text-xs">&ndash;</span>
        ),
    },
    {
      key: "allergies",
      header: "Allergies & Conditions",
      render: (p) => {
        const allergies = p.allergies || [];
        const conditions = p.conditions || [];
        if (allergies.length === 0 && conditions.length === 0) {
          return <span className="text-text-muted text-xs font-normal">None recorded</span>;
        }
        return (
          <div className="flex flex-wrap gap-1 max-w-[220px]">
            {allergies.slice(0, 2).map((a, i) => (
              <Badge key={i} variant="warning" size="sm" className="text-[9px] font-bold inline-flex items-center gap-0.5">
                <AlertCircle className="w-2.5 h-2.5" />
                <span>{a}</span>
              </Badge>
            ))}
            {conditions.slice(0, 2).map((c, i) => (
              <Badge key={i} variant="outline" size="sm" className="text-[9px]">
                {c}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      header: "Actions",
      align: "right",
      render: (p) => {
        const pid = p.id || p._id;
        return (
          <div className="flex justify-end">
            <Dropdown
              align="right"
              trigger={
                <Button
                  variant="outline"
                  size="xs"
                  className="h-7 w-7 p-0 rounded-lg text-text-secondary hover:text-text cursor-pointer"
                  aria-label="Actions menu"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              }
              items={[
                {
                  label: "View Patient Profile",
                  icon: <User className="w-4 h-4 text-text-muted" />,
                  onClick: () => router.push(`/dashboard/patients/${pid}`),
                },
                {
                  label: "Book Appointment",
                  icon: <CalendarPlus className="w-4 h-4 text-primary-500" />,
                  onClick: () => router.push(`/dashboard/appointments?patientId=${pid}`),
                },
                {
                  label: "Medical EHR Timeline",
                  icon: <Activity className="w-4 h-4 text-emerald-500" />,
                  onClick: () => router.push(`/dashboard/patients/${pid}/timeline`),
                },
              ]}
            />
          </div>
        );
      },
    },
  ];

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
                Patient Directory
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                EMR Directory
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Search, manage, and view electronic health records across your organization.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPatients}
              disabled={isRefreshing}
              className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors"
            >
              <RotateCw className={cn("h-3.5 w-3.5 mr-1.5 text-text-secondary", isRefreshing && "animate-spin")} />
              Refresh
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                resetRegisterForm();
                setIsRegisterOpen(true);
              }}
              className="font-semibold rounded-xl shadow-xs cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5 mr-1" />
              Register Patient
            </Button>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. SUMMARY KPI STAT CARDS
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Patients"
          value={(totalCount || patients.length).toString()}
          description="Registered profiles in system"
          icon={<Users className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Directory Page Count"
          value={patients.length.toString()}
          description="Currently displayed on page"
          icon={<FileText className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Male Demographic"
          value={maleCount.toString()}
          description="Registered male patients"
          icon={<User className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Female Demographic"
          value={femaleCount.toString()}
          description="Registered female patients"
          icon={<UserCheck className="w-5 h-5 text-text-secondary" />}
        />
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          3. FILTER AND SEARCH BAR
         ────────────────────────────────────────────────────────────────────────── */}
      <Card className="p-3.5 sm:p-4 rounded-2xl border border-border/80 bg-surface shadow-xs">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <div className="sm:col-span-2 flex gap-2">
            <Input
              size="sm"
              icon={<Search className="w-4 h-4 text-text-muted" />}
              placeholder="Search patient by name, email, or phone number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => {
                setSearch("");
                setPage(1);
              }}
              className="w-full"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={loading}
              className="font-semibold rounded-xl shrink-0 shadow-xs"
            >
              Search
            </Button>
          </div>

          <Select
            value={genderFilter}
            onChange={(e) => {
              setGenderFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs"
            options={[
              { label: "All Genders", value: "all" },
              { label: "Male Only", value: "male" },
              { label: "Female Only", value: "female" },
              { label: "Other", value: "other" },
            ]}
          />
        </form>
      </Card>

      {/* ──────────────────────────────────────────────────────────────────────────
          4. MAIN PATIENTS TABLE CARD
         ────────────────────────────────────────────────────────────────────────── */}
      <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/60 bg-surface-alt/30">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-text">Registered Patient Profiles</CardTitle>
              <CardDescription className="text-xs text-text-muted mt-0.5">
                Select a patient record to view medical history, past encounters, and lab diagnostic reports.
              </CardDescription>
            </div>
            <Badge variant="neutral" size="sm" className="font-semibold text-[10px]">
              {totalCount || patients.length} Records
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table
            columns={columns}
            data={patients}
            loading={loading}
            searchable={false}
            pagination={false}
            onRowClick={(p) => router.push(`/dashboard/patients/${p.id || p._id}`)}
            emptyMessage="No patient profiles found matching your search criteria."
          />
        </CardContent>
      </Card>

      {/* ──────────────────────────────────────────────────────────────────────────
          5. PAGINATION FOOTER
         ────────────────────────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-text-muted">
            Page <span className="font-bold text-text">{page}</span> of{" "}
            <span className="font-bold text-text">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              className="rounded-xl text-xs font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((prev) => prev + 1)}
              className="rounded-xl text-xs font-semibold"
            >
              Next
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
      {/* ──────────────────────────────────────────────────────────────────────────
          6. REGISTER NEW PATIENT MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isRegisterOpen}
        onClose={() => {
          setIsRegisterOpen(false);
          resetRegisterForm();
        }}
        title="🏥 Register New Patient Profile"
        description="Enroll a new or walk-in patient into the medical directory with comprehensive demographics."
        size="lg"
      >
        <form onSubmit={(e) => handleRegisterSubmit(e, false)} className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1">
          {duplicateWarning && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2 animate-fade-in text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Existing Matching Patient Detected</span>
              </div>
              <p className="text-text-secondary leading-relaxed">
                One or more patient profiles match the provided details (Name, Phone, or Email). Please verify if this patient is already enrolled.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => resetRegisterForm()}
                >
                  Edit Information
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="primary"
                  onClick={(e) => handleRegisterSubmit(e, true)}
                  loading={registerLoading}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  Proceed Anyway (Create Walk-in)
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Full Name *"
              placeholder="e.g. Rajesh Kumar"
              value={registerForm.name}
              onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
              required
            />
            <Input
              label="Primary Phone Number"
              placeholder="e.g. +91 9876543210"
              value={registerForm.phone}
              onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Input
              label="Email Address"
              type="email"
              placeholder="e.g. rajesh@example.com"
              value={registerForm.email}
              onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
            />
            <Input
              label="Date of Birth"
              type="date"
              value={registerForm.dob}
              onChange={(e) => setRegisterForm({ ...registerForm, dob: e.target.value })}
            />
            <Select
              label="Gender *"
              value={registerForm.gender}
              onChange={(e) => setRegisterForm({ ...registerForm, gender: e.target.value })}
              options={[
                { label: "Male", value: "male" },
                { label: "Female", value: "female" },
                { label: "Other", value: "other" },
              ]}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Select
              label="Blood Group"
              value={registerForm.bloodGroup}
              onChange={(e) => setRegisterForm({ ...registerForm, bloodGroup: e.target.value })}
              options={[
                { label: "Select Blood Group", value: "" },
                { label: "A+", value: "A+" },
                { label: "A-", value: "A-" },
                { label: "B+", value: "B+" },
                { label: "B-", value: "B-" },
                { label: "O+", value: "O+" },
                { label: "O-", value: "O-" },
                { label: "AB+", value: "AB+" },
                { label: "AB-", value: "AB-" },
              ]}
            />
            <Input
              label="Residential Street Address"
              placeholder="e.g. Flat 402, Green Valley Apts"
              value={registerForm.address}
              onChange={(e) => setRegisterForm({ ...registerForm, address: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Input
              label="City"
              placeholder="e.g. Mumbai"
              value={registerForm.city}
              onChange={(e) => setRegisterForm({ ...registerForm, city: e.target.value })}
            />
            <Input
              label="State"
              placeholder="e.g. Maharashtra"
              value={registerForm.state}
              onChange={(e) => setRegisterForm({ ...registerForm, state: e.target.value })}
            />
            <Input
              label="Postal Code (Pincode)"
              placeholder="e.g. 400001"
              value={registerForm.pincode}
              onChange={(e) => setRegisterForm({ ...registerForm, pincode: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Known Drug / Food Allergies"
              placeholder="e.g. Penicillin, Sulfa, Peanuts"
              value={registerForm.allergies}
              onChange={(e) => setRegisterForm({ ...registerForm, allergies: e.target.value })}
            />
            <Input
              label="Chronic Pre-existing Conditions"
              placeholder="e.g. Hypertension, Type 2 Diabetes"
              value={registerForm.conditions}
              onChange={(e) => setRegisterForm({ ...registerForm, conditions: e.target.value })}
            />
          </div>

          <div className="p-3 bg-surface-alt/70 border border-border/80 rounded-2xl space-y-3">
            <p className="text-xs font-bold text-text">Emergency Contact Person</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Contact Name"
                placeholder="e.g. Priya Kumar"
                value={registerForm.emergencyContactName}
                onChange={(e) => setRegisterForm({ ...registerForm, emergencyContactName: e.target.value })}
              />
              <Input
                label="Contact Phone"
                placeholder="e.g. +91 9812345678"
                value={registerForm.emergencyContactPhone}
                onChange={(e) => setRegisterForm({ ...registerForm, emergencyContactPhone: e.target.value })}
              />
              <Select
                label="Relationship"
                value={registerForm.emergencyContactRelation}
                onChange={(e) => setRegisterForm({ ...registerForm, emergencyContactRelation: e.target.value })}
                options={[
                  { label: "Spouse", value: "Spouse" },
                  { label: "Parent", value: "Parent" },
                  { label: "Child", value: "Child" },
                  { label: "Sibling", value: "Sibling" },
                  { label: "Guardian", value: "Guardian" },
                  { label: "Friend", value: "Friend" },
                  { label: "Other", value: "Other" },
                ]}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/60">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                setIsRegisterOpen(false);
                resetRegisterForm();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="primary"
              loading={registerLoading}
              className="font-semibold rounded-xl shadow-xs"
            >
              Enroll Patient Profile
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
