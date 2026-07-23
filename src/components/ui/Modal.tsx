"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "./utils";

/* ────────────────────────────────────────────────
   Modal — Animated dialog overlay with focus trap & scroll lock
   ──────────────────────────────────────────────── */

type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

interface ModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: ModalSize;
  children: ReactNode;
  footer?: ReactNode;
  closeOnOverlay?: boolean;
  className?: string;
}

const sizeStyles: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  full: "max-w-[calc(100vw-2rem)]",
};

export default function Modal({
  open: openProp,
  isOpen: isOpenProp,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
  closeOnOverlay = true,
  className = "",
}: ModalProps) {
  const open = openProp ?? isOpenProp ?? false;
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Lock scroll on mount, restore on unmount
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  // Focus trap and focus restoration
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus modal container or first element
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
    } else {
      previousFocusRef.current?.focus();
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
        ).filter(el => {
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

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Overlay Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in cursor-pointer"
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
        className={cn(
          "relative w-full bg-surface rounded-2xl shadow-2xl border border-border/80 ring-1 ring-white/5 animate-scale-in flex flex-col focus:outline-none overflow-hidden max-h-[90vh]",
          sizeStyles[size],
          className
        )}
      >
        {(title || description) && (
          <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-0 shrink-0">
            {title && <h2 id="modal-title" className="text-base sm:text-lg font-semibold text-text">{title}</h2>}
            {description && <p className="text-xs sm:text-sm text-text-secondary mt-1">{description}</p>}
          </div>
        )}

        <div className="px-4 sm:px-6 py-4 sm:py-5 overflow-y-auto flex-1 max-h-[75vh]">
          {children}
        </div>

        {footer && (
          <div className="px-4 sm:px-6 pb-4 sm:pb-5 flex items-center justify-end gap-2 border-t border-border pt-3 sm:pt-4">
            {footer}
          </div>
        )}

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg cursor-pointer text-text-muted hover:text-text hover:bg-surface-hover transition-colors duration-150"
          aria-label="Close"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
    </div>,
    document.body
  );
}

