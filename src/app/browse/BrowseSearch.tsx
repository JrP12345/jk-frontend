"use client";

import { MapPin, Search } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import styles from "./browse.module.css";

export default function BrowseSearch({ search, city, cities, disabled, onSearch, onCity, onSubmit }: {
  search: string; city: string; cities: string[]; disabled: boolean; onSearch: (value: string) => void; onCity: (value: string) => void; onSubmit: () => void;
}) {
  return <form role="search" className={styles.search} onSubmit={event => { event.preventDefault(); onSubmit(); }}>
    <Input type="search" disabled={disabled} icon={<Search aria-hidden="true" className="h-4 w-4" />} placeholder="Search clinics, hospitals or doctors" value={search} onChange={event => onSearch(event.target.value)} onClear={() => onSearch("")} maxLength={160} aria-label="Search by doctor, location name, or specialty" containerClassName={styles.keyword} className="min-h-11!" />
    <div className={styles.city}><Select icon={<MapPin aria-hidden="true" className="h-4 w-4" />} value={city} disabled={disabled} onChange={event => onCity(event.target.value)} options={[{ value: "", label: "All cities" }, ...cities.map(value => ({ value, label: value }))]} aria-label="Filter by location" className="min-h-11!" /></div>
    <Button type="submit" aria-label="Search" disabled={disabled} className={styles.searchButton + " min-h-11!"}><Search aria-hidden="true" /><span className={styles.searchLabel}>Search</span></Button>
  </form>;
}
