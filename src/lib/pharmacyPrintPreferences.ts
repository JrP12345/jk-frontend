/** Device-local paper preference only. It contains no bill, customer or printer credentials. */
export const PHARMACY_PAPER_OPTIONS = [
  { value: "A4", label: "A4" },
  { value: "80mm", label: "80 mm receipt roll" },
  { value: "58mm", label: "58 mm receipt roll" },
] as const;
export type PharmacyPaper = typeof PHARMACY_PAPER_OPTIONS[number]["value"];
export function isPharmacyPaper(value: unknown): value is PharmacyPaper { return PHARMACY_PAPER_OPTIONS.some(option => option.value === value); }
const key = (locationId: string) => `ekavyu-pharmacy-paper:${encodeURIComponent(locationId)}`;
export function readPharmacyPaper(locationId: string): PharmacyPaper {
  try { const value = locationId ? localStorage.getItem(key(locationId)) : null; return isPharmacyPaper(value) ? value : "A4"; }
  catch { return "A4"; }
}
/** Storage denial must never block a financial Save or the current print attempt. */
export function rememberPharmacyPaper(locationId: string, paper: PharmacyPaper): boolean {
  if (!locationId || !isPharmacyPaper(paper)) return false;
  try { localStorage.setItem(key(locationId), paper); return true; } catch { return false; }
}
