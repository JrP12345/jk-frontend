import { expect, it } from "vitest";
import { publicConsultationFee } from "@/lib/publicFees";

it.each([
  [{ fees: 500, feeType: "free" }, "Free"],
  [{ fees: 500, feeType: "fixed" }, "₹500"],
  [{ fees: 500.5, feeType: "fixed" }, "₹500.50"],
  [{ fees: 500, feeType: "post_consultation" }, "From ₹500"],
  [{ fees: 0, feeType: "post_consultation" }, "Set after consultation"],
  [{ fees: Infinity, feeType: "post_consultation" }, "Set after consultation"],
  [{ fees: NaN, feeType: "post_consultation" }, "Set after consultation"],
  [{ fees: 0, feeType: "fixed" }, "Ask reception for fee"],
  [{ fees: -50 }, "Ask reception for fee"],
  [{ fees: Infinity }, "Ask reception for fee"],
] as const)("presents the supplied fee without rounding or inventing a charge: %j", (fee, label) => {
  expect(publicConsultationFee(fee, "INR")).toBe(label);
});
