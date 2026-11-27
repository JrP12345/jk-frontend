"use client";

import { useEffect, useRef, type RefObject } from "react";

const MAX_INTER_KEY_MS = 65;
const MAX_TERMINATOR_GAP_MS = 120;
const MIN_SCAN_LENGTH = 4;
const BARCODE_CHAR = /^[A-Za-z0-9._/-]$/;

function isForeignEditableElement(element: Element | null, ownInput?: HTMLInputElement | null): boolean {
  if (!element || element === ownInput) return false;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return true;
  }
  return Boolean((element as HTMLElement).isContentEditable);
}

/**
 * Captures rapid USB/Bluetooth HID keyboard-wedge barcode bursts even when cursor
 * focus sits outside the dedicated search box, without intercepting typing inside
 * other inputs or normal button Enter activations.
 */
export function useBarcodeScanner({
  enabled = true,
  inputRef,
  onScan,
}: {
  enabled?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  onScan: (code: string) => void;
}) {
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    let buffer = "";
    let lastKeyAt = 0;
    let resetTimer: number | undefined;

    const clearBuffer = () => {
      buffer = "";
      lastKeyAt = 0;
      if (resetTimer !== undefined) {
        window.clearTimeout(resetTimer);
        resetTimer = undefined;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        clearBuffer();
        return;
      }

      const active = document.activeElement;
      const ownInput = inputRef?.current ?? null;
      // When the search input itself is focused, its own form submit/Enter handles scans.
      if (active && active === ownInput) {
        clearBuffer();
        return;
      }
      if (isForeignEditableElement(active, ownInput)) {
        clearBuffer();
        return;
      }
      // Pause global capture while a modal dialog (other than inline workspace) is open unless active is inside body.
      const topDialog = document.querySelector('[role="dialog"]');
      if (topDialog && (!ownInput || !topDialog.contains(ownInput))) {
        clearBuffer();
        return;
      }

      const now = performance.now();
      if (event.key === "Enter") {
        if (buffer.length >= MIN_SCAN_LENGTH && now - lastKeyAt <= MAX_TERMINATOR_GAP_MS) {
          event.preventDefault();
          event.stopPropagation();
          const scanned = buffer;
          clearBuffer();
          onScanRef.current(scanned);
        } else {
          clearBuffer();
        }
        return;
      }

      if (event.key.length === 1 && BARCODE_CHAR.test(event.key)) {
        if (lastKeyAt && now - lastKeyAt > MAX_INTER_KEY_MS) {
          buffer = event.key;
        } else {
          buffer += event.key;
        }
        if (buffer.length > 64) {
          buffer = buffer.slice(-64);
        }
        lastKeyAt = now;
        if (resetTimer !== undefined) window.clearTimeout(resetTimer);
        resetTimer = window.setTimeout(clearBuffer, MAX_TERMINATOR_GAP_MS * 2);
        return;
      }

      if (!["Shift", "CapsLock"].includes(event.key)) {
        clearBuffer();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("focusin", clearBuffer, true);
    return () => {
      clearBuffer();
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("focusin", clearBuffer, true);
    };
  }, [enabled, inputRef]);
}
