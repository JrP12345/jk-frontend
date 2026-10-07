import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PrintButton from "@/components/ui/PrintButton";
import { ToastProvider } from "@/components/ui/Toast";
import ThermalTokenSlipModal from "@/components/clinical/ThermalTokenSlipModal";
import { UnifiedDocumentModal, type UnifiedDocumentData } from "@/components/clinical/UnifiedDocumentModal";
import { getPrintErrorMessage, printElement, printHtml, printWhenReady, PrintPreparationError } from "@/lib/printBrand";
import { forceResetScrollLock } from "@/lib/scrollLock";
import QRCode from "qrcode";

vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn() } }));
beforeEach(() => {
  vi.mocked(QRCode.toDataURL).mockReset();
  vi.mocked(QRCode.toDataURL).mockResolvedValue("data:image/png;base64,qr");
});
afterEach(() => {
  document.querySelectorAll('[data-print-frame], [data-print-test]').forEach(element => element.remove());
  vi.useRealTimers(); vi.restoreAllMocks(); forceResetScrollLock();
});

function captureFrame() {
  const frame = document.querySelector<HTMLIFrameElement>("iframe[data-print-frame]")!;
  expect(frame).not.toBeNull();
  const print = vi.spyOn(frame.contentWindow!, "print").mockImplementation(() => {});
  vi.spyOn(frame.contentWindow!, "focus").mockImplementation(() => {});
  return { frame, print };
}

