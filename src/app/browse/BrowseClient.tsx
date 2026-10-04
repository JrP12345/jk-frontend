"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Alert, Button, Input, Select, Card, EmptyState } from "@/components/ui";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import ClinicCardSkeletons from "@/components/ui/ClinicCardSkeletons";
import { Search, MapPin, ChevronRight, Building2, Users, CreditCard, Camera, Star, Stethoscope, ArrowUpDown } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { ClinicStatusBadge } from "@/components/ui/ClinicStatusBadge";
import { getPublicBookingStatus, type PublicBookingStatus } from "@/lib/publicBooking";
import { parseWeeklySchedule } from "@/lib/timing/clinicStatus";
import { detectUserLocation, findMatchingClinicCity, DetectedLocation } from "@/lib/geo/locationDetector";

interface DoctorSummary {
  id: string;
  name: string;
  specialization: string;
  fees?: number;
  feeType?: "fixed" | "free" | "post_consultation";
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
  rating?: number | null;
  reviewsCount?: number;
  specialties?: string[];
  doctorsSummary?: DoctorSummary[];
  onlineBookingAvailable?: boolean;
  bookingStatus?: PublicBookingStatus;
}

export interface ClinicFilters {
  cities: string[];
  specialties: string[];
}

function directoryDoctorFeeLabel(doctor: DoctorSummary, currency: string): string {
  if (doctor.feeType === "free") return "Free";
  if (doctor.feeType === "post_consultation") return doctor.fees && doctor.fees > 0 ? `From ${formatCurrency(doctor.fees, currency)}` : "Fee decided after consultation";
  return doctor.fees && doctor.fees > 0 ? formatCurrency(doctor.fees, currency) : "Fee not listed";
}

function directoryMinimumFeeLabel(fee: number, currency: string): string {
  return fee === 0 ? "Free consultation available" : `From ${formatCurrency(fee, currency)}`;
}

function ClinicImage({ src, name }: { src: string | undefined; name: string }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  return src && failedSrc !== src ? (
    <div className="relative w-full h-full">
      <Building2 aria-hidden="true" className="absolute inset-0 m-auto w-5 h-5 text-text-muted" strokeWidth={1.75} />
      <img src={src} alt={name} width={48} height={48} loading="lazy" decoding="async" onError={() => setFailedSrc(src)} className="relative w-full h-full object-cover rounded-xl" />
    </div>
  ) : <Building2 aria-label="Clinic image unavailable" className="w-5 h-5 text-text-muted" strokeWidth={1.75} />;
}

function filtersFromClinics(clinics: Clinic[]): ClinicFilters {
  return {
    cities: Array.from(new Set(clinics.map(c => c.city).filter(Boolean))).sort(),
    specialties: Array.from(new Set(clinics.flatMap(c => c.specialties?.length ? c.specialties : c.doctorsSummary?.map(d => d.specialization) || []).map(s => s.trim()).filter(s => s && s !== "Specialty not listed"))).sort(),
  };
}

