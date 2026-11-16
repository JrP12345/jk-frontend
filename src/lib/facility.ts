/** Facility classification and selection for physical healthcare Locations. */
export const facilityTypeOptions = [
  { value: "clinic", label: "Clinic" },
  { value: "hospital", label: "Hospital" },
  { value: "diagnostic_center", label: "Diagnostic center" },
  { value: "medical_center", label: "Medical center" },
  { value: "specialty_center", label: "Specialty center" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "other", label: "Other healthcare facility" },
] as const;

export type FacilityType = typeof facilityTypeOptions[number]["value"];

export function facilityTypeLabel(value: unknown): string {
  return facilityTypeOptions.find(option => option.value === value)?.label || "Healthcare facility";
}

/** A pharmacy or diagnostic branch can be a complete profile without a doctor. */
export function facilityHasDoctorSection(location: { facilityType?: FacilityType | null; doctors?: readonly unknown[]; doctorCount?: number }) {
  return Boolean(location.doctors?.length || (location.doctorCount || 0) > 0) || !["pharmacy", "diagnostic_center", "other"].includes(location.facilityType || "");
}

/** Reports may use all locations; physical actions still use validSingleChoice. */
export function resolveLocationSelection(locations: readonly { id: string }[], selected: string | null): string | null {
  if (locations.length === 1) return locations[0].id;
  if (locations.length === 0) return null;
  return selected === "all" || locations.some(location => location.id === selected) ? selected : null;
}
