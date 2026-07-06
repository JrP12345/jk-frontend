"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Card, Spinner, Input, Select, Button } from "@/components/ui";
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

export default function BrowseClient() {
  const formatTimings = (timingsStr: string | null | undefined): string => {
    if (!timingsStr) return "Not specified";
    try {
      const data = JSON.parse(timingsStr);
      const days = Object.keys(data);
      if (days.length === 0) return timingsStr;
      
      for (const day of days) {
        if (data[day] && data[day].length > 0) {
          const firstSlot = data[day][0];
          return `Open ${firstSlot.start} - ${firstSlot.end} ${days.length > 1 ? `(${days.length} days/week)` : ''}`;
        }
      }
      return "Not specified";
    } catch (e) {
      return timingsStr;
    }
  };

  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search and filter states
  const [search, setSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  
  const router = useRouter();

  const specialties = [
    { id: "", label: "All Specialties" },
    { id: "Pediatrics", label: "Pediatrics" },
    { id: "General Medicine", label: "General Medicine" },
    { id: "Cardiology", label: "Cardiology" },
    { id: "Dentistry", label: "Dentistry" }
  ];

  const cities = [
    { value: "", label: "All Cities" },
    { value: "Pune", label: "Pune" },
    { value: "Surat", label: "Surat" }
  ];

  const fetchClinics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (selectedCity) params.append("city", selectedCity);
      if (selectedSpecialty) params.append("specialization", selectedSpecialty);
      
      const queryString = params.toString() ? `?${params.toString()}` : "";
      const res = await api.get(`/public/clinics${queryString}`);
      setClinics(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch clinics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClinics();
  }, [search, selectedCity, selectedSpecialty]);

  return (
    <div className="min-h-screen bg-surface-alt pt-16 pb-20">
      <MarketplaceNavbar />
      
      {/* Cohesive Portal Header */}
      <div className="max-w-6xl mx-auto px-6 mt-8 mb-6">
        <h1 className="text-3xl font-bold text-text tracking-tight">Find Your Medical Care</h1>
        <p className="text-text-secondary text-sm mt-1">Discover verified healthcare clinics, select specialists, and schedule appointments instantly.</p>
      </div>

      {/* Advanced Filters Panel */}
      <div className="max-w-6xl mx-auto px-6 relative z-20">
        <div className="bg-surface rounded-2xl border border-border shadow-md p-5 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          
          {/* Clinic Name Search */}
          <div className="md:col-span-7">
            <Input 
              label="Clinic Name or Specialty"
              type="text" 
              placeholder="Search by clinic name, address, keywords..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={
                <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
          </div>

          {/* City Selection */}
          <div className="md:col-span-5">
            <Select 
              label="Select Location City"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              options={cities}
            />
          </div>

        </div>

        {/* Specialty Quick Chips */}
        <div className="flex flex-wrap items-center gap-2 mt-6">
          <span className="text-xs font-bold text-text-secondary uppercase tracking-wider mr-2">Specialties:</span>
          {specialties.map((spec) => (
            <button
              key={spec.id}
              onClick={() => setSelectedSpecialty(spec.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer ${
                selectedSpecialty === spec.id
                  ? "bg-primary-600 text-white border-primary-600 shadow-sm"
                  : "bg-surface text-text-secondary border-border hover:bg-surface-hover hover:border-text-muted"
              }`}
            >
              {spec.label === "All Specialties" ? "All" : spec.label}
            </button>
          ))}
        </div>

        {/* Results Grid */}
        <div className="mt-10 space-y-6">
          <div className="flex justify-between items-center border-b border-border pb-4">
            <h2 className="text-xl font-bold text-text">
              {loading ? "Searching clinics..." : `${clinics.length} Clinic Locations Available`}
            </h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : clinics.length === 0 ? (
            <div className="text-center py-20 text-text-muted text-base bg-surface rounded-2xl border border-border">
              <svg className="w-12 h-12 mx-auto text-text-muted opacity-50 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              No clinics found matching your search filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clinics.map((clinic) => (
                <Card 
                  key={clinic.id} 
                  className="overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 hover:border-primary-500/50 cursor-pointer group flex flex-col"
                  onClick={() => router.push(`/browse/${clinic.id}`)}
                >
                  {/* Banner Image Thumbnail */}
                  <div className="h-44 bg-surface-hover w-full relative overflow-hidden flex-shrink-0">
                    {clinic.image_url ? (
                      <img src={clinic.image_url} alt={clinic.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-100 to-indigo-100 dark:from-primary-950 dark:to-indigo-950 text-primary-500 dark:text-primary-400">
                        <svg className="w-16 h-16 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                      </div>
                    )}
                    <div className="absolute top-4 left-4 flex gap-1.5">
                      <span className="bg-white/95 dark:bg-surface/95 backdrop-blur-sm text-primary-800 dark:text-primary-300 text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                        {clinic.city}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col space-y-4">
                    <div>
                      <div className="flex items-center gap-1 text-xs text-warning-500 font-bold">
                        <span>★</span>
                        <span>4.9</span>
                        <span className="text-text-muted font-normal">(48 reviews)</span>
                      </div>
                      <h3 className="text-lg font-bold text-text group-hover:text-primary-600 transition-colors line-clamp-1 mt-1">
                        {clinic.name}
                      </h3>
                      <p className="text-xs text-text-secondary line-clamp-2 mt-1.5 h-8">
                        {clinic.description || "A premier HealthOS clinic offering comprehensive medical services and specialized practitioner care."}
                      </p>
                    </div>
                    
                    {/* Facilities Badges */}
                    {clinic.facilities && clinic.facilities.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {clinic.facilities.slice(0, 3).map((fac, idx) => (
                          <span key={idx} className="bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-400 text-[10px] px-2 py-0.5 rounded-full font-semibold border border-primary-100 dark:border-primary-900/30">
                            {fac}
                          </span>
                        ))}
                        {clinic.facilities.length > 3 && (
                          <span className="text-[10px] text-text-muted px-1.5 py-0.5">+ {clinic.facilities.length - 3} more</span>
                        )}
                      </div>
                    )}

                    {/* Meta Fields */}
                    <div className="space-y-2 text-xs text-text-secondary border-t border-border/60 pt-4 flex-1 flex flex-col justify-end">
                      <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span className="truncate">{clinic.address || clinic.city}</span>
                      </div>
                      {clinic.timings && (
                        <div className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span>{formatTimings(clinic.timings)}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs font-semibold text-primary-600 group-hover:text-primary-700">
                      <span>View Doctor Practitioners</span>
                      <span>&rarr;</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
