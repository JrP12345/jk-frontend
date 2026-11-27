"use client";

import type { ReactNode } from "react";
import { Alert, Button, Modal, Spinner } from "@/components/ui";
import type { ModalSize } from "@/components/ui/Modal";

/** Consistent inline loading or error block rendered inside an already-open pharmacy sheet or detail panel. */
export function PharmacyDetailLoadingState({
  label = "Loading details...",
  error = "",
  errorTitle = "Could not load details",
  onRetry,
  className = "py-6",
}: {
  label?: string;
  error?: string;
  errorTitle?: string;
  onRetry?: () => void;
  className?: string;
}) {
  if (error) {
    return (
      <Alert variant="error" title={errorTitle}>
        {error}
        {onRetry && (
          <div className="mt-2">
            <Button size="xs" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          </div>
        )}
      </Alert>
    );
  }
  return (
    <div role="status" className={`flex items-center gap-2.5 text-xs text-text-secondary ${className}`}>
      <Spinner size="sm" />
      <span>{label}</span>
    </div>
  );
}

/** Opens immediately on tap as a responsive sheet/modal while authoritative pharmacy record details load. */
export function PharmacyDetailLoadingSheet({
  open,
  title,
  ariaLabel,
  description,
  header,
  size = "md",
  label,
  error,
  errorTitle,
  onRetry,
  onClose,
}: {
  open: boolean;
  title?: string;
  ariaLabel?: string;
  description?: string;
  header?: ReactNode;
  size?: ModalSize;
  label?: string;
  error?: string;
  errorTitle?: string;
  onRetry?: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <Modal
      open
      presentation="sheet"
      size={size}
      title={title}
      ariaLabel={ariaLabel}
      description={description}
      header={header}
      onClose={onClose}
    >
      <PharmacyDetailLoadingState
        label={label}
        error={error}
        errorTitle={errorTitle}
        onRetry={onRetry}
      />
    </Modal>
  );
}
