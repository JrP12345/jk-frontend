import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRef } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { PharmacyCounter } from "@/components/pharmacy/PharmacyCounter";
import { PharmacyBarcodeStickersModal } from "@/components/pharmacy/PharmacyBarcodeStickersModal";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import {
  buildBarcodeStickersHtml,
  encodeCode128B,
  looksLikeExactBarcode,
  renderCode128Svg,
} from "@/lib/pharmacyBarcode";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import { datePickerInput } from "./datePickerTestUtils";

const printMock = vi.hoisted(() => ({ printHtml: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/printBrand", async original => ({
  ...await original<typeof import("@/lib/printBrand")>(),
  printHtml: printMock.printHtml,
}));
vi.mock("@/lib/pharmacyOfflineSession", () => ({ readOfflineSession: vi.fn(async () => null) }));
vi.mock("@/hooks/usePharmacyDraft", () => ({
  usePharmacyDraft: () => ({
    ready: true,
    error: "",
    status: "",
    flush: vi.fn(async () => {}),
  }),
}));

const counterProduct = {
  id: "507f1f77bcf86cd799439011",
  name: "Paracetamol",
  genericName: "Acetaminophen",
  strength: "500mg",
  barcodes: ["EKV12345678"],
  unitDefinition: { version: 1, baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10 },
  stockQuantity: 40,
  retailPricePaise: 500,
  eligible: true,
};

