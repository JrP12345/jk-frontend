"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import {
  Button,
  Input,
  Select,
  Badge,
  Card,
  EmptyState,
} from "@/components/ui";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import {
  Search,
  MapPin,
  Clock,
  X,
  ChevronRight,
  ShieldCheck,
  Building2,
  Users,
  CreditCard,
  Camera,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { ClinicStatusBadge } from "@/components/ui/ClinicStatusBadge";
import {
  detectUserLocation,
  mapStateToLanguage,
  findMatchingClinicCity,
  DetectedLocation,
} from "@/lib/geo/locationDetector";

interface DoctorSummary {
  id: string;
  name: string;
  specialization: string;
  fees: number;
}

export interface Clinic {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  description: string;
  image_url: string;
  logo_url?: string;
  images?: string[];
  organizationName?: string;
  currency?: string;
  timings: string;
  facilities?: string[];
  doctorCount?: number;
  minFee?: number | null;
  specialties?: string[];
  doctorsSummary?: DoctorSummary[];
}

const QUICK_SPECIALTIES = [
  { value: "", key: "browse.all_care", fallback: "All Care" },
  { value: "General Medicine", key: "specialty.general_medicine", fallback: "General Medicine" },
  { value: "Pediatrics", key: "specialty.pediatrics", fallback: "Pediatrics" },
  { value: "Cardiology", key: "specialty.cardiology", fallback: "Cardiology" },
  { value: "Dentistry", key: "specialty.dentistry", fallback: "Dentistry" },
  { value: "Orthopedics", key: "specialty.orthopedics", fallback: "Orthopedics" },
  { value: "Dermatology", key: "specialty.dermatology", fallback: "Dermatology" },
  { value: "ENT", key: "specialty.ent", fallback: "ENT" },
];

const SORT_OPTIONS = [
  { value: "featured", key: "sort.featured", fallback: "Sort: Featured" },
  { value: "fee_low", key: "sort.fee_low", fallback: "Fee (Low to High)" },
  { value: "name", key: "sort.name", fallback: "Name (A–Z)" },
  { value: "city", key: "sort.city", fallback: "City" },
];

function format12HourTime(timeStr: string): string {
  if (!timeStr) return "";
  const clean = timeStr.trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return timeStr;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function formatTimings(timingsStr: string | null | undefined): string {
  if (!timingsStr) return "Mon–Sat: 9:00 AM – 6:00 PM";
  try {
    const trimmed = timingsStr.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      const parts = trimmed.split(/[-–—to]/i).map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        return `${format12HourTime(parts[0])} – ${format12HourTime(parts[1])}`;
      }
      return trimmed;
    }
    const data = JSON.parse(trimmed);
    const days = Object.keys(data);
    for (const day of days) {
      if (data[day] && data[day].length > 0) {
        const firstSlot = data[day][0];
        return `${format12HourTime(firstSlot.start)} – ${format12HourTime(firstSlot.end)}`;
      }
    }
    return "Mon–Sat: 9:00 AM – 6:00 PM";
  } catch {
    return timingsStr || "Mon–Sat: 9:00 AM – 6:00 PM";
  }
}

