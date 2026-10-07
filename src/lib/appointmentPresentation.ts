/** Payment choice and gateway order creation are not evidence of settlement. */
export function appointmentPaymentLabel(paymentStatus?: string): string {
  switch (paymentStatus) {
    case "paid": return "Paid";
    case "not_required": return "No prepayment required";
    case "pay_at_location": return "Payment due at reception";
    default: return "Payment pending";
  }
}

export function appointmentBookingLabel(status?: string): string {
  if (status === "pending_payment") return "Booking awaiting payment";
  if (status === "pending") return "Booking pending confirmation";
  if (status === "confirmed") return "Appointment confirmed";
  return "Appointment recorded";
}