/** Keep incomplete directory records readable without inventing availability. */
export function normalizeClinics(input: unknown): Clinic[] {
  if (!Array.isArray(input)) return [];
  const string = (value: unknown) => typeof value === "string" ? value.trim() : "";
  const strings = (value: unknown) => Array.isArray(value) ? value.map(string).filter(Boolean) : [];
  const number = (value: unknown) => (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : undefined;
  const seen = new Set<string>();
  return input.flatMap(raw => {
    if (!raw || typeof raw !== "object") return [];
    const id = string(raw.id || raw._id);
    if (!id || seen.has(id)) return [];
    seen.add(id);
    return [{ ...raw, id, name: string(raw.name) || "Healthcare facility", city: string(raw.city), address: string(raw.address), phone: string(raw.phone), email: string(raw.email), description: string(raw.description), image_url: string(raw.image_url), logo_url: string(raw.logo_url), organizationName: string(raw.organizationName), currency: /^[A-Z]{3}$/.test(string(raw.currency).toUpperCase()) ? string(raw.currency).toUpperCase() : "INR", timings: typeof raw.timings === "object" && raw.timings ? JSON.stringify(raw.timings) : string(raw.timings), images: strings(raw.images), facilities: strings(raw.facilities), specialties: strings(raw.specialties), doctorCount: number(raw.doctorCount), minFee: number(raw.minFee), rating: number(raw.rating), reviewsCount: number(raw.reviewsCount), onlineBookingAvailable: typeof raw.onlineBookingAvailable === "boolean" ? raw.onlineBookingAvailable : undefined, bookingStatus: getPublicBookingStatus({ bookingStatus: raw.bookingStatus, onlineBookingAvailable: raw.onlineBookingAvailable, doctorCount: number(raw.doctorCount) }), doctorsSummary: Array.isArray(raw.doctorsSummary) ? raw.doctorsSummary.filter((doc: DoctorSummary) => doc && string(doc.id) && string(doc.name)).map((doc: DoctorSummary) => ({ ...doc, name: string(doc.name), specialization: string(doc.specialization) || "Specialty not listed", fees: number(doc.fees), feeType: doc.feeType })) : [] }];
  });
}

function normalizeFilters(filters: ClinicFilters | undefined, clinics: Clinic[]): ClinicFilters {
  const fallback = filtersFromClinics(clinics);
  const values = (input: unknown, defaults: string[]) => Array.isArray(input) ? Array.from(new Set(input.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map(value => value.trim()))).sort() : defaults;
  return { cities: values(filters?.cities, fallback.cities), specialties: values(filters?.specialties, fallback.specialties) };
}

const SORT_OPTIONS = [
  { value: "rating", label: "Top rated" },
  { value: "fee_low", label: "Lowest fee" },
];
const DISCOVERY_KEY = "ekavyu_browse_discovery";
type DiscoveryState = { search: string; city: string; specialty: string; sort: string; scrollY: number };

export default function BrowseClient({
  initialClinics = [],
  initialLoaded = false,
  initialFilters,
  initialNextCursor = null,
  loadingOnly = false,
}: {
  initialClinics?: Clinic[];
  initialLoaded?: boolean;
  initialFilters?: ClinicFilters;
  initialNextCursor?: string | null;
  loadingOnly?: boolean;
} = {}) {
  const router = useRouter();
  const [clinics, setClinics] = useState<Clinic[]>(() => normalizeClinics(initialClinics));
  const [loading, setLoading] = useState(!initialLoaded && initialClinics.length === 0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(initialLoaded || initialClinics.length > 0);
  const [retryKey, setRetryKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [sortBy, setSortBy] = useState("rating");
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [restored, setRestored] = useState(false);
  const restoreScroll = useRef<number | null>(null);
  const restoredFilters = useRef(false);
  const restoringResults = useRef(false);
  const moreRequest = useRef<AbortController | null>(null);
  useEffect(() => () => moreRequest.current?.abort(), []);
  const [detectedLocation, setDetectedLocation] = useState<DetectedLocation | null>(null);
  const [filters, setFilters] = useState<ClinicFilters>(() => normalizeFilters(initialFilters, normalizeClinics(initialClinics)));
  const allCities = filters.cities;
  const quickSpecialties = [{ value: "", label: "All Care" }, ...filters.specialties.map(value => ({ value, label: value }))];

  useEffect(() => {
    if (loadingOnly) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(DISCOVERY_KEY) || "null") as DiscoveryState | null;
      if (saved) {
        sessionStorage.removeItem(DISCOVERY_KEY);
        const search = typeof saved.search === "string" ? saved.search : "";
        const city = typeof saved.city === "string" ? saved.city : "";
        const specialty = typeof saved.specialty === "string" ? saved.specialty : "";
        const sort = SORT_OPTIONS.some(option => option.value === saved.sort) ? saved.sort : "rating";
        restoredFilters.current = Boolean(search || city || specialty || sort !== "rating");
        restoringResults.current = restoredFilters.current;
        setSearchQuery(search);
        setDebouncedSearch(search);
        setSelectedCity(city);
        setSelectedSpecialty(specialty);
        setSortBy(sort);
        restoreScroll.current = Number.isFinite(saved.scrollY) && saved.scrollY > 0 ? saved.scrollY : null;
      }
    } catch { /* Browsing still works if storage is unavailable. */ }
    setRestored(true);
  }, [loadingOnly]);

  useEffect(() => {
    if (!restored || loading || restoringResults.current || restoreScroll.current === null || !clinics.length) return;
    const position = restoreScroll.current;
    restoreScroll.current = null;
    requestAnimationFrame(() => window.scrollTo({ top: position, behavior: "instant" }));
  }, [restored, loading, clinics.length]);

  const rememberPosition = () => {
    try {
      sessionStorage.setItem(DISCOVERY_KEY, JSON.stringify({ search: searchQuery, city: selectedCity, specialty: selectedSpecialty, sort: sortBy, scrollY: window.scrollY }));
    } catch { /* Optional continuity. */ }
  };

  // Auto location detection on initial load
  useEffect(() => {
    if (loadingOnly) return;
    let isMounted = true;
    const initLocation = async () => {
      try {
        const loc = await detectUserLocation();
        if (!isMounted) return;

        if (loc && (loc.city || loc.state)) {
          setDetectedLocation(loc);

        }
      } catch (err) {
        console.error("Auto location error:", err);
      }
    };

    initLocation();
    return () => {
      isMounted = false;
    };
  }, [loadingOnly]);

  // Auto-select city if user hasn't explicitly chosen one and a matching clinic city exists
  useEffect(() => {
    if (!restored || !detectedLocation?.city || allCities.length === 0) return;
    try {
      const userChoice = sessionStorage.getItem("ananta_user_city_choice");
      if (userChoice) return;

      const matched = findMatchingClinicCity(detectedLocation.city, allCities);
      if (matched && !selectedCity) {
        setSelectedCity(matched);
      }
    } catch {}
  }, [detectedLocation, allCities, selectedCity, restored]);

  // 300ms Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (loadingOnly || !restored) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (!restoredFilters.current && (initialLoaded || initialClinics.length > 0)) return;
    }
    moreRequest.current?.abort();
    setLoadingMore(false);
    const controller = new AbortController();
    const fetchClinics = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (selectedCity) params.append("city", selectedCity);
      if (selectedSpecialty) params.append("specialization", selectedSpecialty);
      params.append("sort", sortBy);
      const res = await api.get(`/public/clinics${params.toString() ? `?${params}` : ""}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!Array.isArray(res.data.data)) throw new Error("Invalid clinic response");
      const data = normalizeClinics(res.data.data);
      if (res.data.data.length && !data.length) throw new Error("Invalid clinic records");

      // Full-directory metadata remains available when results are filtered or empty.
      // Older servers fall back to actual clinic data rather than invented choices.
      setFilters((prev) => {
        const supplied = res.data.filters;
        if (supplied && Array.isArray(supplied.cities) && Array.isArray(supplied.specialties)) return normalizeFilters(supplied, data);
        const found = filtersFromClinics(data);
        return {
          cities: Array.from(new Set([...prev.cities, ...found.cities])).sort(),
          specialties: Array.from(new Set([...prev.specialties, ...found.specialties])).sort(),
        };
      });

      setClinics(data);
      setNextCursor(res.headers?.["x-next-cursor"] || null);
      setLoadMoreError(false);
      setHasLoaded(true);
    } catch {
      if (!controller.signal.aborted) setFetchError("We couldn't load clinics. Please try again.");
    } finally {
      if (!controller.signal.aborted) {
        restoringResults.current = false;
        setLoading(false);
      }
    }
    };
    void fetchClinics();
    return () => controller.abort();
  }, [debouncedSearch, selectedCity, selectedSpecialty, retryKey, sortBy, loadingOnly, restored]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore || loading || searchQuery !== debouncedSearch) return;
    const controller = new AbortController();
    moreRequest.current = controller;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const params = new URLSearchParams({ sort: sortBy, cursor: nextCursor });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (selectedCity) params.set("city", selectedCity);
      if (selectedSpecialty) params.set("specialization", selectedSpecialty);
      const res = await api.get(`/public/clinics?${params}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const raw = Array.isArray(res.data.data) ? res.data.data : res.data.data?.items;
      if (!Array.isArray(raw)) throw new Error("Invalid clinic response");
      const page = normalizeClinics(raw);
      setClinics(current => [...current, ...page.filter(item => !current.some(existing => existing.id === item.id))]);
      setNextCursor(res.data.data?.nextCursor || res.headers?.["x-next-cursor"] || null);
    } catch {
      if (!controller.signal.aborted) setLoadMoreError(true);
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  };

  const sortedClinics = useMemo(() => [...clinics].sort((a, b) => {
        if (sortBy === "fee_low") {
          if (a.minFee == null) return b.minFee == null ? 0 : 1;
          if (b.minFee == null) return -1;
          return a.minFee - b.minFee;
        }
        if (a.rating == null) return b.rating == null ? 0 : 1;
        if (b.rating == null) return -1;
        return b.rating - a.rating;
      }), [clinics, sortBy]);

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
    label: opt.label,
  }));

  return (
    <div className="min-h-screen bg-surface-alt font-sans text-text antialiased selection:bg-primary-500/20 selection:text-accent">
      <MarketplaceNavbar />

      {/* Hero Header Section - Clean Modern Healthcare Design */}
      <section className="pt-20 sm:pt-24 pb-4 sm:pb-5 bg-surface border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h1 className="text-center text-2xl sm:text-3xl font-semibold text-text tracking-tight mb-2 leading-tight text-balance" suppressHydrationWarning>
            {"Find and book"}{" "}
            <span className="text-accent" suppressHydrationWarning>{"care that fits your needs"}</span>
          </h1>
          <p className="text-center text-text-secondary text-sm mb-4 leading-relaxed" suppressHydrationWarning>
            {"Compare clinics and doctors, then book a visit that suits you."}
          </p>

          {/* Unified Streamlined Search Console: Search + City Selector */}
          <div className="mt-3">
            <div className="rounded-xl border border-border p-2 focus-within:border-accent flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2 bg-surface">
              {/* Keyword Search Input with Inside Icon */}
              <div className="flex-1 min-w-0">
                <Input
                  variant="flush"
                  disabled={loadingOnly}
                  size="md"
                  icon={<Search className="w-5 h-5 text-accent/80 shrink-0" strokeWidth={2} />}
                  placeholder={"Search clinics, doctors or specialties"}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClear={() => setSearchQuery("")}
                  className="text-sm sm:text-base font-normal py-2.5 sm:py-3 pl-11 sm:pl-12 pr-3 min-h-[48px] sm:min-h-[52px]"
                  containerClassName="w-full"
                  aria-label="Search by doctor, clinic name, or specialty"
                />
              </div>

              {/* Location Select Dropdown with Inside Icon */}
              <div className="w-full sm:w-56 md:w-64 shrink-0 border-t sm:border-t-0 sm:border-l border-border/70 pt-1.5 sm:pt-0 sm:pl-3">
                <Select
                  icon={<MapPin className="w-4 h-4 text-accent/80 shrink-0" strokeWidth={1.75} />}
                  value={selectedCity}
                  disabled={loadingOnly}
                  onChange={(e) => handleCitySelect(e.target.value)}
                  options={[
                    { value: "", label: "All Cities" },
                    ...allCities.map((c) => ({ value: c, label: c })),
                  ]}
                  size="md"
                  variant="flush"
                  className="rounded-xl sm:rounded-full text-xs sm:text-sm font-medium w-full min-h-[44px] sm:min-h-[48px] focus-visible:bg-surface-alt"
                  aria-label="Filter by location"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Listing Section */}
      <main aria-busy={loading} className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-20">
        {fetchError && clinics.length > 0 && <Alert variant="error" title="Unable to update results" className="mb-4" action={<Button size="sm" loading={loading} onClick={() => setRetryKey((key) => key + 1)}>Try again</Button>}>Showing the last available clinics. Try again to refresh the list.</Alert>}
        {/* Minimalist Compact Results & Sort Bar */}
        {(!fetchError || clinics.length > 0) && <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border/60 pb-3 mb-4 sm:mb-6 text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0 flex-1">
            <p role="status" className="font-semibold text-text-secondary min-h-5 min-w-0">
              {loading ? (
                clinics.length ? "Updating results. Showing previous clinics." : "Finding clinics..."
              ) : fetchError ? (
                clinics.length ? "Previous clinics shown. Results could not be updated." : "Results unavailable"
              ) : (
                <span>
                  <strong className="text-text font-bold">{clinics.length}</strong>{" "}
                  {clinics.length === 1 ? "clinic" : "clinics"}{nextCursor ? " shown" : <span className="hidden sm:inline"> available</span>}
                  {hasActiveFilters && (
                    <span className="text-text-muted font-normal ml-1">
                      {"(filtered)"}
                    </span>
                  )}
                </span>
              )}
            </p>

            {detectedLocation && (detectedLocation.city || detectedLocation.state) && (
              <span className="inline-flex items-center gap-1.5 text-accent text-[11px] font-medium">
                <MapPin className="w-3 h-3 text-accent shrink-0" />
                <span>
                  {"Near"}{" "}
                  <strong className="font-bold">
                    {[detectedLocation.city, detectedLocation.state].filter(Boolean).join(", ")}
                  </strong>
                </span>
                {selectedCity ? (
                  <button
                    type="button"
                    onClick={handleShowAllCities}
                    className="ml-1 text-[11px] font-bold text-accent hover:text-accent underline cursor-pointer"
                  >
                    {"Show all cities"}
                  </button>
                ) : null}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {quickSpecialties.length > 1 && (
              <Select
                icon={<Stethoscope className="w-3.5 h-3.5 text-accent shrink-0" strokeWidth={1.75} />}
                value={selectedSpecialty}
                disabled={loadingOnly}
                onChange={(e) => setSelectedSpecialty(e.target.value)}
                options={quickSpecialties}
                size="sm"
                fullWidth={false}
                compactOnMobile
                align="right"
                minMenuWidth={220}
                className="rounded-xl font-medium"
                aria-label="Filter by specialty"
              />
            )}
            <Select
              icon={<ArrowUpDown className="w-3.5 h-3.5 text-text-muted shrink-0" strokeWidth={1.75} />}
              value={sortBy}
              disabled={loadingOnly}
              onChange={(e) => setSortBy(e.target.value)}
              options={localizedSortOptions}
              size="sm"
              fullWidth={false}
              compactOnMobile
              align="right"
              minMenuWidth={180}
              className="rounded-xl font-medium"
              aria-label="Sort clinics by"
            />
          </div>
        </div>}

        {/* Clinics Listing Cards */}
        {loading && clinics.length === 0 ? (
          <ClinicCardSkeletons />
        ) : clinics.length === 0 && hasLoaded && !fetchError ? (
          <Card className="p-4 sm:p-8 text-center border-dashed rounded-3xl bg-surface">
            <EmptyState
              className="py-6 sm:py-8"
              title={"No clinics found"}
              description={hasActiveFilters ? "No clinics match your current search criteria. Try choosing another city or clearing your filters." : "There are no clinics available to browse yet. Please check again later."}
              action={hasActiveFilters ?
                <Button
                  variant="primary"
                  size="sm"
                  onClick={resetAllFilters}
                  className="rounded-xl font-bold px-5 min-h-[44px] flex items-center justify-center"
                >
                  {"Reset all filters"}
                </Button> : undefined
              }
            />
          </Card>
        ) : clinics.length === 0 ? <Card className="min-h-[220px] flex items-center justify-center p-4 sm:p-8 rounded-2xl border border-border bg-surface"><EmptyState className="py-5 sm:py-7" title="We couldn't load clinics" description="Check your connection and try again to see available care." action={<Button size="sm" loading={loading} onClick={() => setRetryKey((key) => key + 1)}>Try again</Button>} /></Card> : (
          /* Modern Healthcare Clinic Card Grid */
          <div className={`grid grid-cols-1 gap-4 sm:gap-6 ${sortedClinics.length === 1 ? "md:mx-auto md:max-w-[360px]" : sortedClinics.length === 2 ? "md:grid-cols-2 lg:mx-auto lg:max-w-[744px]" : "md:grid-cols-2 lg:grid-cols-3"}`}>
            {sortedClinics.map((clinic) => {
              const bookingStatus = getPublicBookingStatus(clinic);
              const hasSingleDoctor = clinic.doctorCount === 1 && clinic.doctorsSummary && clinic.doctorsSummary.length === 1;
              const singleDoctor = hasSingleDoctor ? clinic.doctorsSummary![0] : null;
              const bookingHref = bookingStatus === "check_availability" && singleDoctor
                ? `/doctor/${encodeURIComponent(singleDoctor.id)}?clinicId=${encodeURIComponent(clinic.id)}&openBooking=true`
                : `/browse/${clinic.id}`;
              const hasClinicHours = parseWeeklySchedule(clinic.timings).hasExplicitSchedule;
              const doctorMatches = debouncedSearch.trim().toLocaleLowerCase();
              const previewDoctors = doctorMatches
                ? [...(clinic.doctorsSummary || [])].sort((a, b) => Number(b.name.toLocaleLowerCase().includes(doctorMatches) || b.specialization.toLocaleLowerCase().includes(doctorMatches)) - Number(a.name.toLocaleLowerCase().includes(doctorMatches) || a.specialization.toLocaleLowerCase().includes(doctorMatches)))
                : clinic.doctorsSummary || [];

              return (
                <Card
                  key={clinic.id}
                  role="group"
                  onClick={() => { rememberPosition(); router.push(`/browse/${clinic.id}`); }}
                  className="group cursor-pointer hover:border-accent/40 p-4 rounded-xl border border-border bg-surface flex flex-col"
                  contentClassName="flex-1 justify-between gap-3"
                >
                  <div>
                    {/* Clinic identity */}
                    <div className="flex items-start justify-between gap-2.5 mb-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-surface-alt border border-border flex items-center justify-center shrink-0 shadow-2xs group-hover:border-primary-500/30 transition-colors overflow-hidden">
                          {clinic.logo_url || clinic.image_url ? (
                            <ClinicImage src={clinic.logo_url || clinic.image_url} name={clinic.name} />
                          ) : (
                            <Building2 className="w-5 h-5 text-text-muted group-hover:text-accent transition-colors" strokeWidth={1.75} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h2
                              className="text-base font-semibold text-text group-hover:text-accent transition-colors min-w-0"
                              title={clinic.name}
                            >
                              <Link href={`/browse/${clinic.id}`} onClick={(event) => { event.stopPropagation(); rememberPosition(); }} className="block line-clamp-2 break-words focus-visible:outline-none focus-visible:underline">{clinic.name}</Link>
                            </h2>
                          </div>
                          {clinic.organizationName && clinic.organizationName !== clinic.name && (
                            <p className="text-[10px] text-text-muted font-medium truncate">
                              {"Part of"} {clinic.organizationName}
                            </p>
                          )}
                          <p className="text-xs text-text-muted flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="truncate">{clinic.city || "Location not listed"}</span>
                            {hasClinicHours && <><span aria-hidden="true">•</span><ClinicStatusBadge timings={clinic.timings} compact className="max-w-full flex-wrap" /></>}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {clinic.images && clinic.images.length > 0 && (
                          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-text-muted">
                            <Camera className="w-2.5 h-2.5 text-accent" />
                            <span>{clinic.images.length} {"photos"}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Doctor Count & Fee Highlights Pill Row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-xs">
                      <span className="font-medium text-text-secondary flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-text-muted shrink-0" strokeWidth={1.75} />
                        <span>
                          {clinic.doctorCount
                            ? `${clinic.doctorCount} ${
                                clinic.doctorCount === 1
                                  ? "Doctor"
                                  : "Doctors"
                              }`
                            : clinic.doctorCount === 0 ? "No doctors listed" : "Doctor details pending"}
                        </span>
                      </span>

                      {!(hasSingleDoctor && singleDoctor?.fees != null) && !(clinic.doctorsSummary && clinic.doctorsSummary.length > 1) && clinic.minFee !== undefined && clinic.minFee !== null && (
                        <span className="font-medium text-text flex items-center gap-1">
                          <CreditCard className="w-3.5 h-3.5 text-text-muted shrink-0" strokeWidth={1.75} />
                          <span>
                            {directoryMinimumFeeLabel(clinic.minFee, clinic.currency || "INR")}
                          </span>
                        </span>
                      )}
                      {clinic.rating != null && (clinic.reviewsCount || 0) > 0 && (
                        <span className="font-semibold text-text flex items-center gap-1" aria-label={`${clinic.rating.toFixed(1)} out of 5 from ${clinic.reviewsCount} reviews`}>
                          <Star className="w-3.5 h-3.5 text-text-muted shrink-0" strokeWidth={1.75} aria-hidden="true" />
                          {clinic.rating.toFixed(1)} <span className="text-text-muted">({clinic.reviewsCount})</span>
                        </span>
                      )}
                    </div>

                    {/* Single Doctor Highlight or Multi-Doctor Preview */}
                    {hasSingleDoctor && singleDoctor ? (
                      <Link href={`/doctor/${encodeURIComponent(singleDoctor.id)}?clinicId=${encodeURIComponent(clinic.id)}`} onClick={(event) => { event.stopPropagation(); rememberPosition(); }} className="block bg-surface-alt/70 p-3 rounded-xl text-xs mb-3 space-y-1 hover:bg-primary-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-text-muted">
                            {"Practicing Specialist"}
                          </span>
                          <span className="text-[11px] font-bold text-success-text dark:text-success-text">
                            {directoryDoctorFeeLabel(singleDoctor, clinic.currency || "INR")}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-text break-words">Dr. {singleDoctor.name.replace(/^Dr\.?\s*/i, "")}</p>
                        <p className="text-xs text-text-secondary leading-relaxed">{singleDoctor.specialization}</p>
                      </Link>
                    ) : clinic.doctorsSummary && clinic.doctorsSummary.length > 1 ? (
                      <div className="bg-surface-alt/70 p-3 rounded-xl text-xs mb-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-text-muted">
                            {clinic.doctorsSummary.length} {"Consulting Doctors"}
                          </span>
                          {clinic.minFee !== undefined && clinic.minFee !== null && (
                            <span className="text-[11px] font-bold text-success-text dark:text-success-text">
                              {directoryMinimumFeeLabel(clinic.minFee, clinic.currency || "INR")}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          {previewDoctors.slice(0, 2).map((doc) => (
                            <Link key={doc.id} href={`/doctor/${encodeURIComponent(doc.id)}?clinicId=${encodeURIComponent(clinic.id)}`} onClick={(event) => { event.stopPropagation(); rememberPosition(); }} className="block space-y-0.5 rounded-lg text-xs hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                              <span className="block font-medium text-text break-words">
                                Dr. {doc.name.replace(/^Dr\.?\s*/i, "")}
                              </span>
                              <span className="block text-text-secondary text-[11px] break-words">
                                {doc.specialization}
                              </span>
                            </Link>
                          ))}
                          {clinic.doctorsSummary.length > 2 && (
                            <p className="text-[10px] text-accent font-semibold pt-0.5">
                              +{clinic.doctorsSummary.length - 2} {"more doctors available"}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-text-muted line-clamp-2 leading-relaxed mb-3">
                        {clinic.description || "Doctor and clinic details are available on the profile."}
                      </p>
                    )}

                    {/* Facilities / Specialty Tags */}
                    {clinic.facilities && clinic.facilities.length > 0 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
                        {clinic.facilities.slice(0, 3).map((fac, idx) => (
                          <span
                            key={idx}
                            className="text-[11px] text-text-muted"
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
                    {/* Keep the card footer focused on useful location details. */}
                    {clinic.address && clinic.address.trim() !== "." && (
                      <div className="text-xs text-text-secondary border-t border-border/60 pt-2.5 mb-3">
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0" strokeWidth={1.75} />
                          <span className="truncate">{clinic.address}</span>
                        </div>
                      </div>
                    )}

                    {/* Actions Bar */}
                    <div className="flex items-center gap-2">
                      {bookingStatus === "contact_clinic" && clinic.phone ? <a href={`tel:${clinic.phone.replace(/\s+/g, "")}`} onClick={(event) => event.stopPropagation()} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-3.5 text-sm font-bold text-brand-mist shadow-xs hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">Call clinic about appointments</a> : <Link
                        href={bookingHref}
                        onClick={(event) => { event.stopPropagation(); rememberPosition(); }}
                        className="group/btn inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 text-sm font-bold text-brand-mist shadow-xs hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      >
                        <span className="min-w-0 text-center">
                          {bookingStatus === "contact_clinic"
                            ? "View contact options"
                            : bookingStatus === "no_doctors"
                            ? "View clinic"
                            : "Book Appointment"}
                        </span>
                        <ChevronRight className="w-4 h-4 shrink-0 group-hover/btn:translate-x-0.5 transition-transform" strokeWidth={2} />
                      </Link>}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        {nextCursor && !loading && searchQuery === debouncedSearch && !fetchError && <div className="mt-6 flex flex-col items-center gap-2">
          <Button variant="outline" onClick={loadMore} loading={loadingMore} className="min-h-11 min-w-40">Load more clinics</Button>
          {loadMoreError && <p role="alert" className="text-sm text-danger-text">More clinics could not be loaded. Please try again.</p>}
        </div>}
      </main>
    </div>
  );
}
