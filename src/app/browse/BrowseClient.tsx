"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import {
  Button,
  Select,
  Badge,
  Card,
  SkeletonCard,
  EmptyState,
} from "@/components/ui";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";

interface DoctorSummary {
  id: string;
  name: string;
  specialization: string;
  fees: number;
}

interface Clinic {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  description: string;
  image_url: string;
  timings: string;
  facilities?: string[];
  doctorCount?: number;
  minFee?: number | null;
  specialties?: string[];
  doctorsSummary?: DoctorSummary[];
}

const SPECIALTY_OPTIONS = [
  { value: "", label: "🩺 All Specialties" },
  { value: "General Medicine", label: "🩺 General Medicine" },
  { value: "Pediatrics", label: "👶 Pediatrics" },
  { value: "Cardiology", label: "❤️ Cardiology" },
  { value: "Dentistry", label: "🦷 Dentistry" },
  { value: "Orthopedics", label: "🦴 Orthopedics" },
  { value: "Dermatology", label: "✨ Dermatology" },
  { value: "ENT", label: "👂 ENT / Ear-Nose-Throat" },
];

const SORT_OPTIONS = [
  { value: "featured", label: "Sort: Featured" },
  { value: "fee_low", label: "Sort: Fee (Lowest First)" },
  { value: "name", label: "Sort: Name (A-Z)" },
  { value: "city", label: "Sort: By City" },
];