describe("Shared print action", () => {
  it("prevents repeated printing, retains the original label during preparation, and only loads the initiating action", async () => {
    let finish!: () => void;
    const prepare = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    render(<ToastProvider><PrintButton documentName="invoice" onPrint={prepare} /><button>Other action</button></ToastProvider>);
    const button = screen.getByRole("button", { name: "Print invoice" });
    fireEvent.click(button); fireEvent.click(button);
    expect(prepare).toHaveBeenCalledOnce();
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector('[aria-hidden="true"].invisible')).toHaveTextContent("Print invoice");
    expect(within(button).getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Other action" })).toBeEnabled();
    await act(async () => finish());
    expect(button).toBeEnabled();
    expect(within(button).queryByRole("status")).not.toBeInTheDocument();
  });
  it("opens existing previews without a fake asynchronous loader", () => {
    const preview = vi.fn();
    render(<ToastProvider><PrintButton documentName="report" preview onPrint={preview} /></ToastProvider>);
    const button = screen.getByRole("button", { name: "Preview report" });
    fireEvent.click(button);
    expect(preview).toHaveBeenCalledOnce();
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute("aria-busy");
  });
  it("reports preparation failures locally, hides internal errors, and allows retry", async () => {
    const prepare = vi.fn().mockRejectedValue(new Error("organization context required"));
    render(<ToastProvider><PrintButton documentName="receipt" onPrint={prepare} /></ToastProvider>);
    const button = screen.getByRole("button", { name: "Print receipt" });
    fireEvent.click(button);
    await screen.findByText("Could not prepare receipt", { selector: "p" });
    expect(screen.getByText("The print dialog could not be opened. Please try again.", { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByText(/organization context required/)).not.toBeInTheDocument();
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(prepare).toHaveBeenCalledTimes(2));
  });
  it("does not print data that is unavailable", () => {
    const prepare = vi.fn();
    render(<ToastProvider><PrintButton documentName="poster" disabled onPrint={prepare} /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Print poster" }));
    expect(prepare).not.toHaveBeenCalled();
  });
});

describe("Shared document lifecycle", () => {
  it('blocks active nested documents and executable links while preserving receipt content', async () => {
    const pending = printHtml('<html><body><p>Receipt</p><iframe srcdoc="<script>parent.alert(1)</script>"></iframe><object data="javascript:alert(1)"></object><a href="javascript:alert(1)">Link</a></body></html>');
    const { frame, print } = captureFrame();
    expect(frame.getAttribute('sandbox')).toBe('allow-same-origin allow-modals');
    expect(frame.contentDocument!.querySelector('iframe, object, [srcdoc], [href]')).toBeNull();
    frame.dispatchEvent(new Event('load'));
    await pending;
    expect(print).toHaveBeenCalledOnce();
    expect(frame.contentDocument!.body.textContent).toContain('Receipt');
    frame.contentWindow!.dispatchEvent(new Event('afterprint'));
  });
  it("prints HTML once without popups or legacy scripts and restores focus after printing", async () => {
    render(<button>Return here</button>);
    screen.getByRole("button", { name: "Return here" }).focus();
    const open = vi.spyOn(window, "open");
    const pending = printHtml('<html><head><title>Receipt</title></head><body><p onclick="window.print()">Receipt #7</p><script>window.print()</script></body></html>');
    const { frame, print } = captureFrame();
    frame.dispatchEvent(new Event("load"));
    await pending;
    expect(print).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
    expect(frame.contentDocument!.body.textContent).toBe("Receipt #7");
    expect(frame.contentDocument!.querySelector("script, [onclick]")).toBeNull();
    expect(frame.contentDocument!.head.textContent).toContain("size: A4");
    frame.contentWindow!.dispatchEvent(new Event("afterprint"));
    expect(frame.isConnected).toBe(false);
    expect(screen.getByRole("button", { name: "Return here" })).toHaveFocus();
  });
  it("does not print a document whose image preparation failed", async () => {
    const doc = document.implementation.createHTMLDocument("Prescription");
    const image = doc.createElement("img"); doc.body.appendChild(image);
    image.decode = vi.fn().mockRejectedValue(new Error("failed image"));
    const print = vi.fn();
    await expect(printWhenReady({ document: doc, print, focus: vi.fn() } as unknown as Window)).rejects.toMatchObject({ reason: "assets" });
    expect(print).not.toHaveBeenCalled();
  });
  it("releases a frame when required styles fail to load", async () => {
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = "/missing-print.css"; link.dataset.printTest = "true";
    document.head.appendChild(link);
    const pending = printElement(document.createElement("div"));
    const { frame, print } = captureFrame();
    const rejected = expect(pending).rejects.toMatchObject({ reason: "assets" });
    frame.contentDocument!.querySelector("link")!.dispatchEvent(new Event("error"));
    await rejected;
    expect(frame.isConnected).toBe(false);
    expect(print).not.toHaveBeenCalled();
  });
  it("times out stalled preparation so the initiating button can recover", async () => {
    vi.useFakeTimers();
    const doc = document.implementation.createHTMLDocument("Prescription");
    Object.defineProperty(doc, "fonts", { value: { ready: new Promise(() => {}) } });
    const print = vi.fn();
    const rejected = expect(printWhenReady({ document: doc, print, focus: vi.fn() } as unknown as Window)).rejects.toMatchObject({ reason: "assets" });
    await vi.advanceTimersByTimeAsync(15_000);
    await rejected;
    expect(print).not.toHaveBeenCalled();
  });
  it("handles missing documents and unavailable native printing explicitly", async () => {
    await expect(printElement(null)).rejects.toMatchObject({ reason: "not-ready" });
    await expect(printHtml("")).rejects.toMatchObject({ reason: "not-ready" });
    await expect(printWhenReady({ print: undefined } as unknown as Window)).rejects.toMatchObject({ reason: "unavailable" });
    expect(getPrintErrorMessage(new PrintPreparationError("unavailable"))).toContain("device’s browser");
    expect(getPrintErrorMessage({ response: { status: 403, data: "internal capability" } })).toContain("access");
  });
});

describe("Existing paper and template choices", () => {
  const token = { appointmentId: "appointment", tokenNumber: 7, locationName: "Clinic", doctorName: "Doctor", patientName: "Patient" };
  it("waits for the tracking code and prints the selected thermal width", async () => {
    let qrReady!: (value: string) => void;
    vi.mocked(QRCode.toDataURL).mockImplementation(() => new Promise(resolve => { qrReady = resolve; }) as never);
    render(<ToastProvider><ThermalTokenSlipModal open tokenData={token} onClose={vi.fn()} /></ToastProvider>);
    expect(screen.getByRole("button", { name: "Print token slip" })).toBeDisabled();
    await act(async () => qrReady("data:image/png;base64,qr"));
    fireEvent.click(screen.getByRole("button", { name: "58mm (Compact)" }));
    expect(screen.getByRole("button", { name: "58mm (Compact)" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Print token slip" }));
    const { frame, print } = captureFrame();
    await waitFor(() => expect(print).toHaveBeenCalledOnce());
    expect(frame.contentDocument!.head.textContent).toContain("58mm auto");
    frame.contentWindow!.dispatchEvent(new Event("afterprint"));
  });
  it("offers retry after a tracking code fails and keeps printing disabled until it recovers", async () => {
    vi.mocked(QRCode.toDataURL).mockRejectedValueOnce(new Error("network"));
    render(<ToastProvider><ThermalTokenSlipModal open tokenData={token} onClose={vi.fn()} /></ToastProvider>);
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Print token slip" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Print token slip" })).toBeEnabled());
  });
  it("retains the existing preprinted letterhead offset and pins actions outside the preview", async () => {
    const document: UnifiedDocumentData = { documentType: "prescription", title: "Prescription", locationName: "Clinic", patientName: "Patient", date: "2026-09-28", prescriptions: [] };
    render(<ToastProvider><UnifiedDocumentModal open document={document} onClose={vi.fn()} /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Preprinted letterhead" }));
    const button = screen.getByRole("button", { name: "Print prescription" });
    expect(button.closest('.overflow-y-auto')).toBeNull();
    fireEvent.click(button);
    const { frame, print } = captureFrame();
    frame.dispatchEvent(new Event("load"));
    await waitFor(() => expect(print).toHaveBeenCalledOnce());
    expect(frame.contentDocument!.head.textContent).toContain("65mm 15mm 20mm 15mm");
    frame.contentWindow!.dispatchEvent(new Event("afterprint"));
  });
});
