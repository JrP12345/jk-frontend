"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Flashlight, RefreshCw } from "lucide-react";
import { Alert, Button, Input, Modal } from "@/components/ui";
import { vibrateFeedback } from "@/lib/haptics";
import { normalizeBarcodeInput } from "@/lib/pharmacyBarcode";

interface BarcodeDetectorResult {
  rawValue?: string;
}

interface BarcodeDetectorInstance {
  detect(source: ImageBitmapSource): Promise<BarcodeDetectorResult[]>;
}

type BarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
  getSupportedFormats?: () => Promise<string[]>;
};

const DETECTOR_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "itf",
  "codabar",
  "qr_code",
  "data_matrix",
];

interface Props {
  open: boolean;
  title?: string;
  description?: string;
  onDetected: (code: string) => void;
  onClose: () => void;
}

export function PharmacyBarcodeScanDialog({
  open,
  title = "Scan barcode or QR",
  description = "Point the device camera at a medicine barcode, store sticker, or pickup QR.",
  onDetected,
  onClose,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="md">
      {open && <ScannerSession onDetected={onDetected} onClose={onClose} />}
    </Modal>
  );
}

function ScannerSession({ onDetected, onClose }: { onDetected: (code: string) => void; onClose: () => void }) {
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [status, setStatus] = useState<"starting" | "scanning" | "unavailable">("starting");
  const [cameraError, setCameraError] = useState("");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const detectedRef = useRef(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== undefined) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    }
    try {
      zxingControlsRef.current?.stop();
    } catch { /* Ignore cleanup failure on unmounted decoder. */ }
    zxingControlsRef.current = null;
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        try { track.stop(); } catch { /* Ignore already-stopped track. */ }
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const emitCode = useCallback((raw: string) => {
    const clean = normalizeBarcodeInput(raw);
    if (!clean || detectedRef.current) return;
    detectedRef.current = true;
    vibrateFeedback("success");
    stopCamera();
    onDetected(clean);
    onClose();
  }, [onClose, onDetected, stopCamera]);

  useEffect(() => {
    let cancelled = false;
    detectedRef.current = false;

    async function start() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setStatus("unavailable");
          setCameraError("Camera access requires a supported browser over HTTPS or localhost. Enter or scan with a USB scanner below.");
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
        setTorchSupported(Boolean(caps?.torch));
        setTorchOn(false);

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;
        setStatus("scanning");

        const NativeDetector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
        if (NativeDetector) {
          let formats = DETECTOR_FORMATS;
          if (NativeDetector.getSupportedFormats) {
            const supported = await NativeDetector.getSupportedFormats();
            const filtered = DETECTOR_FORMATS.filter(item => supported.includes(item));
            if (filtered.length) formats = filtered;
          }
          const detector = new NativeDetector({ formats });
          let lastCheck = 0;
          const scanFrame = (timestamp: number) => {
            if (cancelled || detectedRef.current) return;
            if (video.readyState >= 2 && timestamp - lastCheck >= 140) {
              lastCheck = timestamp;
              void detector.detect(video).then(results => {
                if (cancelled || detectedRef.current) return;
                const found = results.find(item => item.rawValue?.trim());
                if (found?.rawValue) emitCode(found.rawValue);
              }).catch(() => {});
            }
            rafRef.current = window.requestAnimationFrame(scanFrame);
          };
          rafRef.current = window.requestAnimationFrame(scanFrame);
          return;
        }

        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled || detectedRef.current) return;
        const reader = new BrowserMultiFormatReader();
        zxingControlsRef.current = await reader.decodeFromStream(stream, video, (result) => {
          const text = result?.getText();
          if (text && !cancelled) emitCode(text);
        });
      } catch (failure) {
        if (cancelled) return;
        stopCamera();
        setStatus("unavailable");
        const name = (failure as { name?: string })?.name;
        setCameraError(
          name === "NotAllowedError"
            ? "Camera permission was denied. Allow camera access or use a USB scanner / manual entry below."
            : name === "NotFoundError"
              ? "No camera device was detected. Connect a USB barcode scanner or type the code below."
              : "Camera preview could not start. Use a USB scanner or type the code below.",
        );
      }
    }

    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [facingMode, emitCode, stopCamera]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track?.applyConstraints) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch { /* Ignore hardware that reports capability without toggle support. */ }
  }

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl border border-border bg-black/90 aspect-video flex items-center justify-center">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {status === "scanning" && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 h-24 rounded-xl border-2 border-accent/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        )}
        {status === "starting" && (
          <p role="status" className="absolute text-xs font-medium text-white/90">Starting camera…</p>
        )}
        {status === "unavailable" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-white/80">
            <Camera className="h-7 w-7 opacity-80" aria-hidden="true" />
            <p className="text-xs">Camera scanner unavailable</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => {
              setStatus("starting");
              setCameraError("");
              setFacingMode(mode => (mode === "environment" ? "user" : "environment"));
            }}
            icon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}
          >
            Switch camera
          </Button>
          {torchSupported && (
            <Button
              type="button"
              size="xs"
              variant={torchOn ? "primary" : "outline"}
              onClick={() => { void toggleTorch(); }}
              icon={<Flashlight className="w-3.5 h-3.5" aria-hidden="true" />}
            >
              {torchOn ? "Flash on" : "Flash"}
            </Button>
          )}
        </div>
        {status === "scanning" && (
          <span role="status" className="text-xs text-text-secondary">Ready to scan</span>
        )}
      </div>

      {cameraError && (
        <Alert variant="warning" title="Camera not active">
          {cameraError}
        </Alert>
      )}

      <form
        onSubmit={event => {
          event.preventDefault();
          if (manualCode.trim()) emitCode(manualCode);
        }}
        className="flex items-end gap-2 border-t border-border/60 pt-3"
      >
        <Input
          label="Or scan with USB / enter code"
          placeholder="Scan or type barcode"
          containerClassName="min-w-0 flex-1"
          value={manualCode}
          maxLength={64}
          onChange={event => setManualCode(event.target.value)}
        />
        <Button type="submit" size="sm" disabled={!manualCode.trim()}>
          Use code
        </Button>
      </form>
    </div>
  );
}
