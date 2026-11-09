"use client";

import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { Button, CardTitle, Checkbox, Input, Select, cn } from "@/components/ui";
import { facilityTypeOptions } from "@/lib/facility";
import { fieldLabel } from "@/components/ui/controlStyles";
import type { LocationFilters } from "./BrowseClient";
import styles from "./browse.module.css";

export interface BrowseFilterValues {
  city: string; specialties: string[]; openNow: boolean; open24Hours: boolean;
  facilityTypes?: string[]; onlineBooking?: boolean; radiusKm?: number;
}
export default function BrowseFilters({ values, filters, showCity = false, onChange, onClear, hasArea, onClearArea, hasOrigin = false, onLocate }: {
  values: BrowseFilterValues; filters: LocationFilters; showCity?: boolean;
  onChange: (values: BrowseFilterValues) => void; onClear: () => void; hasArea: boolean; onClearArea: () => void;
  hasOrigin?: boolean; onLocate?: () => void;
}) {
  const radiusId = useId();
  const types = values.facilityTypes || [];
  const typeOptions = facilityTypeOptions.filter((option, index) => index < 3 || types.includes(option.value) || (filters.facilityTypeCounts?.[option.value] || 0) > 0);
  return <div className={cn(styles.filterContent, showCity ? "p-0" : "p-4 sm:p-5")}>
    {!showCity && <div className={styles.filterHeading}><CardTitle as="h2">Filters</CardTitle><Button variant="ghost" size="sm" onClick={onClear}>Clear all</Button></div>}
    {showCity && <Select label="City" value={values.city} onChange={event => onChange({ ...values, city: event.target.value })} options={[{ value: "", label: "All cities" }, ...filters.cities.map(value => ({ value, label: value }))]} />}
    <details className={styles.filterGroup} open><summary className={fieldLabel}>Facility type<ChevronDown aria-hidden="true" /></summary>
      {typeOptions.map(option => <div className={styles.filterChoice} key={option.value}>
        <Checkbox label={option.label} checked={types.includes(option.value)} disabled={Boolean(filters.facilityTypeCounts && !filters.facilityTypeCounts[option.value] && !types.includes(option.value))} onChange={() => onChange({ ...values, facilityTypes: types.includes(option.value) ? types.filter(type => type !== option.value) : [...types, option.value] })} />
        {filters.facilityTypeCounts && <span title="Published facilities of this type">{filters.facilityTypeCounts[option.value] || 0}</span>}
      </div>)}
    </details>
    <details className={styles.filterGroup} open><summary className={fieldLabel}>Specialty<ChevronDown aria-hidden="true" /></summary>
      {filters.specialties.length ? filters.specialties.map(specialty => <div className={styles.filterChoice} key={specialty}>
        <Checkbox label={specialty} checked={values.specialties.includes(specialty)} onChange={() => onChange({ ...values, specialties: values.specialties.includes(specialty) ? values.specialties.filter(value => value !== specialty) : [...values.specialties, specialty] })} />
        {typeof filters.specialtyCounts?.[specialty] === "number" && <span title="Facilities in the public directory">{filters.specialtyCounts[specialty]}</span>}
      </div>) : <p className={cn(styles.filterNote, "text-xs leading-relaxed text-text-secondary")}>Specialties appear when facilities list their doctors.</p>}
    </details>
    <details className={styles.filterGroup} open><summary className={fieldLabel}>Booking options<ChevronDown aria-hidden="true" /></summary>
      <Checkbox label="Online booking" checked={Boolean(values.onlineBooking)} onChange={event => onChange({ ...values, onlineBooking: event.target.checked })} />
    </details>
    <details className={styles.filterGroup} open><summary className={fieldLabel}>Opening hours<ChevronDown aria-hidden="true" /></summary>
      <Checkbox label="Open now" checked={values.openNow} onChange={event => onChange({ ...values, openNow: event.target.checked })} />
      <Checkbox label="Open 24 hours" checked={values.open24Hours} onChange={event => onChange({ ...values, open24Hours: event.target.checked })} />
    </details>
    <details className={styles.filterGroup} open><summary className={fieldLabel}>Distance<ChevronDown aria-hidden="true" /></summary>
      <div className={styles.radiusLabel}><label htmlFor={radiusId}>Within</label><output htmlFor={radiusId}>{values.radiusKm ? values.radiusKm + " km" : "Any distance"}</output></div>
      <Input id={radiusId} type="range" variant="flush" min={0} max={50} step={1} value={values.radiusKm || 0} disabled={!hasOrigin} aria-label="Distance in kilometres" aria-valuetext={values.radiusKm ? "Within " + values.radiusKm + " kilometres" : "Any distance"} onChange={event => onChange({ ...values, radiusKm: Number(event.target.value) })} className="min-h-11! px-0! accent-accent" />
      <div className={styles.radiusScale}><span>Any</span><span>25 km</span><span>50 km</span></div>
      {!hasOrigin && <><p className={cn(styles.filterNote, "text-xs leading-relaxed text-text-secondary")}>Choose your location to filter by distance.</p><Button variant="ghost" size="sm" onClick={onLocate}>Use my location</Button></>}
    </details>
    {hasArea && <Button variant="ghost" size="sm" onClick={onClearArea}>Clear map area</Button>}
    <p className={cn(styles.filterNote, "text-xs leading-relaxed text-text-secondary")}>Hours describe the facility. Appointment times are checked after you open it.</p>
  </div>;
}
