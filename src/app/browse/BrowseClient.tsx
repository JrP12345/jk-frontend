"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import api from "@/lib/api";
import { type FacilityType } from "@/lib/facility";
import { Alert, Button, Select, Card, EmptyState, Modal } from "@/components/ui";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import LocationCardSkeletons from "@/components/ui/LocationCardSkeletons";
import LocationCard from "./LocationCard";
import BrowseSearch from "./BrowseSearch";
import BrowseFilters, { type BrowseFilterValues } from "./BrowseFilters";
import { facilityCoordinates, type MapBounds } from "./browsePresentation";
import styles from "./browse.module.css";
import marketplace from "@/components/MarketplaceLayout.module.css";
import { List, Map, SlidersHorizontal } from "lucide-react";
import { getPublicBookingStatus, type PublicBookingStatus } from "@/lib/publicBooking";
import { detectUserLocation, hasLocationCoordinates, type DetectedLocation } from "@/lib/geo/locationDetector";

const BrowseMap = dynamic(() => import("./BrowseMap"), { ssr: false, loading: () => <div role="status" className={styles.mapLoading}>Loading map…</div> });

interface DoctorSummary {
  id: string;
  slug?: string;
  name: string;
  specialization: string;
  fees?: number;
  feeType?: "fixed" | "free" | "post_consultation";
}

export interface Location {
  id: string;
  slug?: string;
  name: string;
  facilityType?: FacilityType | null;
  city: string;
  address: string;
  phone: string;
  email: string;
  latitude?: number;
  longitude?: number;
  description: string;
  image_url: string;
  logo_url?: string;
  images?: string[];
  organizationName?: string;
  organizationLocationCount?: number;
  currency?: string;
  timings: string;
  timezone?: string;
  amenities?: string[];
  doctorCount?: number;
  minFee?: number | null;
  rating?: number | null;
  reviewsCount?: number;
  distanceKm?: number;
  specialties?: string[];
  doctorsSummary?: DoctorSummary[];
  onlineBookingAvailable?: boolean;
  bookingStatus?: PublicBookingStatus;
}

export interface LocationFilters {
  cities: string[];
  specialties: string[];
  specialtyCounts?: Record<string, number>;
}

function filtersFromLocations(locations: Location[]): LocationFilters {
  return {
    cities: Array.from(new Set(locations.map(c => c.city).filter(Boolean))).sort(),
    specialties: Array.from(new Set(locations.flatMap(c => c.specialties?.length ? c.specialties : c.doctorsSummary?.map(d => d.specialization) || []).map(s => s.trim()).filter(s => s && s !== "Specialty not listed"))).sort(),
  };
}

