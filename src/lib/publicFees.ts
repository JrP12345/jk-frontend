import { formatCurrency } from "./currency";

/** Use the same saved consultation-fee meaning across discovery and booking. */
export function publicConsultationFee({ fees, feeType }: { fees: number; feeType?: "fixed" | "free" | "post_consultation" }, currency = "INR"): string {
  if (feeType === "free") return "Free";
  const amount = Number.isFinite(fees) && fees > 0 ? formatCurrency(fees, currency) : null;
  if (feeType === "post_consultation") return amount ? `From ${amount}` : "Set after consultation";
  return amount || "Ask reception for fee";
}
