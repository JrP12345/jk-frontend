"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Spinner, Input, Button } from "@/components/ui";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";

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
}

const SPECIALTIES = [
  { id: "", label: "All Specialties", icon: "🏥" },
  { id: "General Medicine", label: "General Medicine", icon: "🩺" },
  { id: "Pediatrics", label: "Pediatrics", icon: "👶" },
  { id: "Cardiology", label: "Cardiology", icon: "❤️" },
  { id: "Dentistry", label: "Dentistry", icon: "🦷" },
  { id: "Orthopedics", label: "Orthopedics", icon: "🦴" },
];

const SORT_OPTIONS = [
  { value: "latest", label: "Latest" },
  { value: "name", label: "Name A–Z" },
  { value: "city", label: "By City" },
];

export default function BrowseClient() {
  const router = useRouter();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [sortBy, setSortBy] = useState("latest");
  const [allCities, setAllCities] = useState<string[]>([]);

  const formatTimings = (timingsStr: string | null | undefined): string => {
    if (!timingsStr) return "";
    try {
      const data = JSON.parse(timingsStr);
      const days = Object.keys(data);
      for (const day of days) {
        if (data[day] && data[day].length > 0) {
          const firstSlot = data[day][0];
          return `${firstSlot.start} – ${firstSlot.end}`;
        }
      }
      return "";
    } catch {
      return timingsStr;
    }
  };

  const fetchClinics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (selectedCity) params.append("city", selectedCity);
      if (selectedSpecialty) params.append("specialization", selectedSpecialty);
      const res = await api.get(`/public/clinics${params.toString() ? `?${params}` : ""}`);
      const data: Clinic[] = res.data.data || [];
      setAllCities([...new Set(data.map(c => c.city).filter(Boolean))]);
      // Sort
      const sorted = [...data].sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "city") return a.city.localeCompare(b.city);
        return 0; // latest = server order
      });
      setClinics(sorted);
    } catch (err) {
      console.error("Failed to fetch clinics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClinics(); }, [search, selectedCity, selectedSpecialty, sortBy]);

  return (
    <div className="min-h-screen bg-[var(--color-surface-alt)] pt-16 pb-24">
      <MarketplaceNavbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-[var(--color-primary-600)]/10 blur-[120px]" />
          <div className="absolute top-10 right-1/4 w-72 h-72 rounded-full bg-blue-500/8 blur-[100px]" />
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[var(--color-primary-600)] bg-[var(--color-primary-600)]/10 px-3 py-1 rounded-full mb-4 border border-[var(--color-primary-600)]/20">
              🏥 Verified Healthcare Network
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--color-text)] tracking-tight mb-3 leading-tight">
              Find Your Perfect
              <span className="text-[var(--color-primary-600)]"> Medical Care</span>
            </h1>
            <p className="text-[var(--color-text-secondary)] text-sm sm:text-base max-w-lg mx-auto">
              Discover verified clinics, connect with expert specialists, and book appointments instantly.
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto relative">
            <div className="flex gap-2 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-lg p-2">
              <div className="flex-1">
                <Input
                  placeholder="Search by clinic name, address, city..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="border-0 bg-transparent shadow-none focus:ring-0 text-sm"
                  icon={
                    <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  }
                />
              </div>
              <Button variant="primary" className="px-5 rounded-xl shrink-0">
                Search
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Filters Row */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          {/* Specialty Pills */}
          <div className="flex flex-wrap gap-2 items-center">
            {SPECIALTIES.map(spec => (
              <button
                key={spec.id}
                onClick={() => setSelectedSpecialty(spec.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                  selectedSpecialty === spec.id
                    ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)] shadow-sm"
                    : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary-600)]/50 hover:text-[var(--color-text)]"
                }`}
              >
                <span>{spec.icon}</span>
                <span>{spec.label}</span>
              </button>
            ))}
          </div>

          {/* Right filters */}
          <div className="flex items-center gap-2 shrink-0">
            {allCities.length > 1 && (
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="text-xs bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text)] cursor-pointer focus:outline-none focus:border-[var(--color-primary-600)] transition-colors"
              >
                <option value="">All Cities</option>
                {allCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            )}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text)] cursor-pointer focus:outline-none focus:border-[var(--color-primary-600)] transition-colors"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)]">
            {loading ? "Searching..." : (
              <><span className="text-[var(--color-text)] font-bold text-base">{clinics.length}</span> clinic{clinics.length !== 1 ? "s" : ""} found</>
            )}
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] animate-pulse">
                <div className="h-44 bg-[var(--color-surface-alt)]" />
                <div className="p-5 space-y-3">
                  <div className="h-4 w-3/4 bg-[var(--color-surface-alt)] rounded-lg" />
                  <div className="h-3 w-full bg-[var(--color-surface-alt)] rounded" />
                  <div className="h-3 w-1/2 bg-[var(--color-surface-alt)] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : clinics.length === 0 ? (
          <div className="text-center py-24 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]">
            <div className="text-5xl mb-4">🏥</div>
            <h3 className="text-lg font-bold text-[var(--color-text)] mb-2">No Clinics Found</h3>
            <p className="text-[var(--color-text-muted)] text-sm max-w-xs mx-auto">
              Try adjusting your filters or search terms to discover available clinics.
            </p>
            <button
              onClick={() => { setSearch(""); setSelectedCity(""); setSelectedSpecialty(""); }}
              className="mt-5 text-sm font-semibold text-[var(--color-primary-600)] hover:underline cursor-pointer"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {clinics.map((clinic) => (
              <article
                key={clinic.id}
                onClick={() => router.push(`/browse/${clinic.id}`)}
                className="group bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden cursor-pointer hover:shadow-xl hover:border-[var(--color-primary-600)]/40 hover:-translate-y-1 transition-all duration-300 flex flex-col"
              >
                {/* Banner */}
                <div className="h-44 relative overflow-hidden flex-shrink-0 bg-[var(--color-surface-alt)]">
                  {clinic.image_url ? (
                    <img
                      src={clinic.image_url}
                      alt={clinic.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[var(--color-primary-600)]/15 via-[var(--color-surface-alt)] to-blue-600/10">
                      <svg className="w-14 h-14 text-[var(--color-primary-600)]/30 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="text-xs text-[var(--color-text-muted)] font-medium">{clinic.name}</span>
                    </div>
                  )}
                  {/* City badge */}
                  <div className="absolute top-3 left-3">
                    <span className="bg-[var(--color-surface)]/95 backdrop-blur-sm text-[var(--color-text)] text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm border border-[var(--color-border)]/50">
                      📍 {clinic.city}
                    </span>
                  </div>
                  {/* Rating pill */}
                  <div className="absolute top-3 right-3">
                    <span className="bg-amber-500/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm flex items-center gap-0.5">
                      ★ 4.9
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex flex-col flex-1 gap-3">
                  <div>
                    <h3 className="text-base font-bold text-[var(--color-text)] group-hover:text-[var(--color-primary-600)] transition-colors line-clamp-1 leading-snug">
                      {clinic.name}
                    </h3>
                    <p className="text-[11px] text-[var(--color-text-muted)] line-clamp-2 mt-1 leading-relaxed">
                      {clinic.description || "A premier HealthOS clinic offering comprehensive medical services and specialized practitioner care."}
                    </p>
                  </div>

                  {/* Facilities */}
                  {clinic.facilities && clinic.facilities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {clinic.facilities.slice(0, 3).map((fac, idx) => (
                        <span
                          key={idx}
                          className="text-[9px] font-bold uppercase tracking-wide bg-[var(--color-primary-600)]/8 text-[var(--color-primary-600)] border border-[var(--color-primary-600)]/20 px-2 py-0.5 rounded-full"
                        >
                          {fac}
                        </span>
                      ))}
                      {clinic.facilities.length > 3 && (
                        <span className="text-[9px] text-[var(--color-text-muted)] px-1">+{clinic.facilities.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex flex-col gap-1.5 text-[11px] text-[var(--color-text-secondary)] mt-auto border-t border-[var(--color-border)]/60 pt-3">
                    {clinic.address && (
                      <div className="flex items-center gap-1.5 truncate">
                        <svg className="w-3 h-3 text-[var(--color-text-muted)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">{clinic.address}</span>
                      </div>
                    )}
                    {clinic.timings && formatTimings(clinic.timings) && (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3 h-3 text-[var(--color-text-muted)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{formatTimings(clinic.timings)}</span>
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-semibold text-[var(--color-primary-600)] flex items-center gap-1 group-hover:gap-2 transition-all duration-200">
                      View Specialists
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-surface-alt)] px-2 py-0.5 rounded-full border border-[var(--color-border)]/50">
                      Book Now
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