/** Keep incomplete directory records readable without inventing availability. */
export function normalizeLocations(input: unknown): Location[] {
  if (!Array.isArray(input)) return [];
  const string = (value: unknown) => typeof value === "string" ? value.trim() : "";
  const strings = (value: unknown) => Array.isArray(value) ? value.map(string).filter(Boolean) : [];
  const number = (value: unknown) => (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : undefined;
  const seen = new Set<string>();
  return input.flatMap(raw => {
    if (!raw || typeof raw !== "object") return [];
    const id = string(raw.id);
    if (!id || seen.has(id)) return [];
    seen.add(id);
    const feedbackCount = number(raw.reviewsCount);
    const feedbackRating = number(raw.rating);
    const supportedRating = feedbackCount !== undefined && Number.isInteger(feedbackCount) && feedbackCount > 0 && feedbackRating !== undefined && feedbackRating >= 1 && feedbackRating <= 5;
    return [{ ...raw, id, name: string(raw.name) || "Healthcare facility", city: string(raw.city), address: string(raw.address), phone: string(raw.phone), email: string(raw.email), description: string(raw.description), timezone: string(raw.timezone), image_url: string(raw.image_url), logo_url: string(raw.logo_url), organizationName: string(raw.organizationName), currency: /^[A-Z]{3}$/.test(string(raw.currency).toUpperCase()) ? string(raw.currency).toUpperCase() : "INR", timings: typeof raw.timings === "object" && raw.timings ? JSON.stringify(raw.timings) : string(raw.timings), images: strings(raw.images), amenities: strings(raw.amenities), specialties: strings(raw.specialties), doctorCount: number(raw.doctorCount), minFee: number(raw.minFee), rating: supportedRating ? feedbackRating : undefined, reviewsCount: supportedRating ? feedbackCount : 0, onlineBookingAvailable: typeof raw.onlineBookingAvailable === "boolean" ? raw.onlineBookingAvailable : undefined, bookingStatus: getPublicBookingStatus({ bookingStatus: raw.bookingStatus, onlineBookingAvailable: raw.onlineBookingAvailable, doctorCount: number(raw.doctorCount) }), doctorsSummary: Array.isArray(raw.doctorsSummary) ? raw.doctorsSummary.filter((doc: DoctorSummary) => doc && string(doc.id) && string(doc.name)).map((doc: DoctorSummary) => ({ ...doc, name: string(doc.name), specialization: string(doc.specialization) || "Specialty not listed", fees: number(doc.fees), feeType: doc.feeType })) : [] }];
  });
}

function normalizeFilters(filters: LocationFilters | undefined, locations: Location[]): LocationFilters {
  const fallback = filtersFromLocations(locations);
  const values = (input: unknown, defaults: string[]) => Array.isArray(input) ? Array.from(new Set(input.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map(value => value.trim()))).sort() : defaults;
  return { cities: values(filters?.cities, fallback.cities), specialties: values(filters?.specialties, fallback.specialties), specialtyCounts: filters?.specialtyCounts };
}


const SORT_OPTIONS = [{ value: "nearby", label: "Nearest first" }, { value: "rating", label: "Top rated" }, { value: "fee_low", label: "Lowest fee" }];
const DISCOVERY_KEY = "ekavyu_browse_discovery";
const emptyFilters: BrowseFilterValues = { city: "", specialties: [], openNow: false, open24Hours: false };
type DiscoveryState = BrowseFilterValues & { search: string; sort: string; scrollY: number; view: "list" | "map" };

export default function BrowseClient({ initialLocations = [], initialLoaded = false, initialFilters, initialNextCursor = null, initialSearch, initialView = "list", loadingOnly = false }: {
  initialLocations?: Location[]; initialLoaded?: boolean; initialFilters?: LocationFilters; initialNextCursor?: string | null; initialSearch?: string; initialView?: "list" | "map"; loadingOnly?: boolean;
} = {}) {
  const [locations, setLocations] = useState<Location[]>(() => normalizeLocations(initialLocations));
  const [loading, setLoading] = useState(!initialLoaded && initialLocations.length === 0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(initialLoaded || initialLocations.length > 0);
  const [retryKey, setRetryKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState(initialSearch || "");
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch || "");
  const [values, setValues] = useState<BrowseFilterValues>(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState("nearby");
  const [nearbySortFailed, setNearbySortFailed] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [restored, setRestored] = useState(false);
  const [view, setView] = useState<"list" | "map">(initialView);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const restoreScroll = useRef<number | null>(null);
  const restoredFilters = useRef(false);
  const restoringResults = useRef(false);
  const moreRequest = useRef<AbortController | null>(null);
  useEffect(() => () => moreRequest.current?.abort(), []);
  const [detectedLocation, setDetectedLocation] = useState<DetectedLocation | null>(null);
  const latitude = bounds ? (bounds[0] + bounds[2]) / 2 : hasLocationCoordinates(detectedLocation) ? detectedLocation.latitude : undefined;
  const longitude = bounds ? bounds[1] <= bounds[3] ? (bounds[1] + bounds[3]) / 2 : ((bounds[1] + bounds[3] + 360) / 2 + 180) % 360 - 180 : hasLocationCoordinates(detectedLocation) ? detectedLocation.longitude : undefined;
  const effectiveSort = sortBy === "nearby" && latitude === undefined ? "rating" : sortBy;
  const [filters, setFilters] = useState<LocationFilters>(() => normalizeFilters(initialFilters, normalizeLocations(initialLocations)));
  const origin = useMemo(() => hasLocationCoordinates(detectedLocation) ? { latitude: detectedLocation.latitude, longitude: detectedLocation.longitude, approximate: detectedLocation.source === "ip" || (detectedLocation.accuracy ?? 0) > 1000 } : undefined, [detectedLocation]);

  useEffect(() => {
    if (loadingOnly) return;
    let mounted = true;
    queueMicrotask(() => {
    if (!mounted) return;
    if (initialSearch !== undefined) {
      try { sessionStorage.removeItem(DISCOVERY_KEY); } catch { /* Optional continuity. */ }
      setRestored(true);
      return;
    }
    try {
      const saved = JSON.parse(sessionStorage.getItem(DISCOVERY_KEY) || "null") as DiscoveryState | null;
      if (saved) {
        sessionStorage.removeItem(DISCOVERY_KEY);
        const search = typeof saved.search === "string" ? saved.search : "";
        const city = typeof saved.city === "string" ? saved.city : "";
        const specialties = Array.isArray(saved.specialties) ? saved.specialties.filter((value): value is string => typeof value === "string") : [];
        const sort = SORT_OPTIONS.some(option => option.value === saved.sort) ? saved.sort : "nearby";
        restoredFilters.current = Boolean(search || city || specialties.length || saved.openNow || saved.open24Hours || sort !== "nearby");
        restoringResults.current = restoredFilters.current;
        setSearchQuery(search);
        setDebouncedSearch(search);
        setValues({ city, specialties, openNow: saved.openNow === true, open24Hours: saved.open24Hours === true });
        setSortBy(sort);
        if (initialView !== "map" && saved.view === "map") setView("map");
        restoreScroll.current = Number.isFinite(saved.scrollY) && saved.scrollY > 0 ? saved.scrollY : null;
      }
    } catch { /* Storage never gates browsing. */ }
    setRestored(true);
    });
    return () => { mounted = false; };
  }, [loadingOnly, initialSearch, initialView]);

  useEffect(() => {
    if (!restored || loading || restoringResults.current || restoreScroll.current === null || !locations.length) return;
    const position = restoreScroll.current;
    restoreScroll.current = null;
    requestAnimationFrame(() => window.scrollTo({ top: position, behavior: "instant" }));
  }, [restored, loading, locations.length]);
  const rememberPosition = () => {
    try { sessionStorage.setItem(DISCOVERY_KEY, JSON.stringify({ ...values, search: searchQuery, sort: sortBy, scrollY: window.scrollY, view })); } catch { /* Optional continuity. */ }
  };
  useEffect(() => {
    if (loadingOnly) return;
    let mounted = true;
    void detectUserLocation().then(location => { if (mounted && location) setDetectedLocation(location); }).catch(() => {});
    return () => { mounted = false; };
  }, [loadingOnly]);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  useEffect(() => {
    if (!values.openNow) return;
    const timer = setInterval(() => setRetryKey(value => value + 1), 60000);
    return () => clearInterval(timer);
  }, [values.openNow]);

  const makeParams = (cursor?: string) => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (values.city) params.set("city", values.city);
    values.specialties.forEach(value => params.append("specialization", value));
    params.set("sort", effectiveSort);
    if (cursor) params.set("cursor", cursor);
    if (effectiveSort === "nearby" && latitude !== undefined && longitude !== undefined) {
      params.set("latitude", String(latitude));
      params.set("longitude", String(longitude));
    }
    if (values.openNow) params.set("openNow", "true");
    if (values.open24Hours) params.set("open24Hours", "true");
    if (bounds) params.set("bounds", bounds.join(","));
    return params;
  };
  // One request owns the complete search/filter context, including map bounds.
  const firstRequest = useRef(true);
  useEffect(() => {
    if (loadingOnly || !restored) return;
    if (firstRequest.current) {
      firstRequest.current = false;
      if (effectiveSort === "rating" && !restoredFilters.current && (initialLoaded || initialLocations.length > 0)) return;
    }
    moreRequest.current?.abort();
    setLoadingMore(false);
    const controller = new AbortController();
    let fallingBack = false;
    setLoading(true);
    setFetchError(null);
    void api.get("/public/locations?" + makeParams(), { signal: controller.signal }).then(res => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(res.data.data)) throw new Error("Invalid location response");
      const data = normalizeLocations(res.data.data);
      if (res.data.data.length && !data.length) throw new Error("Invalid location records");
      if (res.data.filters) setFilters(normalizeFilters(res.data.filters, []));
      setLocations(data);
      setNextCursor(res.headers?.["x-next-cursor"] || null);
      setLoadMoreError(false);
      setHasLoaded(true);
    }).catch(() => {
      if (controller.signal.aborted) return;
      if (effectiveSort === "nearby") { fallingBack = true; setNearbySortFailed(true); setSortBy("rating"); }
      else setFetchError("We couldn't load locations. Please try again.");
    }).finally(() => {
      if (!controller.signal.aborted && !fallingBack) { restoringResults.current = false; setLoading(false); }
    });
    return () => controller.abort();
    // makeParams only reads these dependencies; keeping it local avoids request loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, values, retryKey, effectiveSort, latitude, longitude, bounds, loadingOnly, restored]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore || loading || searchQuery !== debouncedSearch) return;
    const controller = new AbortController();
    moreRequest.current = controller;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const res = await api.get("/public/locations?" + makeParams(nextCursor), { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!Array.isArray(res.data.data)) throw new Error("Invalid location response");
      const page = normalizeLocations(res.data.data);
      setLocations(current => [...current, ...page.filter(item => !current.some(existing => existing.id === item.id))]);
      setNextCursor(res.headers?.["x-next-cursor"] || null);
    } catch { if (!controller.signal.aborted) setLoadMoreError(true); }
    finally { if (!controller.signal.aborted) setLoadingMore(false); }
  };
  const sortedLocations = useMemo(() => [...locations].sort((a, b) => {
    if (effectiveSort === "nearby") return 0;
    const av = effectiveSort === "fee_low" ? a.minFee : a.rating, bv = effectiveSort === "fee_low" ? b.minFee : b.rating;
    if (av == null) return bv == null ? 0 : 1;
    if (bv == null) return -1;
    return effectiveSort === "fee_low" ? av - bv : bv - av;
  }), [locations, effectiveSort]);
  const activeId = sortedLocations.some(location => location.id === selectedId) ? selectedId : sortedLocations.find(location => facilityCoordinates(location))?.id || null;
  const changeFilters = (next: BrowseFilterValues) => { setValues(next); setBounds(null); };
  const resetFilters = () => { setSearchQuery(""); setValues(emptyFilters); setBounds(null); };
  const hasActiveFilters = Boolean(debouncedSearch || values.city || values.specialties.length || values.openNow || values.open24Hours || bounds);
  const submitSearch = () => {
    const value = searchQuery.trim();
    setBounds(null);
    setSearchQuery(value);
    if (value === debouncedSearch && !loading) setRetryKey(key => key + 1);
    else setDebouncedSearch(value);
  };
  const changeView = (next: "list" | "map") => {
    setView(next);
    const url = new URL(window.location.href);
    if (next === "map") url.searchParams.set("view", "map"); else url.searchParams.delete("view");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  };
  const area = values.city || (bounds ? "Selected map area" : origin ? detectedLocation?.source === "ip" ? "Near " + (detectedLocation.city || detectedLocation.state || "you") + " (approx.)" : "Near your location" : "All cities");
  const filterProps = { values, filters, onChange: changeFilters, onClear: resetFilters, hasArea: Boolean(bounds), onClearArea: () => setBounds(null) };

  return <div className={marketplace.page + " " + styles.page} data-browse-view={view}>
    <MarketplaceNavbar showSearch={false} showSignUp searchSlot={<BrowseSearch search={searchQuery} city={values.city} cities={filters.cities} disabled={loadingOnly} onSearch={value => { setSearchQuery(value); setBounds(null); }} onCity={city => changeFilters({ ...values, city })} onSubmit={submitSearch} />} />
    <main className={styles.main}>
      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="Filter facilities"><Card padding="none"><BrowseFilters {...filterProps} /></Card></aside>
        <section className={styles.resultsSection} aria-labelledby="browse-title" aria-busy={loading}>
          <header className={styles.toolbar}>
            <div className={styles.heading}><h1 id="browse-title" className="page-title">Clinics &amp; hospitals{values.city ? " in " + values.city : ""}</h1><p className={styles.resultCount}>{hasLoaded || locations.length ? <>{locations.length} {locations.length === 1 ? "location" : "locations"}{nextCursor ? " shown" : ""}</> : "Finding locations…"}<span aria-hidden="true"> · </span><span title={area}>{area}</span></p></div>
            <div className={styles.controls}>
              <Button variant="outline" className={styles.filterButton + " min-h-11!"} onClick={() => setFiltersOpen(true)} aria-label="Filters" aria-expanded={filtersOpen} aria-haspopup="dialog" data-active={hasActiveFilters} icon={<SlidersHorizontal aria-hidden="true" />}>Filters{hasActiveFilters && <span className={styles.filterDot} />}</Button>
              <div role="group" aria-label="Browse view" className={styles.viewSwitch}><Button variant={view === "list" ? "primary" : "ghost"} onClick={() => changeView("list")} aria-pressed={view === "list"} icon={<List aria-hidden="true" />}>List</Button><Button variant={view === "map" ? "primary" : "ghost"} onClick={() => changeView("map")} aria-pressed={view === "map"} icon={<Map aria-hidden="true" />}>Map</Button></div>
              <Select value={effectiveSort} disabled={loadingOnly} onChange={event => { setNearbySortFailed(false); setSortBy(event.target.value); }} options={SORT_OPTIONS.filter(option => option.value !== "nearby" || latitude !== undefined)} aria-label="Sort by" containerClassName={styles.sort} className="min-h-11! text-sm!" />
            </div>
          </header>
          <span role="status" className="sr-only">{loading ? "Updating locations" : fetchError ? "Locations could not be updated" : locations.length + " locations found"}</span>
          <div className={styles.resultsLayout}>
            <div className={styles.resultList}>
              {fetchError && locations.length > 0 && <Alert variant="error" title="Unable to update results" action={<Button size="sm" onClick={() => setRetryKey(value => value + 1)}>Try again</Button>}>Showing the last available locations.</Alert>}
              {nearbySortFailed && !loading && !fetchError && <p className={styles.recovery} role="status">Distance sorting is temporarily unavailable. Showing top rated locations.</p>}
              {loading && !locations.length ? <LocationCardSkeletons /> : !locations.length ? <Card className={styles.empty}><EmptyState title={fetchError ? "We couldn't load locations" : "No locations found"} description={fetchError ? "Check your connection and try again." : hasActiveFilters ? "Try another area or clear your filters." : "There are no published locations to browse yet."} action={fetchError ? <Button onClick={() => setRetryKey(value => value + 1)}>Try again</Button> : hasActiveFilters ? <Button onClick={resetFilters}>Clear all filters</Button> : undefined} /></Card> : <ul className={styles.grid} aria-label="Healthcare locations">{sortedLocations.map((location, index) => <li key={location.id}><LocationCard location={location} onNavigate={rememberPosition} preload={locations.length === 1} showDistance={effectiveSort === "nearby"} approximateDistance={!bounds && Boolean(origin?.approximate)} variant={view === "map" ? "compact" : "row"} selected={view === "map" && location.id === activeId} number={view === "map" ? index + 1 : undefined} onSelect={view === "map" ? () => setSelectedId(location.id) : undefined} /></li>)}</ul>}
              {nextCursor && !loading && searchQuery === debouncedSearch && !fetchError && <div className={styles.loadMore}><Button variant="outline" onClick={loadMore} loading={loadingMore}>Load more locations</Button>{loadMoreError && <p role="alert">More locations could not be loaded. Please try again.</p>}</div>}
            </div>
            {view === "map" && <div className={styles.mapPane}><BrowseMap locations={sortedLocations} selectedId={activeId} onSelect={setSelectedId} origin={origin} onSearchArea={setBounds} onNavigate={rememberPosition} resetKey={JSON.stringify([debouncedSearch, values])} loading={loading} hasMore={Boolean(nextCursor)} onLoadMore={loadMore} loadingMore={loadingMore} error={fetchError || (loadMoreError ? "More locations could not be loaded." : null)} onRetry={() => loadMoreError ? void loadMore() : setRetryKey(value => value + 1)} /></div>}
          </div>
        </section>
      </div>
    </main>
    <Button className={styles.floatingView} onClick={() => changeView(view === "list" ? "map" : "list")} icon={view === "list" ? <Map aria-hidden="true" /> : <List aria-hidden="true" />}>{view === "list" ? "Map" : "List"}</Button>
    <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter locations" presentation="sheet" size="md" footer={<Button onClick={() => setFiltersOpen(false)}>Show results</Button>}><BrowseFilters {...filterProps} showCity /></Modal>
  </div>;
}