const sampleMedicine = {
  id: "507f1f77bcf86cd799439011",
  locationId: "loc-1",
  name: "Paracetamol",
  genericName: "Acetaminophen",
  strength: "500mg",
  stockQuantity: 40,
  price: 5,
  rackLocation: "A2",
  barcodes: [] as string[],
  unitDefinition: { version: 1, baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10 },
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({
    user: {
      id: "owner",
      role: "admin",
      name: "Pharmacy Admin",
      email: "owner@example.test",
      organization_id: "org-1",
      permissions: [
        "MANAGE_ORGANIZATION",
        "PHARMACY_VIEW_STOCK",
        "PHARMACY_MANAGE_CATALOG",
        "PHARMACY_RECEIVE_STOCK",
        "PHARMACY_VIEW_COST",
        "PHARMACY_SELL",
        "PHARMACY_COLLECT_PAYMENT",
      ],
    },
    isAuthenticated: true,
    isLoading: false,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe("Code 128 generation and sticker markup", () => {
  it("encodes valid Code 128B vectors and escapes dynamic label fields safely", () => {
    const encoded = encodeCode128B("EKV00012345");
    expect(encoded).not.toBeNull();
    // Start(11) + 11 chars(121) + checksum(11) + stop(13) = 156 modules
    expect(encoded!.totalModules).toBe(156);

    const svg = renderCode128Svg("EKV00012345");
    expect(svg).toContain("<svg");
    expect(svg).toContain("shape-rendering=\"crispEdges\"");
    expect(svg).toContain("EKV00012345");

    const html = buildBarcodeStickersHtml(
      [
        {
          code: "EKV00012345",
          name: "Test <Script> Item",
          strength: "100mg",
          pricePaise: 1500,
          mrpPaise: 1800,
          batchNumber: "B-1",
          expiry: "2028-10",
          copies: 2,
        },
      ],
      { preset: "thermal-50x25", storeName: "Ekavyu Pharmacy", showStoreName: true },
    );
    expect(html).toContain("50mm 25mm");
    expect(html).toContain("Test &lt;Script&gt; Item 100mg");
    expect(html).not.toContain("<Script>");
    expect((html.match(/<article class="sticker">/g) || [])).toHaveLength(2);
    expect(looksLikeExactBarcode("EKV00012345")).toBe(true);
    expect(looksLikeExactBarcode("Paracetamol")).toBe(false);
  });
});

function ScannerHarness({ onScan }: { onScan: (code: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  useBarcodeScanner({ enabled: true, inputRef, onScan });
  return (
    <div>
      <button type="button">Cart Area</button>
      <input ref={inputRef} aria-label="Scanner field" />
      <input aria-label="Quantity field" />
    </div>
  );
}

describe("Hardware USB/Bluetooth scanner listener", () => {
  it("captures rapid global scanner key bursts ending in Enter while leaving other inputs alone", () => {
    let nowMs = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => nowMs);
    const onScan = vi.fn();
    render(<ScannerHarness onScan={onScan} />);

    screen.getByRole("button", { name: "Cart Area" }).focus();
    for (const ch of "EKV987654") {
      nowMs += 15;
      fireEvent.keyDown(window, { key: ch });
    }
    nowMs += 15;
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onScan).toHaveBeenCalledExactlyOnceWith("EKV987654");

    // Slow typing inside Quantity field must not be hijacked as a scan.
    const qtyInput = screen.getByRole("textbox", { name: "Quantity field" });
    qtyInput.focus();
    for (const ch of "123456") {
      nowMs += 10;
      fireEvent.keyDown(qtyInput, { key: ch });
    }
    fireEvent.keyDown(qtyInput, { key: "Enter" });
    expect(onScan).toHaveBeenCalledTimes(1);
  });
});

describe("Counter quick manual product and Sticker print studio", () => {
  it("generates missing store barcodes and prints barcode sticker sheets", async () => {
    const postSpy = vi.spyOn(api, "post").mockResolvedValue({
      data: {
        data: {
          assigned: [{ id: sampleMedicine.id, name: sampleMedicine.name, barcodes: ["EKV88776655"] }],
          skippedCount: 0,
        },
      },
    } as never);
    const onAssigned = vi.fn();

    render(
      <ToastProvider>
        <PharmacyBarcodeStickersModal
          open
          locationId="loc-1"
          storeName="Central Pharmacy"
          medicines={[sampleMedicine]}
          initialSeeds={[{ medicineId: sampleMedicine.id, batchNumber: "LOT-9", expiry: "2028-12", copies: 3 }]}
          canManageCatalog
          onAssigned={onAssigned}
          onClose={vi.fn()}
        />
      </ToastProvider>,
    );

    const generateButton = screen.getByRole("button", { name: /Generate 1 missing/i });
    fireEvent.click(generateButton);
    await waitFor(() => expect(postSpy).toHaveBeenCalledWith("/pharmacy/barcodes/assign", { locationId: "loc-1", medicineIds: [sampleMedicine.id] }));
    expect(onAssigned).toHaveBeenCalled();

    const printButton = await screen.findByRole("button", { name: /Print stickers \(3\)/i });
    expect(printButton).toBeEnabled();
    fireEvent.click(printButton);
    await waitFor(() => expect(printMock.printHtml).toHaveBeenCalledTimes(1));
    expect(printMock.printHtml.mock.calls[0][0]).toContain("EKV88776655");
  });

  it("adds a quick manual product with unknown scanned barcode directly into Counter cart", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const getSpy = vi.spyOn(api, "get").mockImplementation(async (url: string) => {
      if (url.includes("capabilities")) return { data: { data: { locationId: "loc-1", enabled: true, moduleEnabled: true, inventoryMode: "tracked", actions: { sell: true, manageCatalog: true, receiveStock: true, viewCost: true } } } } as never;
      if (url.includes("counter-availability")) return { data: { data: { locationId: "loc-1", mode: "cloud", checkedAt: new Date().toISOString(), offline: null } } } as never;
      if (url.includes("/till/")) return { data: { data: null } } as never;
      if (url.includes("/sales/products")) return { data: { data: { items: [], nextCursor: null } } } as never;
      if (url.includes("/sales/overview")) return { data: { data: { recentBills: [] } } } as never;
      return { data: { data: [] } } as never;
    });
    void getSpy;
    const postSpy = vi.spyOn(api, "post").mockImplementation(async (url: string) => {
      if (url.endsWith("/quick-product")) {
        return { data: { data: { medicine: sampleMedicine, counterProduct } } } as never;
      }
      if (url.endsWith("/quote")) {
        return {
          data: {
            data: {
              locationId: "loc-1",
              currency: "INR",
              quoteHash: "0".repeat(64),
              customer: null,
              calculation: { totals: { taxablePaise: 476, baseAmountPaise: 476, cgstPaise: 12, sgstPaise: 12, igstPaise: 0, payablePaise: 500 }, lines: [] },
              lines: [{ lineId: "l1", medicineId: counterProduct.id, description: "Paracetamol", quantity: 1, unitSnapshot: counterProduct.unitDefinition, batches: [] }],
              issueInput: {},
            },
          },
        } as never;
      }
      return { data: { data: {} } } as never;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <PharmacyCounter
            locationId="loc-1"
            canCollect={false}
            canManageCatalog
            canReceiveStock
            canReviewProducts
          />
        </ToastProvider>
      </QueryClientProvider>,
    );

    const searchInput = await screen.findByRole("textbox", { name: "Scan barcode or search products" });
    await waitFor(() => expect(searchInput).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: "Quick add manual product" }));
    fireEvent.change(screen.getByLabelText("Product name *"), { target: { value: "Paracetamol" } });
    fireEvent.change(screen.getByLabelText("Generic / formulation *"), { target: { value: "Acetaminophen" } });
    fireEvent.change(screen.getByLabelText("Barcode / SKU"), { target: { value: "EKV12345678" } });
    fireEvent.change(screen.getByLabelText("Sale price / unit *"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Batch number *"), { target: { value: "B-101" } });
    fireEvent.change(datePickerInput(screen.getByRole("button", { name: /^Expiry date \*/ })), { target: { value: "2099-12" } });
    fireEvent.change(screen.getByLabelText("Total cost (INR) *"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Classification review reference *"), { target: { value: "Label and invoice check" } });

    await act(async () => {
      fireEvent.submit(document.getElementById("quick-counter-product-form")!);
    });

    await waitFor(() => expect(postSpy).toHaveBeenCalledWith(
      "/pharmacy/sales/quick-product",
      expect.objectContaining({
        locationId: "loc-1",
        name: "Paracetamol",
        barcode: "EKV12345678",
        approveForSale: true,
      }),
      expect.objectContaining({ headers: expect.objectContaining({ "Idempotency-Key": expect.any(String) }) }),
    ));
    expect(await screen.findByLabelText("Quantity Paracetamol")).toHaveValue(1);
  });
});
