"use client";

import { type ReactNode } from "react";
import Modal from "./Modal";
import Button from "./Button";
import { cn } from "./utils";

/* ────────────────────────────────────────────────
   ConfirmDialog — Sleek, compact confirmation dialog
   ──────────────────────────────────────────────── */

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
  children?: ReactNode;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  loading = false,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
    >
      <div className="space-y-3">
        {/* Header Icon + Title & Description in tight alignment */}
        <div className="flex items-start gap-3.5">
          <div
            className={cn(
              "p-2.5 rounded-xl h-10 w-10 flex items-center justify-center shrink-0 animate-scale-in",
              variant === "danger"
                ? "bg-danger-500/10 text-danger-500 border border-danger-500/20"
                : "bg-primary-500/10 text-primary-500 border border-primary-500/20"
            )}
          >
            {variant === "danger" ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-sm sm:text-base font-bold text-text tracking-tight">{title}</h3>
            {description && (
              <p className="text-xs text-text-muted mt-1 leading-relaxed">{description}</p>
            )}
            {children && <div className="mt-2 text-xs text-text">{children}</div>}
          </div>
        </div>

        {/* Tight Inline Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            size="sm"
            className="text-xs font-semibold rounded-xl cursor-pointer"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
            size="sm"
            className="text-xs font-bold rounded-xl shadow-xs cursor-pointer"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
