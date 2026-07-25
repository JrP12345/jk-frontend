"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import Select from "./Select";

interface Clinic {
  id: string;
  name: string;
  city: string;
}

interface WorkspaceClinicFilterProps {
  selectedClinicId: string;
  onClinicChange: (clinicId: string) => void;
  className?: string;
}

export default function WorkspaceClinicFilter({
  selectedClinicId,
  onClinicChange,
  className = "",
}: WorkspaceClinicFilterProps) {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchClinics();
  }, [user?.organization_id]);

  const fetchClinics = async () => {
    try {
      setLoading(true);
      const res = await api.get("/onboarding/clinics");
      setClinics(res.data.data || []);
    } catch {
      // Ignore fallback
    } finally {
      setLoading(false);
    }
  };

  if (user?.role === "patient") return null;

  const selectOptions = [
    { value: "", label: `🏢 All Clinic Branches (${clinics.length})` },
    ...clinics.map((c) => ({
      value: c.id,
      label: `📍 ${c.name} (${c.city})`,
    })),
  ];

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 bg-surface p-3.5 px-5 rounded-2xl border border-border shadow-2xs ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-base">📍</span>
        <div>
          <p className="text-xs font-bold text-text leading-tight">Facility Branch Context</p>
          <p className="text-[11px] text-text-muted leading-tight">Filter records by clinic location</p>
        </div>
      </div>

      <div className="w-full sm:w-64">
        <Select
          size="sm"
          options={selectOptions}
          value={selectedClinicId}
          onChange={(e) => onClinicChange(e.target.value)}
          disabled={loading}
          fullWidth
        />
      </div>
    </div>
  );
}
