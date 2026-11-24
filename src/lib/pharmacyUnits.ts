export interface PharmacyUnitDefinition { version: number; baseUnit: string; packUnit: string; unitsPerPack: number; outerPackUnit?: string; packsPerOuter?: number }
const packs = ["strip", "box", "bottle", "vial", "tube", "ampoule", "sachet", "pack", "piece"];
export function validatePharmacyUnits(unit: PharmacyUnitDefinition): PharmacyUnitDefinition {
  if (!unit || !Number.isSafeInteger(unit.version) || unit.version < 1 || !["tablet", "capsule", "ml", "g", "piece", "dose"].includes(unit.baseUnit) || !packs.includes(unit.packUnit) || !Number.isSafeInteger(unit.unitsPerPack) || unit.unitsPerPack < 1 || unit.unitsPerPack > 1000000) throw Error("Recorded product units need review.");
  const outer = unit.outerPackUnit !== undefined || unit.packsPerOuter !== undefined;
  if (outer && (!packs.includes(unit.outerPackUnit || "") || unit.outerPackUnit === unit.packUnit || unit.outerPackUnit === unit.baseUnit || !Number.isSafeInteger(unit.packsPerOuter) || unit.packsPerOuter! < 2 || unit.packsPerOuter! * unit.unitsPerPack > 1000000)) throw Error("Record the exact outer-pack conversion before using boxes.");
  return { version: unit.version, baseUnit: unit.baseUnit, packUnit: unit.packUnit, unitsPerPack: unit.unitsPerPack, ...(outer ? { outerPackUnit: unit.outerPackUnit!, packsPerOuter: unit.packsPerOuter! } : {}) };
}
export function packBreakdown(unit: PharmacyUnitDefinition, value: string) {
  validatePharmacyUnits(unit);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw Error("Enter safe whole pack quantities.");
  const factor = BigInt(unit.packsPerOuter || 1), count = BigInt(value);
  return { outer: unit.packsPerOuter ? String(count / factor) : "0", inner: unit.packsPerOuter ? String(count % factor) : value };
}
export function changePackLevel(unit: PharmacyUnitDefinition, current: string, level: "outer" | "inner", value: string) {
  const split = packBreakdown(unit, current);
  if (!/^\d+$/.test(value || "0")) throw Error("Enter whole, non-negative pack quantities.");
  const count = BigInt(value || "0");
  if (level === "outer" && !unit.packsPerOuter) throw Error("Outer pack factor is not recorded.");
  const total = level === "outer" ? count * BigInt(unit.packsPerOuter!) + BigInt(split.inner) : BigInt(split.outer) * BigInt(unit.packsPerOuter || 1) + count;
  if (total > BigInt(Number.MAX_SAFE_INTEGER) || total * BigInt(unit.unitsPerPack) > BigInt(Number.MAX_SAFE_INTEGER)) throw Error("Pack quantity exceeds supported precision.");
  return String(total);
}
export function packDescription(unit: PharmacyUnitDefinition) {
  validatePharmacyUnits(unit);
  return `${unit.outerPackUnit ? `1 ${unit.outerPackUnit} = ${unit.packsPerOuter} ${unit.packUnit}; ` : ""}1 ${unit.packUnit} = ${unit.unitsPerPack} ${unit.baseUnit}`;
}
