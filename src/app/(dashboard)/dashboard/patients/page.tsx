"use client";

import { useState, useEffect } from "react";
import { useLatestRead } from "@/hooks/useLatestRead";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PatientService } from "@/services/patient.service";
import { AssociatePatientModal } from "@/components/patients/AssociatePatientModal";
import { PatientMrn } from "@/components/patients/PatientMrn";
import Modal from "@/components/queue/QueueDialog";
import styles from "./Patients.module.css";
import { hasAnyPermission } from "@/lib/permissions";
import { Table, Column, Button, Input, Select, useToast, Badge, Dropdown, DatePicker } from "@/components/ui";
import { UserPlus, RotateCw, Search, SlidersHorizontal, User, MoreHorizontal, AlertCircle, CalendarPlus, Activity, ArrowLeft, ArrowRight, Mail, Phone } from "lucide-react";

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
  userId?: PatientUser;
  name?: string;
  phone?: string;
  email?: string;
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

  const canManagePatients = hasAnyPermission(user, "MANAGE_PATIENTS");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loadedScope, setLoadedScope] = useState("");
  const [readError, setReadError] = useState<{ scope: string; message: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const startRead = useLatestRead();
  const [genderFilter, setGenderFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const readScope = JSON.stringify([user?.id, user?.organization_id, page, genderFilter, debouncedSearch]);
  const scopeReady = loadedScope === readScope && search === debouncedSearch;
  const loadError = scopeReady ? readError?.scope === readScope ? readError.message : null : null;
  const loading = !scopeReady;
  const visiblePatients = scopeReady ? patients : [];

  // Register New Patient Modal State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isAssociationOpen, setIsAssociationOpen] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null);
  const [distinctPersonReason, setDistinctPersonReason] = useState("");
  const [registrationRequestId, setRegistrationRequestId] = useState(() => crypto.randomUUID());
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
    setDistinctPersonReason("");
    setRegistrationRequestId(crypto.randomUUID());
  };

  const handleRegisterSubmit = async (e: React.FormEvent, forceIgnoreDuplicate = false) => {
    if (e) e.preventDefault();
    if (registerLoading || !canManagePatients || (duplicateWarning && !forceIgnoreDuplicate)) return;
    if (forceIgnoreDuplicate && !distinctPersonReason.trim()) {
      toast({ title: "Identity review required", description: "Record why this is a different person before creating a separate patient.", variant: "error" });
      return;
    }
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
        clientRequestId: registrationRequestId,
        ...(forceIgnoreDuplicate ? { distinctPersonReason: distinctPersonReason.trim() } : {}),
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

      await PatientService.createPatient(payload);

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
    const request = startRead();
    try {
      setReadError(null);
      setIsRefreshing(true);
      const queryParams = new URLSearchParams();
      if (debouncedSearch.trim()) queryParams.set("search", debouncedSearch.trim());
      if (genderFilter !== "all") queryParams.set("gender", genderFilter);
      queryParams.set("page", String(page));
      queryParams.set("limit", "10");

      const res = await api.get(`/patients?${queryParams.toString()}`, { signal: request.signal });
      if (!request.isCurrent()) return;
      if (!Array.isArray(res.data.data)) throw new Error("Invalid patient response");
      const rawData = res.data.data;

      const totalHeader = res.headers["x-total-count"] || res.headers["total-count"];
      const pagesHeader = res.headers["x-total-pages"] || res.headers["total-pages"];

      const list = Array.isArray(rawData) ? rawData : [];

      setPatients(list);
      setLoadedScope(readScope);
      if (totalHeader) setTotalCount(Number(totalHeader));
      else setTotalCount(list.length);

      if (pagesHeader) setTotalPages(Number(pagesHeader));
      else setTotalPages(1);
    } catch {
      if (!request.isCurrent()) return;
      if (!scopeReady) setPatients([]);
      setLoadedScope(readScope);
      setReadError({ scope: readScope, message: "Patient records could not be loaded. Check your connection and try again." });
      toast({
        title: "Unable to Load Patients",
        description: "Patient records could not be loaded. Check your connection and try again.",
        variant: "error",
      });
    } finally {
      if (request.isCurrent()) {
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [page, genderFilter, debouncedSearch, user?.id, user?.organization_id]);

  // Debounced auto-search
  useEffect(() => {
    if (search === debouncedSearch) return;
    const timer = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, debouncedSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (page === 1 && search === debouncedSearch) void fetchPatients();
    setPage(1);
    setDebouncedSearch(search);
  };

  const calculateAge = (dobString?: string) => {
    if (!dobString) return "Age not recorded";
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return dobString;
    const diffMs = Date.now() - dob.getTime();
    const ageDate = new Date(diffMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970) + " yrs";
  };


  const columns: Column<PatientRecord>[] = [
    {
      header: "Patient Identity",
      render: (p) => {
        const uName = p.name || p.userId?.name || "Patient Profile";
        const uEmail = p.email ?? p.userId?.email ?? "";
        const uPhone = p.phone ?? p.userId?.phone ?? "";
        return (
          <div className="space-y-0.5 min-w-[160px]">
            <Link href={"/dashboard/patients/" + (p.id || p._id)} className={styles.patientLink}>{uName}</Link>
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
            <p className={styles.mrn}>MRN: {p.mrn || "Not assigned"}</p>
          </div>
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
          {p.bloodGroup && <span className="text-xs text-text-secondary">Blood: {p.bloodGroup}</span>}
        </div>
      ),
    },
    {
      key: "allergies",
      header: "Allergies & Conditions",
      render: (p) => {
        const allergies = p.allergies || [];
        const conditions = p.conditions || [];
        if (allergies.length === 0 && conditions.length === 0) {
          return <span className="text-text-muted text-xs font-normal">Not recorded</span>;
        }
        return (
          <div className="flex flex-wrap gap-1 max-w-[220px]">
            {allergies.map((a, i) => (
              <Badge key={i} variant="warning" size="sm" className="text-[9px] font-bold inline-flex items-center gap-0.5">
                <AlertCircle className="w-2.5 h-2.5" />
                <span>{a}</span>
              </Badge>
            ))}
            {conditions.map((c, i) => (
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
                  className="min-h-11 min-w-11 p-0 rounded-lg text-text-secondary hover:text-text cursor-pointer"
                  aria-label={`Actions for ${p.name || p.userId?.name || "patient"}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              }
              items={[
                {
                  label: "View Patient Profile",
                  icon: <User className="w-4 h-4 text-text-muted" />,
                  onClick: () => router.push(`/dashboard/patients/${pid}`),
                },
                ...(hasAnyPermission(user, "MANAGE_APPOINTMENTS") ? [{
                  label: "Book Appointment",
                  icon: <CalendarPlus className="w-4 h-4 text-accent" />,
                  onClick: () => router.push(`/dashboard/appointments?patientId=${pid}`),
                }] : []),
                ...(hasAnyPermission(user, "VIEW_EHR") ? [{
                  label: "Medical EHR Timeline",
                  icon: <Activity className="w-4 h-4 text-success-text" />,
                  onClick: () => router.push(`/dashboard/patients/${pid}/timeline`),
                }] : []),
              ]}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div className={styles.heading}><h1>Patients</h1><span>{scopeReady ? totalCount : "—"}</span></div>
        <div className={styles.headerActions}><Button variant="ghost" size="sm" className={styles.iconButton} aria-label="Refresh patients" disabled={isRefreshing} onClick={fetchPatients}><RotateCw size={17} className={isRefreshing ? "animate-spin" : ""} /></Button>
          {canManagePatients && <Button size="sm" onClick={() => { resetRegisterForm(); setIsRegisterOpen(true); }}><UserPlus size={16} /> Register patient</Button>}
          {canManagePatients && hasAnyPermission(user, "REVIEW_PATIENT_IDENTITY") && <Dropdown align="right" trigger={<Button variant="ghost" size="sm" className={styles.iconButton} aria-label="Patient directory options"><MoreHorizontal size={18} /></Button>} items={[{ label: "Link existing patient", onClick: () => setIsAssociationOpen(true) }]} />}
        </div>
      </header>
      <section className={styles.toolbar} aria-label="Patient search and filters">
        <form onSubmit={handleSearchSubmit} className={styles.searchRow}>
          <Input type="search" icon={<Search size={16} />} placeholder="Name, phone, email or MRN" aria-label="Search patients by name, email or phone" value={search} onChange={event => setSearch(event.target.value)} onClear={() => { setSearch(""); setPage(1); }} />
          <Button variant="outline" size="sm" className={styles.filterButton} aria-label={genderFilter === "all" ? "Filters: Filter patients" : `Filter patients: ${genderFilter}`} onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={16} /><span className={styles.filterLabel}>{genderFilter === "all" ? "Filters" : genderFilter}</span>{genderFilter !== "all" && <i />}</Button>
        </form>
        <div className={styles.resultSummary}><span>{genderFilter === "all" ? "All patients" : genderFilter.charAt(0).toUpperCase() + genderFilter.slice(1) + " patients"}</span><span role="status">{loading ? "Loading patients…" : isRefreshing ? "Updating…" : totalCount + " matches"}</span></div>
      </section>
      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter patients" size="sm" footer={<><Button variant="outline" onClick={() => { setGenderFilter("all"); setPage(1); }}>Reset</Button><Button onClick={() => setFiltersOpen(false)}>Done</Button></>}>
        <Select label="Gender" value={genderFilter} onChange={event => { setGenderFilter(event.target.value); setPage(1); }} options={[{ value: "all", label: "All genders" }, { value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }]} />
      </Modal>
      <section className={styles.results} aria-label="Patient directory results">
          <Table
            variant="flat"
            density="compact"
            fitContent
            showColumnVisibility={false}
              error={loadError}
              onRetry={fetchPatients}
            columns={columns}
            data={visiblePatients}
            loading={loading || isRefreshing}
            searchable={false}
            pagination={false}
            mobileCardView={true}
            renderMobileCard={(patient: PatientRecord) => {
              const pid = patient.id || patient._id, name = patient.name || patient.userId?.name || "Patient", phone = patient.phone ?? patient.userId?.phone, email = patient.email ?? patient.userId?.email;
              return <article className={styles.patientCard}>
                <div className={styles.cardHeading}><span className={styles.avatar}>{name.charAt(0).toUpperCase()}</span><div><Link href={"/dashboard/patients/" + pid} className={styles.patientLink}>{name}</Link><p>{[patient.gender, patient.dob ? calculateAge(patient.dob) : null, patient.bloodGroup].filter(Boolean).join(" · ") || "Demographics not recorded"}</p></div><Dropdown align="right" trigger={<Button variant="ghost" size="sm" className={styles.iconButton} aria-label={"Actions for " + name}><MoreHorizontal size={18} /></Button>} items={[
                  { label: "View patient profile", onClick: () => router.push("/dashboard/patients/" + pid) },
                  ...(hasAnyPermission(user, "MANAGE_APPOINTMENTS") ? [{ label: "Book appointment", onClick: () => router.push("/dashboard/appointments?patientId=" + pid) }] : []),
                  ...(hasAnyPermission(user, "VIEW_EHR") ? [{ label: "Medical EHR timeline", onClick: () => router.push("/dashboard/patients/" + pid + "/timeline") }] : [])
                ]} /></div>
                <PatientMrn value={patient.mrn} />
                <div className={styles.contacts}>{phone && <a href={"tel:" + phone}><Phone size={14} />{phone}</a>}{email && <a href={"mailto:" + email}><Mail size={14} />{email}</a>}{!phone && !email && <span>Contact not recorded</span>}</div>
                {!!patient.allergies?.length && <p className={styles.allergy}><AlertCircle size={14} /><span>Allergies: {patient.allergies.join(", ")}</span></p>}
                {!!patient.conditions?.length && <p className={styles.conditions}>{patient.conditions.join(" · ")}</p>}
              </article>;
            }}
            emptyMessage="No patient profiles found matching your search criteria."
          />
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          5. PAGINATION FOOTER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className={styles.pagination}><span>{scopeReady ? visiblePatients.length + " of " + totalCount + " patients" : "Loading patients"}</span></div>
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
              disabled={page <= 1 || loading || isRefreshing}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              className="min-h-[40px] text-xs font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading || isRefreshing}
              onClick={() => setPage((prev) => prev + 1)}
              className="min-h-[40px] text-xs font-semibold"
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
        title="Register patient"
        description="Enter a name and at least one contact. Add other details when available."
        size="lg"
        busy={registerLoading}
        footer={<><Button variant="outline" disabled={registerLoading} onClick={() => { setIsRegisterOpen(false); resetRegisterForm(); }}>Cancel</Button><Button type="submit" form="patient-registration" loading={registerLoading} disabled={!!duplicateWarning}>Register patient</Button></>}
      >
        <form id="patient-registration" onSubmit={(e) => handleRegisterSubmit(e, false)} className="space-y-4 pt-1">
          {duplicateWarning && (
            <div className="p-3.5 bg-warning/10 border border-warning/30 rounded-2xl space-y-2 animate-fade-in text-xs">
              <div className="flex items-center gap-2 font-bold text-warning-text dark:text-warning-text">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Existing Matching Patient Detected</span>
              </div>
              <p className="text-text-secondary leading-relaxed">
                One or more patient profiles match the provided details (Name, Phone, or Email). Please verify if this patient is already enrolled.
              </p>
              {[...(duplicateWarning.highConfidenceMatches || []), ...(duplicateWarning.mediumConfidenceMatches || [])].map((candidate: { id: string; name?: string; phone?: string; mrn?: string }) => <Link key={candidate.id} href={`/dashboard/patients/${candidate.id}`} className="block min-h-11 rounded-lg border border-border p-2 text-primary hover:underline">Review {candidate.name || "existing patient"} · {candidate.phone || candidate.mrn}</Link>)}
              <Input label="Why this is a different patient" value={distinctPersonReason} maxLength={500} onChange={event => setDistinctPersonReason(event.target.value)} placeholder="For example, a different family member sharing the contact number" />
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => { setDuplicateWarning(null); setDistinctPersonReason(""); setRegistrationRequestId(crypto.randomUUID()); }}
                  className="w-full sm:w-auto min-h-[38px]"
                >
                  Edit Information
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="primary"
                  onClick={(e) => handleRegisterSubmit(e, true)}
                  loading={registerLoading}
                  disabled={!distinctPersonReason.trim() || registerLoading}
                  className="w-full sm:w-auto min-h-[38px] bg-warning hover:bg-warning text-background font-bold"
                >
                  Create separate patient after review
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
              onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })} type="tel" inputMode="tel"
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
            <DatePicker
              label="Date of Birth"

              value={registerForm.dob}
              onChange={(value) => setRegisterForm({ ...registerForm, dob: value })}
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

          <details className={styles.optionalDetails}><summary>Clinical, address and emergency details</summary><div className="space-y-4">
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
                onChange={(e) => setRegisterForm({ ...registerForm, emergencyContactPhone: e.target.value })} type="tel" inputMode="tel"
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


          </div></details>
        </form>
      </Modal>
      {isAssociationOpen && <AssociatePatientModal onClose={() => setIsAssociationOpen(false)} onAssociated={patientId => { setIsAssociationOpen(false); router.push(`/dashboard/patients/${patientId}`); }} />}
    </div>
  );
}
