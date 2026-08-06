"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
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
  useToast,
  Badge,
  StatCard,
  SkeletonTable,
  Dropdown,
} from "@/components/ui";

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
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchPatients = async () => {
    try {
      setLoading(true);
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
        title: "Error Loading Patients",
        description: err.response?.data?.message || "Failed to fetch patient directory",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [page, genderFilter]);

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
        const uEmail = p.userId?.email || "No Email";
        return (
          <div className="space-y-0.5">
            <p className="font-bold text-text text-xs sm:text-sm">{uName}</p>
            <p className="text-[11px] text-text-muted">{uEmail}</p>
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
          <Badge variant="outline" size="sm" className="font-mono text-[10px] uppercase font-bold">
            {mrnCode}
          </Badge>
        );
      },
    },
    {
      header: "Gender & Age",
      render: (p) => (
        <div className="space-y-0.5">
          <p className="capitalize text-xs font-semibold text-text">{p.gender || "Unknown"}</p>
          <p className="text-[11px] text-text-muted">{calculateAge(p.dob)}</p>
        </div>
      ),
    },
    {
      header: "Contact Phone",
      render: (p) => (
        <span className="text-xs font-mono text-text-secondary">{p.userId?.phone || "—"}</span>
      ),
    },
    {
      header: "Allergies / Tags",
      render: (p) => (
        <div className="flex flex-wrap gap-1">
          {p.allergies && p.allergies.length > 0 ? (
            p.allergies.map((allergy, idx) => (
              <Badge key={idx} variant="danger" size="sm" className="text-[9px] font-bold px-1.5 py-0.2">
                {allergy}
              </Badge>
            ))
          ) : (
            <span className="text-[11px] text-text-muted">No known allergies</span>
          )}
        </div>
      ),
    },
    {
      header: "Actions",
      align: "right",
      render: (p) => {
        const pid = p.id || p._id;
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/dashboard/patients/${pid}`);
              }}
              className="font-semibold rounded-lg cursor-pointer shrink-0"
            >
              View Profile →
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
                { label: "View Full Profile", onClick: () => router.push(`/dashboard/patients/${pid}`) },
                { label: "Book Appointment", onClick: () => router.push(`/dashboard/appointments?patientId=${pid}`) },
                { label: "Inspect EHR Timeline", onClick: () => router.push(`/dashboard/patients/${pid}/timeline`) },
              ]}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5 w-full font-sans text-text antialiased animate-fade-in pb-8">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 sm:p-5 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight">
            Patient Directory & EHR Registry
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Search, manage, and inspect master electronic health records across the organization.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={() => router.push("/dashboard/appointments")}
            className="font-bold rounded-xl shadow-xs cursor-pointer"
            icon={
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            }
          >
            Register / Book Patient
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPatients}
            loading={loading}
            className="font-semibold rounded-xl cursor-pointer"
            icon={
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stat Cards (2-column on mobile) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Registered Patients"
          value={(totalCount || patients.length).toString()}
          icon={
            <svg className="h-4 sm:h-5 w-4 sm:w-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
        <StatCard
          label="Active Page Count"
          value={patients.length.toString()}
          icon={
            <svg className="h-4 sm:h-5 w-4 sm:w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <StatCard
          label="Male Demographic"
          value={maleCount.toString()}
          icon={
            <svg className="h-4 sm:h-5 w-4 sm:w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />
        <StatCard
          label="Female Demographic"
          value={femaleCount.toString()}
          icon={
            <svg className="h-4 sm:h-5 w-4 sm:w-5 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-3.5 sm:p-4 rounded-2xl border border-border bg-surface">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <div className="sm:col-span-2 flex gap-2">
            <Input
              placeholder="Search patient by name, email, or phone number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-xs"
            />
            <Button type="submit" variant="primary" size="sm" disabled={loading} className="font-bold rounded-xl cursor-pointer">
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

      {/* Main Table Card */}
      <Card className="rounded-2xl border border-border bg-surface overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">Registered Patient Profiles</CardTitle>
          <CardDescription className="text-xs text-text-muted">
            Click "EHR Timeline" to view full medical history, past encounters, and lab diagnostic reports.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="p-6">
              <SkeletonTable rows={6} cols={6} />
            </div>
          ) : (
            <Table
              columns={columns}
              data={patients}
              searchable={false}
              pagination={false}
              onRowClick={(p) => router.push(`/dashboard/patients/${p.id || p._id}`)}
              emptyMessage="No patient profiles found. Try adjusting search criteria or register a new patient."
            />
          )}
        </CardContent>
      </Card>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-text-muted">
            Page <span className="font-semibold text-text">{page}</span> of{" "}
            <span className="font-semibold text-text">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              className="rounded-xl text-xs cursor-pointer"
            >
              Previous Page
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((prev) => prev + 1)}
              className="rounded-xl text-xs cursor-pointer"
            >
              Next Page
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
