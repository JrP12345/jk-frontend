"use client";

import type { ReactNode } from "react";
import Button from "./Button";
import PrintButton from "./PrintButton";

interface Props {
  documentName: string;
  onPrint: () => void | Promise<unknown>;
  onClose: () => void;
  disabled?: boolean;
  closeLabel?: string;
  extraActions?: ReactNode;
}

/** Pass through Modal.footer so print and close stay outside the scrolling preview. */
export default function PrintDialogActions({ documentName, onPrint, onClose, disabled, closeLabel = "Close", extraActions }: Props) {
  return <div className="w-full space-y-2">
    <p className="text-[11px] text-text-muted">Printer and PDF options open in your device’s print dialog.</p>
    <div className="flex flex-wrap items-center justify-between gap-2">
      {extraActions}
      <div className="flex items-center justify-end gap-2 w-full sm:w-auto sm:ml-auto">
        <Button variant="outline" size="sm" onClick={onClose} className="flex-1 sm:flex-none">{closeLabel}</Button>
        <PrintButton variant="primary" size="sm" documentName={documentName} onPrint={onPrint} disabled={disabled} className="flex-1 sm:flex-none">Print</PrintButton>
      </div>
    </div>
  </div>;
}
