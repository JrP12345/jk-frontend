import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PharmacyPackQuantity } from "@/components/pharmacy/PharmacyPackQuantity";
import { changePackLevel, packBreakdown, packDescription, validatePharmacyUnits } from "@/lib/pharmacyUnits";
import { cleanCatalogueProduct } from "@/lib/pharmacyCatalogue";
const unit = { version: 2, baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10, outerPackUnit: "box", packsPerOuter: 10 };
it("converts explicit box/strip/tablet quantities exactly and preserves entered remainders", () => {
  expect(packBreakdown(unit, "13")).toEqual({ outer: "1", inner: "3" }); expect(changePackLevel(unit, "13", "outer", "2")).toBe("23"); expect(changePackLevel(unit, "23", "inner", "4")).toBe("24"); expect(packDescription(unit)).toBe("1 box = 10 strip; 1 strip = 10 tablet");
  expect(BigInt(changePackLevel(unit, "0", "outer", "1")) * BigInt(unit.unitsPerPack) - BigInt(3)).toBe(BigInt(97));
});
it("keeps box facts in the bounded catalogue rather than dropping them from cached products", () => {
  expect(cleanCatalogueProduct({ id: "product", name: "Tablets", genericName: "Synthetic", stockQuantity: 100, eligible: true, unitDefinition: unit }).unitDefinition).toEqual(unit);
});
it("renders separate outer and inner controls and does not accept fractional or excessive quantities", () => {
  const change = vi.fn(), error = vi.fn(); render(<PharmacyPackQuantity unit={unit} value="13" label="Billed packs" onChange={change} onError={error} />);
  expect(screen.getByLabelText("Billed packs (box)")).toHaveValue(1); expect(screen.getByLabelText("Billed packs (strip)")).toHaveValue(3);
  fireEvent.change(screen.getByLabelText("Billed packs (box)"), { target: { value: "2" } }); expect(change).toHaveBeenCalledWith("23"); fireEvent.change(screen.getByLabelText("Billed packs (box)"), { target: { value: "2.5" } }); expect(error).toHaveBeenCalledOnce();
  expect(() => changePackLevel(unit, "13", "outer", String(Number.MAX_SAFE_INTEGER))).toThrow(/precision/);
});
it.each([{ outerPackUnit: "box" }, { packsPerOuter: 10 }, { outerPackUnit: "strip", packsPerOuter: 10 }, { outerPackUnit: "box", packsPerOuter: 1 }, { outerPackUnit: "box", packsPerOuter: 100001 }])("rejects unreviewed pack relationships %j", value => { expect(() => validatePharmacyUnits({ version: 1, baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10, ...value })).toThrow(); });
