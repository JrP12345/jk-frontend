"use client";

import { type ReactNode, useEffect, useRef, useState, useId } from "react";
import { createPortal } from "react-dom";
import { cn } from "./utils";
import { useOverlayFocus } from "@/hooks/useOverlayFocus";
import Spinner from "./Spinner";

/* ────────────────────────────────────────────────
   Modal — Animated dialog overlay with focus trap & scroll lock
   ──────────────────────────────────────────────── */

export type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

export interface ModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  header?: ReactNode;
  size?: ModalSize;
  children: ReactNode;
  footer?: ReactNode;
  closeOnOverlay?: boolean;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  loading?: boolean;
  loadingText?: string;
  showCloseButton?: boolean;
}

const sizeStyles: Record<ModalSize, string> = {
  sm: "md:max-w-sm",
  md: "md:max-w-md",
  lg: "md:max-w-lg",
  xl: "md:max-w-2xl",
  "2xl": "md:max-w-4xl",
  full: "md:max-w-[calc(100vw-2rem)]",
};

export default function Modal({
  open: openProp,
  isOpen: isOpenProp,
  onClose,
  title,
  description,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  header,
  size = "md",
  children,
  footer,
  closeOnOverlay = true,
  className = "",
  bodyClassName = "",
  headerClassName = "",
  footerClassName = "",
  loading = false,
  loadingText,
  showCloseButton = true,
}: ModalProps) {
  const open = openProp ?? isOpenProp ?? false;
  const [mounted, setMounted] = useState(false);
  const [render, setRender] = useState(open);
  const [isExiting, setIsExiting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  useOverlayFocus(open && render && mounted, modalRef, () => { if (!loading) onClose(); });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle open/exit state transitions
  useEffect(() => {
    if (open) {
      setRender(true);
      setIsExiting(false);
    } else if (render) {
      setIsExiting(true);
      const timer = setTimeout(() => {
        setRender(false);
        setIsExiting(false);
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [open, render]);

  if (!render || !mounted) return null;

  const hasHeader = Boolean(header || title || description);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      {/* Overlay Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/60  cursor-pointer transition-all duration-200",
          isExiting ? "animate-backdrop-out" : "animate-backdrop-in"
        )}
        onClick={closeOnOverlay && !loading ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        ref={modalRef}
        id={id}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby={ariaLabelledBy || (title && !header ? titleId : undefined)}
        aria-describedby={ariaDescribedBy || (description && !header ? descriptionId : undefined)}
        aria-label={ariaLabel || (!ariaLabelledBy && (!title || header) ? title || "Dialog" : undefined)}
        className={cn(
          "relative w-full bg-surface  rounded-t-3xl md:rounded-2xl shadow-lg border border-border/80 ring-1 ring-border/50 flex flex-col focus:outline-none overflow-hidden max-h-[92dvh] md:max-h-[90dvh] pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-0 transform-gpu ",
          isExiting ? "animate-sheet-out" : "animate-sheet-in",
          sizeStyles[size],
          className
        )}
      >
        {/* Mobile Sheet Drag Handle */}
        <div className="w-full flex items-center justify-center pt-2.5 pb-0.5 md:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Sticky Header Section */}
        {hasHeader && (
          <div className={cn(
            "px-4 md:px-6 pt-2.5 md:pt-4 pb-3 md:pb-3.5 shrink-0 border-b border-border/70 bg-surface-alt/40  relative pr-12",
            headerClassName
          )}>
            {header ? (
              header
            ) : (
              <>
                {title && (
                  <h2 id={titleId} className="text-sm md:text-base font-bold text-text tracking-tight leading-snug">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descriptionId} className="text-xs md:text-sm text-text-secondary mt-0.5 md:mt-1 leading-relaxed">
                    {description}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Scrollable Content Body */}
        <div
          className={cn(
            "overflow-y-auto flex-1 min-h-0 touch-scroll relative p-4 md:p-5",
            bodyClassName
          )}
        >
          {loading && (
            <div
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-surface  p-6 text-center animate-fade-in"
              role="status"
              aria-live="polite"
            >
              <Spinner size="md" label={loadingText || "Loading..."} />
            </div>
          )}
          <div className={cn("w-full transition-opacity duration-200", loading && "opacity-30 pointer-events-none")}>
            {children}
          </div>
        </div>

        {/* Sticky Footer Section — Buttons stay pinned without requiring scroll */}
        {footer && (
          <div className={cn(
            "px-4 md:px-6 py-3 md:py-3.5 shrink-0 flex flex-col-reverse md:flex-row items-stretch md:items-center justify-end gap-2 md:gap-2.5 border-t border-border/80 bg-surface-alt  z-10",
            footerClassName
          )}>
            {footer}
          </div>
        )}

        {/* Close Button — Touch Friendly 40x40px Target */}
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="absolute top-2 right-2 md:top-3 md:right-3 w-11 h-11 md:w-8 md:h-8 flex items-center justify-center rounded-xl cursor-pointer text-text-muted hover:text-text hover:bg-surface-hover active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring z-20 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Close modal"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}

export function ModalHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-4 md:px-6 pt-3 pb-3 border-b border-border/70 shrink-0 bg-surface-alt/40", className)}>
      {children}
    </div>
  );
}

export function ModalBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex-1 min-h-0 overflow-y-auto p-4 md:p-5", className)}>
      {children}
    </div>
  );
}

export function ModalFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-4 md:px-6 py-3 shrink-0 flex flex-col-reverse md:flex-row items-stretch md:items-center justify-end gap-2 md:gap-2.5 border-t border-border/80 bg-surface-alt  z-10", className)}>
      {children}
    </div>
  );
}


