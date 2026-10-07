import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import QRCode from "qrcode";
import UpiPaymentModal from "@/components/billing/UpiPaymentModal";
import { ToastProvider } from "@/components/ui/Toast";

vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,fixture") } }));
beforeEach(() => vi.clearAllMocks());
const mount = (upiVpa?: string) => render(<ToastProvider><UpiPaymentModal open onClose={vi.fn()} invoiceId="invoice" patientName="Patient" amount={250} upiVpa={upiVpa} /></ToastProvider>);

it("never routes missing location UPI configuration to a fixed merchant", () => {
  mount();
  expect(QRCode.toDataURL).not.toHaveBeenCalled();
  expect(screen.queryByRole("link", { name: /Pay via UPI App/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Verified Patient UPI Transfer/ })).toBeDisabled();
  expect(screen.getByRole("button", { name: /Received Cash at Counter/ })).toBeEnabled();
});

it("uses only the configured location merchant for QR and app payment", async () => {
  mount("reception@bank");
  await waitFor(() => expect(QRCode.toDataURL).toHaveBeenCalledWith(expect.stringContaining("pa=reception%40bank"), expect.anything()));
  expect(screen.getByRole("link", { name: /Pay via UPI App/ })).toHaveAttribute("href", expect.stringContaining("pa=reception%40bank"));
});
