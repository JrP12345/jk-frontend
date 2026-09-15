"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "./utils";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
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
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  "2xl": "max-w-4xl",
  full: "max-w-[calc(100vw-2rem)]",
};

export default function Modal({
  open: openProp,
  isOpen: isOpenProp,
  onClose,
  title,
  description,
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
  const previousFocusRef = useRef<HTMLElement | null>(null);

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

  // Lock scroll on mount, restore on unmount via reference-counted scroll lock
  useEffect(() => {
    if (!open) return;
    lockScroll();
    return () => {
      unlockScroll();
    };
  }, [open]);

  // Focus trap and focus restoration
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setTimeout(() => {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable && focusable.length > 0) {
          focusable[0].focus();
        } else {
          modalRef.current?.focus();
        }
      }, 50);
    } else if (!open && previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [open]);

  // Keyboard navigation & escape listener
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        if (!modalRef.current) return;
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => {
          const style = window.getComputedStyle(el);
          return el.tabIndex !== -1 && style.display !== "none" && style.visibility !== "hidden";
        });

        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!render || !mounted) return null;

  const hasHeader = Boolean(header || title || description);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Overlay Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer transition-all duration-200",
          isExiting ? "animate-backdrop-out" : "animate-backdrop-in"
        )}
        onClick={closeOnOverlay ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby={title ? "modal-title" : undefined}
        aria-describedby={description ? "modal-desc" : undefined}
        className={cn(
          "relative w-full bg-surface/98 backdrop-blur-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl border border-border/80 ring-1 ring-border/50 flex flex-col focus:outline-none overflow-hidden max-h-[92vh] sm:max-h-[90vh] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-0 transform-gpu before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-500/40 before:to-transparent",
          isExiting ? "animate-sheet-out" : "animate-sheet-in",
          sizeStyles[size],
          className
        )}
      >
        {/* Mobile Sheet Drag Handle */}
        <div className="w-full flex items-center justify-center pt-2.5 pb-0.5 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Sticky Header Section */}
        {hasHeader && (
          <div className={cn(
            "px-4 sm:px-6 pt-2.5 sm:pt-4 pb-3 sm:pb-3.5 shrink-0 border-b border-border/70 bg-surface-alt/40 backdrop-blur-xs relative pr-12",
            headerClassName
          )}>
            {header ? (
              header
            ) : (
              <>
                {title && (
                  <h2 id="modal-title" className="text-sm sm:text-base font-bold text-text tracking-tight leading-snug">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id="modal-desc" className="text-xs sm:text-sm text-text-secondary mt-0.5 sm:mt-1 leading-relaxed">
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
            "overflow-y-auto flex-1 min-h-0 touch-scroll relative p-4 sm:p-5",
            bodyClassName
          )}
        >
          {loading && (
            <div
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-surface/85 backdrop-blur-xs p-6 text-center animate-fade-in"
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
            "px-4 sm:px-6 py-3 sm:py-3.5 shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5 border-t border-border/80 bg-surface-alt/70 backdrop-blur-md z-10",
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
            className="absolute top-2 right-2 sm:top-3 sm:right-3 w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl cursor-pointer text-text-muted hover:text-text hover:bg-surface-hover active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 z-20"
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
    <div className={cn("px-4 sm:px-6 pt-3 pb-3 border-b border-border/70 shrink-0 bg-surface-alt/40", className)}>
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
    <div className={cn("flex-1 min-h-0 overflow-y-auto p-4 sm:p-5", className)}>
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
    <div className={cn("px-4 sm:px-6 py-3 shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5 border-t border-border/80 bg-surface-alt/70 backdrop-blur-md z-10", className)}>
      {children}
    </div>
  );
}


