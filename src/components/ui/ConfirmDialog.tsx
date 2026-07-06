"use client";

import { type ReactNode } from "react";
import Modal from "./Modal";
import Button from "./Button";
import { cn } from "./utils";

/* ────────────────────────────────────────────────
   ConfirmDialog — Confirmation modal with theme icons
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
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading} size="sm">
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
            size="sm"
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-4">
        <div className={cn(
          "p-3 rounded-2xl h-11 w-11 flex items-center justify-center shrink-0 animate-scale-in",
          variant === "danger" 
            ? "bg-danger-50 text-danger-500 dark:bg-danger-950/20 dark:text-danger-400" 
            : "bg-primary-50 text-primary-500 dark:bg-primary-950/20 dark:text-primary-400"
        )}>
          {variant === "danger" ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-text">{title}</h3>
          {description && <p className="text-sm text-text-secondary mt-1">{description}</p>}
          {children && <div className="mt-3 text-sm text-text">{children}</div>}
        </div>
      </div>
    </Modal>
  );
}