export default function BrowseClient() {
  const router = useRouter();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [sortBy, setSortBy] = useState("featured");
  const [allCities, setAllCities] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // 300ms Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const formatTimings = (timingsStr: string | null | undefined): string => {
    if (!timingsStr) return "Mon–Sat: 9:00 AM – 6:00 PM";
    try {
      const data = JSON.parse(timingsStr);
      const days = Object.keys(data);
      for (const day of days) {
        if (data[day] && data[day].length > 0) {
          const firstSlot = data[day][0];
          return `${firstSlot.start} – ${firstSlot.end}`;
        }
      }
      return "Mon–Sat: 9:00 AM – 6:00 PM";
    } catch {
      return timingsStr;
    }
  };

  const fetchClinics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (selectedCity) params.append("city", selectedCity);
      if (selectedSpecialty) params.append("specialization", selectedSpecialty);
      const res = await api.get(`/public/clinics${params.toString() ? `?${params}` : ""}`);
      const data: Clinic[] = res.data.data || [];

      // Retain cumulative master list of cities
      setAllCities((prev) => {
        const set = new Set([...prev, ...data.map((c) => c.city).filter(Boolean)]);
        return Array.from(set).sort();
      });

      const sorted = [...data].sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "city") return a.city.localeCompare(b.city);
        if (sortBy === "fee_low") {
          const feeA = a.minFee ?? 999999;
          const feeB = b.minFee ?? 999999;
          return feeA - feeB;
        }
        return 0;
      });
      setClinics(sorted);
    } catch (err) {
      console.error("Failed to fetch clinics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClinics();
  }, [debouncedSearch, selectedCity, selectedSpecialty, sortBy]);

  const handleBookingAction = (e: React.MouseEvent, clinic: Clinic) => {
    e.stopPropagation();
    if (clinic.doctorCount === 1 && clinic.doctorsSummary && clinic.doctorsSummary.length === 1) {
      const doc = clinic.doctorsSummary[0];
      router.push(`/browse/${clinic.id}?doctorId=${doc.id}&openBooking=true`);
    } else {
      router.push(`/browse/${clinic.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-surface-alt font-sans text-text antialiased selection:bg-primary-500/20 selection:text-primary-600 animate-page-enter">
      <MarketplaceNavbar />

      {/* Hero Header Section */}
      <section className="relative pt-20 pb-6 overflow-hidden bg-gradient-to-b from-surface via-surface/90 to-surface-alt border-b border-border/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10 text-center">
          <h1 className="text-2xl sm:text-4xl font-black text-text tracking-tight mb-2 leading-tight">
            Find Your Perfect <span className="text-primary-600">Medical Care</span>
          </h1>
          <p className="text-text-secondary text-xs sm:text-sm max-w-md mx-auto mb-5">
            Search top clinics, verified doctors, and medical specialties in your area.
          </p>

          {/* Unified Multi-Filter Search Bar */}
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-col md:flex-row items-center gap-2 bg-surface rounded-2xl md:rounded-full border border-border/80 shadow-md p-2 focus-within:ring-2 focus-within:ring-primary-500/30 focus-within:border-primary-500 transition-all">
              {/* Search Query Input */}
              <div className="flex items-center gap-2 px-3 py-1.5 w-full flex-1">
                <svg className="w-4 h-4 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search doctor, clinic name, or specialty..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-0 text-xs sm:text-sm text-text placeholder:text-text-muted focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-text-muted hover:text-text p-1 rounded-full cursor-pointer text-xs shrink-0"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Location Select Dropdown */}
              <div className="w-full md:w-auto shrink-0 border-t md:border-t-0 md:border-l border-border/60 pt-2 md:pt-0 md:pl-2">
                <Select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  options={[
                    { value: "", label: "📍 All Locations" },
                    ...allCities.map((c) => ({ value: c, label: `📍 ${c}` })),
                  ]}
                  size="sm"
                  className="text-xs border-0 bg-transparent shadow-none w-full"
                />
              </div>

              {/* Specialty Select Dropdown */}
              <div className="w-full md:w-auto shrink-0 border-t md:border-t-0 md:border-l border-border/60 pt-2 md:pt-0 md:pl-2">
                <Select
                  value={selectedSpecialty}
                  onChange={(e) => setSelectedSpecialty(e.target.value)}
                  options={SPECIALTY_OPTIONS}
                  size="sm"
                  className="text-xs border-0 bg-transparent shadow-none w-full"
                />
              </div>
            </div>

            {/* Active Filter Tags */}
            {(debouncedSearch || selectedCity || selectedSpecialty) && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-3 pt-1">
                <span className="text-[11px] font-semibold text-text-muted">Active:</span>
                {debouncedSearch && (
                  <Badge variant="neutral" className="flex items-center gap-1.5 py-0.5 px-2.5 text-xs bg-surface border border-border">
                    <span>Search: "{debouncedSearch}"</span>
                    <button
                      onClick={() => setSearchQuery("")}
                      className="hover:text-danger-500 font-bold ml-1 cursor-pointer"
                      title="Remove search filter"
                    >
                      ✕
                    </button>
                  </Badge>
                )}
                {selectedCity && (
                  <Badge variant="neutral" className="flex items-center gap-1.5 py-0.5 px-2.5 text-xs bg-surface border border-border">
                    <span>📍 {selectedCity}</span>
                    <button
                      onClick={() => setSelectedCity("")}
                      className="hover:text-danger-500 font-bold ml-1 cursor-pointer"
                      title="Remove city filter"
                    >
                      ✕
                    </button>
                  </Badge>
                )}
                {selectedSpecialty && (
                  <Badge variant="neutral" className="flex items-center gap-1.5 py-0.5 px-2.5 text-xs bg-surface border border-border">
                    <span>🩺 {selectedSpecialty}</span>
                    <button
                      onClick={() => setSelectedSpecialty("")}
                      className="hover:text-danger-500 font-bold ml-1 cursor-pointer"
                      title="Remove specialty filter"
                    >
                      ✕
                    </button>
                  </Badge>
                )}
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCity("");
                    setSelectedSpecialty("");
                  }}
                  className="text-[11px] font-bold text-primary-600 hover:underline cursor-pointer ml-1"
                >
                  Reset all
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Section */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        {/* Results Info & View Controls Bar */}
        <div className="flex items-center justify-between gap-3 mb-6 pb-3 border-b border-border/40">
          <span className="text-xs font-semibold text-text-secondary">
            {loading ? "Searching clinics..." : `${clinics.length} ${clinics.length === 1 ? "clinic" : "clinics"} found`}
          </span>

          <div className="flex items-center gap-3 shrink-0">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-surface rounded-lg p-0.5 border border-border">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md text-xs transition-colors ${
                  viewMode === "grid" ? "bg-surface-alt text-primary-600 font-bold shadow-xs" : "text-text-muted hover:text-text"
                }`}
                title="Grid View"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md text-xs transition-colors ${
                  viewMode === "list" ? "bg-surface-alt text-primary-600 font-bold shadow-xs" : "text-text-muted hover:text-text"
                }`}
                title="List View"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>

            {/* Sort Dropdown */}
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              options={SORT_OPTIONS}
              size="sm"
              className="text-xs rounded-full"
            />
          </div>
        </div>

        {/* Clinics Listing Grid / List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : clinics.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <EmptyState
              icon="🏥"
              title="No Clinics Found"
              description="No healthcare facilities or doctors match your current criteria."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCity("");
                    setSelectedSpecialty("");
                  }}
                  className="rounded-full"
                >
                  Clear all filters
                </Button>
              }
            />
          </Card>
        ) : viewMode === "grid" ? (
          /* Modern Online Healthcare Clinic Card Grid Layout */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clinics.map((clinic) => {
              const hasSingleDoctor = clinic.doctorCount === 1 && clinic.doctorsSummary && clinic.doctorsSummary.length === 1;
              const singleDoctor = hasSingleDoctor ? clinic.doctorsSummary![0] : null;

              return (
                <Card
                  key={clinic.id}
                  onClick={() => router.push(`/browse/${clinic.id}`)}
                  className="group cursor-pointer hover:shadow-xl hover:border-primary-500/40 hover:-translate-y-1 transition-all duration-300 p-5 rounded-2xl border border-border bg-surface flex flex-col justify-between"
                >
                  <div>
                    {/* Card Header: Avatar & Badges */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-600/15 via-primary-500/10 to-blue-600/15 border border-primary-500/20 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform duration-300">
                          {clinic.image_url ? (
                            <img src={clinic.image_url} alt={clinic.name} className="w-full h-full object-cover rounded-2xl" />
                          ) : (
                            <span className="text-xl">🏥</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-base font-bold text-text group-hover:text-primary-600 transition-colors line-clamp-1">
                              {clinic.name}
                            </h3>
                            <span className="text-primary-600 text-xs shrink-0" title="Verified Facility">
                              ✓
                            </span>
                          </div>
                          <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                            <span>📍 {clinic.city}</span>
                            <span>•</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Open Today</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Doctor Count & Fee Highlights Pill Row */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="text-[11px] font-bold bg-primary-500/10 text-primary-700 dark:text-primary-400 px-2.5 py-1 rounded-lg border border-primary-500/20 flex items-center gap-1">
                        👨‍⚕️ {clinic.doctorCount ? `${clinic.doctorCount} ${clinic.doctorCount === 1 ? "Doctor" : "Doctors"}` : "Specialists Available"}
                      </span>

                      {clinic.minFee !== undefined && clinic.minFee !== null && (
                        <span className="text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                          Fee: ₹{clinic.minFee}
                        </span>
                      )}
                    </div>

                    {/* Single Doctor Highlight or Clinic Description */}
                    {hasSingleDoctor && singleDoctor ? (
                      <div className="bg-surface-alt p-2.5 rounded-xl border border-border/60 text-xs mb-3 space-y-0.5">
                        <span className="text-[10px] uppercase font-bold text-text-muted block tracking-wider">Practicing Specialist</span>
                        <p className="font-bold text-text truncate">Dr. {singleDoctor.name}</p>
                        <p className="text-[11px] text-primary-600 font-medium truncate">{singleDoctor.specialization}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-text-muted line-clamp-2 leading-relaxed mb-3">
                        {clinic.description || "Verified healthcare facility providing general medicine and specialized practitioner consultations."}
                      </p>
                    )}

                    {/* Facilities / Specialty Tags */}
                    {clinic.facilities && clinic.facilities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {clinic.facilities.slice(0, 3).map((fac, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-bold uppercase tracking-wider bg-surface-alt text-text-secondary px-2 py-0.5 rounded-md border border-border"
                          >
                            {fac}
                          </span>
                        ))}
                        {clinic.facilities.length > 3 && (
                          <span className="text-[10px] text-text-muted self-center font-medium">
                            +{clinic.facilities.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    {/* Address & Timings Footer */}
                    <div className="space-y-1.5 text-xs text-text-secondary border-t border-border/50 pt-3 mb-4">
                      {clinic.address && clinic.address.trim() !== "." && (
                        <div className="flex items-center gap-2 truncate">
                          <svg className="w-3.5 h-3.5 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="truncate">{clinic.address}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-text-muted">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{formatTimings(clinic.timings)}</span>
                      </div>
                    </div>

                    {/* Actions Bar */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full font-bold rounded-xl shadow-xs"
                        onClick={(e) => handleBookingAction(e, clinic)}
                      >
                        {hasSingleDoctor && singleDoctor
                          ? `Book with Dr. ${singleDoctor.name.replace(/^Dr\.?\s*/i, "")}`
                          : `View Doctors & Book ${clinic.doctorCount ? `(${clinic.doctorCount})` : ""}`}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="space-y-4 max-w-4xl mx-auto">
            {clinics.map((clinic) => {
              const hasSingleDoctor = clinic.doctorCount === 1 && clinic.doctorsSummary && clinic.doctorsSummary.length === 1;
              const singleDoctor = hasSingleDoctor ? clinic.doctorsSummary![0] : null;

              return (
                <Card
                  key={clinic.id}
                  onClick={() => router.push(`/browse/${clinic.id}`)}
                  className="group cursor-pointer hover:shadow-lg hover:border-primary-500/40 transition-all duration-200 p-5 rounded-2xl border border-border bg-surface flex flex-col sm:flex-row gap-4 items-center justify-between"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-600/15 via-primary-500/10 to-blue-600/15 border border-primary-500/20 flex items-center justify-center shrink-0 shadow-2xs">
                      {clinic.image_url ? (
                        <img src={clinic.image_url} alt={clinic.name} className="w-full h-full object-cover rounded-2xl" />
                      ) : (
                        <span className="text-2xl">🏥</span>
                      )}
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-text group-hover:text-primary-600 transition-colors truncate">
                          {clinic.name}
                        </h3>
                        <span className="text-primary-600 text-xs shrink-0">✓</span>
                      </div>

                      <p className="text-xs text-text-muted line-clamp-1">
                        {hasSingleDoctor && singleDoctor
                          ? `Dr. ${singleDoctor.name} • ${singleDoctor.specialization}`
                          : clinic.description || "Verified Healthcare facility providing specialized patient care."}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary pt-0.5">
                        <span>📍 {clinic.city}</span>
                        <span>•</span>
                        <span className="text-primary-600 font-semibold">
                          👨‍⚕️ {clinic.doctorCount ? `${clinic.doctorCount} Doctors` : "Doctors Available"}
                        </span>
                        {clinic.minFee !== undefined && clinic.minFee !== null && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-600 font-bold">From ₹{clinic.minFee}</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="text-text-muted">🕒 {formatTimings(clinic.timings)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 w-full sm:w-auto">
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full sm:w-auto rounded-xl font-bold px-5"
                      onClick={(e) => handleBookingAction(e, clinic)}
                    >
                      {hasSingleDoctor && singleDoctor
                        ? `Book with Dr. ${singleDoctor.name.replace(/^Dr\.?\s*/i, "")}`
                        : "View Doctors & Book"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
