"use client";

import { Button, CardTitle, Checkbox, Select } from "@/components/ui";
import type { LocationFilters } from "./BrowseClient";
import styles from "./browse.module.css";

export interface BrowseFilterValues { city: string; specialties: string[]; openNow: boolean; open24Hours: boolean }
export default function BrowseFilters({ values, filters, showCity = false, onChange, onClear, hasArea, onClearArea }: {
  values: BrowseFilterValues; filters: LocationFilters; showCity?: boolean;
  onChange: (values: BrowseFilterValues) => void; onClear: () => void; hasArea: boolean; onClearArea: () => void;
}) {
  return <div className={styles.filterContent}>
    <div className={styles.filterHeading}><CardTitle as="h2">Filters</CardTitle><Button variant="ghost" size="sm" onClick={onClear}>Clear all</Button></div>
    {showCity && <Select label="City" value={values.city} onChange={event => onChange({ ...values, city: event.target.value })} options={[{ value: "", label: "All cities" }, ...filters.cities.map(value => ({ value, label: value }))]} />}
    <fieldset className={styles.filterGroup}><legend>Specialty</legend>
      {filters.specialties.length ? filters.specialties.map(specialty => <div className={styles.filterChoice} key={specialty}>
        <Checkbox label={specialty} checked={values.specialties.includes(specialty)} onChange={() => onChange({ ...values, specialties: values.specialties.includes(specialty) ? values.specialties.filter(value => value !== specialty) : [...values.specialties, specialty] })} />
        {typeof filters.specialtyCounts?.[specialty] === "number" && <span title="Facilities in the public directory">{filters.specialtyCounts[specialty]}</span>}
      </div>) : <p className={styles.filterNote}>Specialties will appear as facilities list their doctors.</p>}
    </fieldset>
    <fieldset className={styles.filterGroup}><legend>Opening hours</legend>
      <Checkbox label="Open now" checked={values.openNow} onChange={event => onChange({ ...values, openNow: event.target.checked })} />
      <Checkbox label="Open 24 hours" checked={values.open24Hours} onChange={event => onChange({ ...values, open24Hours: event.target.checked })} />
    </fieldset>
    {hasArea && <Button variant="ghost" size="sm" onClick={onClearArea}>Clear map area</Button>}
    <p className={styles.filterNote}>Hours describe the facility. Appointment times are checked after you open it.</p>
  </div>;
}