export default function BrowseClient({
  initialClinics = [],
  initialLoaded = false,
}: {
  initialClinics?: Clinic[];
  initialLoaded?: boolean;
} = {}) {
  const router = useRouter();
  const { t, setLanguage } = useTranslation();
  const [clinics, setClinics] = useState<Clinic[]>(initialClinics);
  const [loading, setLoading] = useState(!initialLoaded && initialClinics.length === 0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [sortBy, setSortBy] = useState("featured");
  const [detectedLocation, setDetectedLocation] = useState<DetectedLocation | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [allCities, setAllCities] = useState<string[]>(() => {
    if (initialClinics.length > 0) {
      return Array.from(new Set(initialClinics.map((c) => c.city).filter(Boolean))).sort();
    }
    return [];
  });

  // Auto location & language detection on initial load
  useEffect(() => {
    let isMounted = true;
    const initLocation = async () => {
      try {
        setIsDetectingLocation(true);
        const loc = await detectUserLocation();
        if (!isMounted) return;

        if (loc && (loc.city || loc.state)) {
          setDetectedLocation(loc);

          // Auto switch language based on detected state/city (unless user chose manually)
          try {
            const hasManualLang = localStorage.getItem("ananta_lang_manual");
            if (!hasManualLang) {
              const lang = mapStateToLanguage(loc.state, loc.city);
              setLanguage(lang);
            }
          } catch {}
        }
      } catch (err) {
        console.error("Auto location error:", err);
      } finally {
        if (isMounted) setIsDetectingLocation(false);
      }
    };

    initLocation();
    return () => {
      isMounted = false;
    };
  }, [setLanguage]);

  // Auto-select city if user hasn't explicitly chosen one and a matching clinic city exists
  useEffect(() => {
    if (!detectedLocation?.city || allCities.length === 0) return;
    try {
      const userChoice = sessionStorage.getItem("ananta_user_city_choice");
      if (userChoice) return;

      const matched = findMatchingClinicCity(detectedLocation.city, allCities);
      if (matched && !selectedCity) {
        setSelectedCity(matched);
      }
    } catch {}
  }, [detectedLocation, allCities, selectedCity]);

  // 300ms Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (initialLoaded || initialClinics.length > 0) return;
    }
    const controller = new AbortController();
    const fetchClinics = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (selectedCity) params.append("city", selectedCity);
      if (selectedSpecialty) params.append("specialization", selectedSpecialty);
      const res = await api.get(`/public/clinics${params.toString() ? `?${params}` : ""}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const data: Clinic[] = res.data.data || [];

      // Retain cumulative master list of cities
      setAllCities((prev) => {
        const set = new Set([...prev, ...data.map((c) => c.city).filter(Boolean)]);
        return Array.from(set).sort();
      });

      setClinics(data);
    } catch (err) {
      if (!controller.signal.aborted) setFetchError("We couldn't load clinics. Please try again.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
    };
    void fetchClinics();
    return () => controller.abort();
  }, [debouncedSearch, selectedCity, selectedSpecialty, retryKey]);

  const sortedClinics = useMemo(() => [...clinics].sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "city") return a.city.localeCompare(b.city);
        if (sortBy === "fee_low") {
          const feeA = a.minFee ?? 999999;
          const feeB = b.minFee ?? 999999;
          return feeA - feeB;
        }
        return 0;
      }), [clinics, sortBy]);

  const handleBookingAction = (e: React.MouseEvent, clinic: Clinic) => {
    e.stopPropagation();
    if (clinic.doctorCount === 1 && clinic.doctorsSummary && clinic.doctorsSummary.length === 1) {
      const doc = clinic.doctorsSummary[0];
      router.push(`/browse/${clinic.id}?doctorId=${doc.id}&openBooking=true`);
    } else {
      router.push(`/browse/${clinic.id}`);
    }
  };

  const handleCitySelect = (city: string) => {
    try {
      sessionStorage.setItem("ananta_user_city_choice", "true");
    } catch {}
    setSelectedCity(city);
  };

  const handleShowAllCities = () => {
    try {
      sessionStorage.setItem("ananta_user_city_choice", "true");
    } catch {}
    setSelectedCity("");
  };

  const resetAllFilters = () => {
    try {
      sessionStorage.setItem("ananta_user_city_choice", "true");
    } catch {}
    setSearchQuery("");
    setSelectedCity("");
    setSelectedSpecialty("");
  };

  const hasActiveFilters = Boolean(debouncedSearch || selectedCity || selectedSpecialty);

  const localizedSortOptions = SORT_OPTIONS.map((opt) => ({
    value: opt.value,
    label: t(opt.key, opt.fallback),
  }));

  return (
    <div className="min-h-screen bg-surface-alt font-sans text-text antialiased selection:bg-primary-500/20 selection:text-primary-600">
      <MarketplaceNavbar />

      {/* Hero Header Section - Clean Modern Healthcare Design */}
      <section className="relative pt-20 sm:pt-24 pb-4 sm:pb-8 overflow-hidden bg-gradient-to-b from-surface via-surface/95 to-surface-alt border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10 text-center">
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-text tracking-tight mb-1.5 sm:mb-2 leading-tight" suppressHydrationWarning>
            {t("browse.hero_title_1", "Find and book")}{" "}
            <span className="text-primary-600" suppressHydrationWarning>{t("browse.hero_title_highlight", "verified medical care")}</span>
          </h1>
          <p className="text-text-secondary text-xs sm:text-sm max-w-lg mx-auto mb-4 sm:mb-6 leading-relaxed hidden xs:block" suppressHydrationWarning>
            {t(
              "browse.hero_subtitle",
              "Search verified clinics, view consulting doctors, and schedule your appointment with transparent fees."
            )}
          </p>

          {/* Unified Streamlined Search Console: Search + City Selector */}
          <div className="max-w-3xl mx-auto">
            <div className="bg-surface rounded-2xl md:rounded-full border border-border shadow-xs p-1.5 focus-within:ring-2 focus-within:ring-primary-500/30 focus-within:border-primary-500 transition-all flex flex-col md:flex-row items-stretch md:items-center gap-1.5 sm:gap-2">
              {/* Keyword Search Input with Inside Icon */}
              <div className="flex-1 min-w-0">
                <Input
                  variant="flush"
                  size="sm"
                  icon={<Search className="w-4 h-4 text-text-muted" strokeWidth={1.75} />}
                  placeholder={t("browse.search_placeholder", "Search doctor, clinic name, or specialty...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClear={() => setSearchQuery("")}
                  className="text-sm font-normal py-2"
                  containerClassName="w-full"
                  aria-label="Search by doctor, clinic name, or specialty"
                />
              </div>

              {/* Location Select Dropdown with Inside Icon */}
              <div className="w-full md:w-56 shrink-0 border-t md:border-t-0 md:border-l border-border/70 pt-1.5 md:pt-0 md:pl-2">
                <Select
                  icon={<MapPin className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.75} />}
                  value={selectedCity}
                  onChange={(e) => handleCitySelect(e.target.value)}
                  options={[
                    { value: "", label: t("browse.all_cities", "All Cities") },
                    ...allCities.map((c) => ({ value: c, label: c })),
                  ]}
                  size="sm"
                  variant="flush"
                  className="text-xs w-full min-h-[38px] sm:min-h-0"
                  aria-label="Filter by location"
                />
              </div>
            </div>

            {/* Specialty 1-Tap Quick Filter Pills Carousel */}
            <div className="mt-3 sm:mt-4 pt-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-snap-x py-1 -mx-4 px-4 sm:mx-0 sm:px-0">
              <span className="text-[11px] font-semibold text-text-muted shrink-0 mr-1 hidden sm:inline-block">
                {t("browse.care_label", "Care:")}
              </span>
              {QUICK_SPECIALTIES.map((qs) => {
                const isActive = selectedSpecialty === qs.value;
                return (
                  <button
                    key={qs.value}
                    type="button"
                    onClick={() => setSelectedSpecialty(isActive && qs.value !== "" ? "" : qs.value)}
                    aria-pressed={isActive}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer min-h-[36px] flex items-center justify-center ${
                      isActive
                        ? "bg-primary-500/15 text-primary-600 dark:text-primary-400 font-bold ring-1 ring-primary-500/40"
                        : "bg-surface hover:bg-surface-hover text-text-secondary hover:text-text border border-border"
                    }`}
                  >
                    <span>{t(qs.key, qs.fallback)}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Filter Badges */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mt-2.5 sm:mt-3 pt-1">
                <span className="text-[11px] font-semibold text-text-muted">
                  {t("browse.active_filters", "Active:")}
                </span>
                {debouncedSearch && (
                  <Badge variant="neutral" className="flex items-center gap-1.5 py-0.5 px-2.5 text-xs bg-surface border border-border">
                    <span className="truncate max-w-[140px]">"{debouncedSearch}"</span>
                    <button
                      onClick={() => setSearchQuery("")}
                      className="hover:text-danger-500 ml-1 cursor-pointer p-0.5 rounded-full"
                      aria-label="Remove search filter"
                    >
                      <X className="w-3 h-3" strokeWidth={1.75} />
                    </button>
                  </Badge>
                )}
                {selectedCity && (
                  <Badge variant="neutral" className="flex items-center gap-1.5 py-0.5 px-2.5 text-xs bg-surface border border-border">
                    <span>{selectedCity}</span>
                    <button
                      onClick={() => handleCitySelect("")}
                      className="hover:text-danger-500 ml-1 cursor-pointer p-0.5 rounded-full"
                      aria-label="Remove city filter"
                    >
                      <X className="w-3 h-3" strokeWidth={1.75} />
                    </button>
                  </Badge>
                )}
                {selectedSpecialty && (
                  <Badge variant="neutral" className="flex items-center gap-1.5 py-0.5 px-2.5 text-xs bg-surface border border-border">
                    <span>
                      {(() => {
                        const item = QUICK_SPECIALTIES.find((qs) => qs.value === selectedSpecialty);
                        return item ? t(item.key, item.fallback) : selectedSpecialty;
                      })()}
                    </span>
                    <button
                      onClick={() => setSelectedSpecialty("")}
                      className="hover:text-danger-500 ml-1 cursor-pointer p-0.5 rounded-full"
                      aria-label="Remove specialty filter"
                    >
                      <X className="w-3 h-3" strokeWidth={1.75} />
                    </button>
                  </Badge>
                )}
                <button
                  onClick={resetAllFilters}
                  className="text-[11px] font-bold text-primary-600 hover:text-primary-700 underline cursor-pointer ml-1 py-1"
                >
                  {t("browse.reset_all", "Reset all")}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Listing Section */}
      <main aria-busy={loading} className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-20">
        {fetchError && <Card className="p-4 mb-4 flex flex-wrap items-center justify-between gap-3"><p>{fetchError}</p><Button size="sm" onClick={() => setRetryKey((key) => key + 1)}>Try again</Button></Card>}
        {/* Minimalist Compact Results & Sort Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-text-secondary">
              {loading ? (
                t("browse.finding_clinics", "Finding clinics...")
              ) : (
                <span>
                  <strong className="text-text font-bold">{clinics.length}</strong>{" "}
                  {clinics.length === 1
                    ? t("browse.clinic_single", "clinic available")
                    : t("browse.clinics_multiple", "clinics available")}
                  {hasActiveFilters && (
                    <span className="text-text-muted font-normal ml-1">
                      {t("browse.filtered", "(filtered)")}
                    </span>
                  )}
                </span>
              )}
            </p>

            {/* Location Indicator Pill */}
            {detectedLocation && (detectedLocation.city || detectedLocation.state) && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-500/10 text-primary-700 dark:text-primary-400 border border-primary-500/20 text-[11px] font-medium">
                <MapPin className="w-3 h-3 text-primary-600 shrink-0" />
                <span>
                  {t("browse.near_location", "Near")}{" "}
                  <strong className="font-bold">
                    {[detectedLocation.city, detectedLocation.state].filter(Boolean).join(", ")}
                  </strong>
                </span>
                {selectedCity ? (
                  <button
                    type="button"
                    onClick={handleShowAllCities}
                    className="ml-1 text-[11px] font-bold text-primary-600 hover:text-primary-800 underline cursor-pointer"
                  >
                    {t("browse.view_all_cities", "Show all cities")}
                  </button>
                ) : null}
              </span>
            )}
          </div>

          <div className="w-40 xs:w-48 shrink-0">
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              options={localizedSortOptions}
              size="sm"
              className="text-xs rounded-xl"
              aria-label="Sort clinics by"
            />
          </div>
        </div>

        {/* Clinics Listing Cards */}
        {loading && clinics.length === 0 ? (
          /* Geometry-matched Skeletons */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-4 sm:p-5 rounded-2xl border border-border bg-surface flex flex-col justify-between h-[360px] animate-pulse">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-surface-alt shrink-0" />
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="h-4 bg-surface-alt rounded-md w-3/4" />
                      <div className="h-3 bg-surface-alt rounded-md w-1/2" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-6 bg-surface-alt rounded-lg w-24" />
                    <div className="h-6 bg-surface-alt rounded-lg w-20" />
                  </div>
                  <div className="h-14 bg-surface-alt rounded-xl w-full" />
                </div>
                <div className="pt-3 border-t border-border/40 space-y-2">
                  <div className="h-3 bg-surface-alt rounded-md w-2/3" />
                  <div className="h-10 bg-surface-alt rounded-xl w-full" />
                </div>
              </Card>
            ))}
          </div>
        ) : clinics.length === 0 ? (
          <Card className="p-8 sm:p-12 text-center border-dashed rounded-3xl bg-surface">
            <EmptyState
              title={t("browse.empty_title", "No Healthcare Facilities Found")}
              description={t(
                "browse.empty_desc",
                "No clinics match your current search criteria. Try choosing another city or clearing your filters."
              )}
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={resetAllFilters}
                  className="rounded-xl font-bold px-5 min-h-[44px] flex items-center justify-center"
                >
                  {t("browse.reset_all_filters", "Reset all filters")}
                </Button>
              }
            />
          </Card>
        ) : (
          /* Modern Healthcare Clinic Card Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {sortedClinics.map((clinic) => {
              const hasSingleDoctor = clinic.doctorCount === 1 && clinic.doctorsSummary && clinic.doctorsSummary.length === 1;
              const singleDoctor = hasSingleDoctor ? clinic.doctorsSummary![0] : null;

              return (
                <Card
                  key={clinic.id}
                  onClick={() => router.push(`/browse/${clinic.id}`)}
                  className="group cursor-pointer hover:shadow-lg hover:border-primary-500/40 hover:-translate-y-0.5 transition-all duration-200 p-4 sm:p-5 rounded-2xl border border-border bg-surface flex flex-col justify-between"
                >
                  <div>
                    {/* Card Header: Avatar, Name & Verified Badge */}
                    <div className="flex items-start justify-between gap-2.5 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-surface-alt border border-border flex items-center justify-center shrink-0 shadow-2xs group-hover:border-primary-500/30 transition-colors overflow-hidden">
                          {clinic.logo_url || clinic.image_url ? (
                            <img src={clinic.logo_url || clinic.image_url} alt={clinic.name} className="w-full h-full object-cover rounded-xl" />
                          ) : (
                            <Building2 className="w-5 h-5 text-text-muted group-hover:text-primary-600 transition-colors" strokeWidth={1.75} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3
                              className="text-sm sm:text-base font-bold text-text group-hover:text-primary-600 transition-colors truncate"
                              title={clinic.name}
                            >
                              <Link href={`/browse/${clinic.id}`} onClick={(event) => event.stopPropagation()} className="focus-visible:outline-none focus-visible:underline">{clinic.name}</Link>
                            </h3>
                          </div>
                          {clinic.organizationName && clinic.organizationName !== clinic.name && (
                            <p className="text-[10px] text-text-muted font-medium truncate">
                              {t("browse.part_of", "Part of")} {clinic.organizationName}
                            </p>
                          )}
                          <p className="text-xs text-text-muted flex items-center gap-1.5 mt-0.5 truncate">
                            <span className="truncate">{clinic.city}</span>
                            <span>•</span>
                            <ClinicStatusBadge timings={clinic.timings} compact />
                          </p>
                        </div>
                      </div>

                      {/* Verified & Photo Gallery Badges */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-text-secondary bg-surface-alt border border-border px-2 py-0.5 rounded-md"
                          title="Verified Healthcare Facility"
                        >
                          <ShieldCheck className="w-3 h-3 text-primary-600" strokeWidth={1.75} />
                          <span className="hidden xs:inline">{t("browse.verified", "Verified")}</span>
                        </span>
                        {clinic.images && clinic.images.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-text-muted bg-surface-alt/70 border border-border/60 px-1.5 py-0.5 rounded">
                            <Camera className="w-2.5 h-2.5 text-primary-500" />
                            <span>{clinic.images.length} {t("browse.photos", "photos")}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Doctor Count & Fee Highlights Pill Row */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-3">
                      <span className="text-[11px] font-semibold bg-surface-alt text-text px-2.5 py-1 rounded-lg border border-border flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-text-muted shrink-0" strokeWidth={1.75} />
                        <span>
                          {clinic.doctorCount
                            ? `${clinic.doctorCount} ${
                                clinic.doctorCount === 1
                                  ? t("browse.doctor_single", "Doctor")
                                  : t("browse.doctors_multiple", "Doctors")
                              }`
                            : t("browse.doctors_available", "Doctors Available")}
                        </span>
                      </span>

                      {clinic.minFee !== undefined && clinic.minFee !== null && (
                        <span className="text-[11px] font-semibold bg-surface-alt text-text px-2.5 py-1 rounded-lg border border-border flex items-center gap-1">
                          <CreditCard className="w-3.5 h-3.5 text-text-muted shrink-0" strokeWidth={1.75} />
                          <span>
                            {t("browse.from_fee", "From")} {formatCurrency(clinic.minFee, clinic.currency || "INR")}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Single Doctor Highlight or Multi-Doctor Preview */}
                    {hasSingleDoctor && singleDoctor ? (
                      <div className="bg-surface-alt p-2.5 sm:p-3 rounded-xl border border-border text-xs mb-3 space-y-0.5 sm:space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">
                            {t("browse.practicing_specialist", "Practicing Specialist")}
                          </span>
                          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(singleDoctor.fees, clinic.currency || "INR")}
                          </span>
                        </div>
                        <p className="font-bold text-text truncate">Dr. {singleDoctor.name.replace(/^Dr\.?\s*/i, "")}</p>
                        <p className="text-[11px] text-text-secondary truncate">{singleDoctor.specialization}</p>
                      </div>
                    ) : clinic.doctorsSummary && clinic.doctorsSummary.length > 1 ? (
                      <div className="bg-surface-alt p-2.5 sm:p-3 rounded-xl border border-border text-xs mb-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">
                            {clinic.doctorsSummary.length} {t("browse.consulting_doctors", "Consulting Doctors")}
                          </span>
                          {clinic.minFee !== undefined && clinic.minFee !== null && (
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                              {t("browse.from_fee", "From")} {formatCurrency(clinic.minFee, clinic.currency || "INR")}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          {clinic.doctorsSummary.slice(0, 2).map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between gap-1 text-[11px]">
                              <span className="font-semibold text-text truncate">
                                Dr. {doc.name.replace(/^Dr\.?\s*/i, "")}
                              </span>
                              <span className="text-text-muted text-[10px] shrink-0 font-medium">
                                {doc.specialization}
                              </span>
                            </div>
                          ))}
                          {clinic.doctorsSummary.length > 2 && (
                            <p className="text-[10px] text-primary-600 font-semibold pt-0.5">
                              +{clinic.doctorsSummary.length - 2} {t("browse.more_doctors", "more doctors available")}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-text-muted line-clamp-2 leading-relaxed mb-3">
                        {clinic.description ||
                          t(
                            "browse.default_desc",
                            "Verified healthcare facility providing doctor consultations and specialized healthcare services."
                          )}
                      </p>
                    )}

                    {/* Facilities / Specialty Tags */}
                    {clinic.facilities && clinic.facilities.length > 0 && (
                      <div className="hidden xs:flex flex-wrap gap-1.5 mb-3">
                        {clinic.facilities.slice(0, 3).map((fac, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-medium bg-surface text-text-muted px-2 py-0.5 rounded-md border border-border"
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
                    {/* Address & Timings Footer in 12-Hour AM/PM format */}
                    <div className="space-y-1 text-xs text-text-secondary border-t border-border/60 pt-2.5 mb-3">
                      {clinic.address && clinic.address.trim() !== "." && (
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0" strokeWidth={1.75} />
                          <span className="truncate">{clinic.address}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-text-muted">
                        <Clock className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                        <span className="truncate">{formatTimings(clinic.timings)}</span>
                      </div>
                    </div>

                    {/* Actions Bar */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full font-bold rounded-xl shadow-xs min-h-[44px] flex items-center justify-center gap-1.5 group/btn cursor-pointer"
                        onClick={(e) => handleBookingAction(e, clinic)}
                      >
                        <span>
                          {hasSingleDoctor && singleDoctor
                            ? `${t("browse.book_with", "Book with")} Dr. ${singleDoctor.name.replace(/^Dr\.?\s*/i, "")}`
                            : `${t("browse.view_doctors_book", "View Doctors & Book")} ${
                                clinic.doctorCount ? `(${clinic.doctorCount})` : ""
                              }`}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" strokeWidth={2} />
                      </Button>
                    </div>
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
