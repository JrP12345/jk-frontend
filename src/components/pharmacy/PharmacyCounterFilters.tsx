"use client";

import { Button, Dropdown } from "@/components/ui";
import { SlidersHorizontal } from "lucide-react";
import styles from "./PharmacyCounter.module.css";

const types = [{ id: "tablet", label: "Tablets" }, { id: "capsule", label: "Capsules" }, { id: "ml", label: "Liquids" }, { id: "other", label: "Other" }];
export function matchesCounterType(unit: string, filters: string[]) {
  const selected = filters.filter(value => value !== "frequent");
  return !selected.length || selected.includes(["tablet", "capsule", "ml"].includes(unit) ? unit : "other");
}
export function PharmacyCounterFilters({ value, onChange, disabled, frequent = true }: { value: string[]; onChange: (value: string[]) => void; disabled?: boolean; frequent?: boolean }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(item => item !== id) : [...value, id]);
  const options = [...(frequent ? [{ id: "frequent", label: "Frequent only" }] : []), ...types];
  return <div className={styles.filters} role="group" aria-label="Filter product results by unit">
    <Dropdown align="right" width="w-48" trigger={<Button type="button" variant="outline" disabled={disabled} aria-label="Product filters" title={value.length ? value.length + " active filters" : "Filter products"} data-active={Boolean(value.length) || undefined} className={styles.filterTrigger}><SlidersHorizontal size={17} aria-hidden="true" />{value.length > 0 && <span className={styles.filterCount} aria-hidden="true">{value.length}</span>}</Button>} items={[
      ...options.map(type => ({ label: type.label, active: value.includes(type.id), checked: value.includes(type.id), keepOpen: true, onClick: () => toggle(type.id) })),
      { label: "", divider: true },
      { label: "Clear filters", disabled: !value.length, onClick: () => onChange([]) },
    ]} />
  </div>;
}
