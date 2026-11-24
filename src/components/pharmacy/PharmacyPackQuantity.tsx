"use client";
import { Input } from "@/components/ui";
import { changePackLevel, packBreakdown, type PharmacyUnitDefinition } from "@/lib/pharmacyUnits";
export function PharmacyPackQuantity({ unit, value, label, ariaLabel, onChange, onError, disabled }: { unit: PharmacyUnitDefinition; value: string; label: string; ariaLabel?: string; onChange: (value: string) => void; onError: (message: string) => void; disabled?: boolean }) {
  if (!unit.outerPackUnit) return <Input label={label} aria-label={ariaLabel} type="number" min="0" step="1" disabled={disabled} value={value} onChange={event => onChange(event.target.value)} />;
  let split: { outer: string; inner: string };
  try { split = packBreakdown(unit, value); } catch { return <Input label={label} type="number" min="0" step="1" disabled={disabled} value={value} onChange={event => onChange(event.target.value)} />; }
  function change(level: "outer" | "inner", next: string) { try { onChange(changePackLevel(unit, value, level, next)); } catch (failure) { onError(failure instanceof Error ? failure.message : "Check the pack quantity."); } }
  return <div className="grid min-w-0 grid-cols-2 gap-3"><Input label={`${label} (${unit.outerPackUnit})`} type="number" min="0" step="1" disabled={disabled} value={split.outer} onChange={event => change("outer", event.target.value)} /><Input label={`${label} (${unit.packUnit})`} type="number" min="0" step="1" disabled={disabled} value={split.inner} onChange={event => change("inner", event.target.value)} /></div>;
}
