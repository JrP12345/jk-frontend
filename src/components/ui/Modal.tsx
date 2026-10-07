"use client";

import { type CSSProperties, type ReactNode, useEffect, useRef, useState, useId } from "react";
import { createPortal } from "react-dom";
import { cn } from "./utils";
import { useOverlayFocus } from "@/hooks/useOverlayFocus";
import { useOverlayViewport } from "@/hooks/useOverlayViewport";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
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
  viewportClassName?: string;
  viewportStyle?: CSSProperties;
  bodyClassName?: string;
  contentClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  loading?: boolean;
  /** Submission feedback belongs to the action button. */
  busy?: boolean;
  presentation?: "dialog" | "sheet";
  placement?: "center" | "top";
  loadingText?: string;
  showCloseButton?: boolean;
}

const sizeStyles: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "2xl": "max-w-6xl",
  full: "max-w-[calc(100vw-2rem)]",
};

const sheetSizeStyles: Record<ModalSize, string> = {
  sm: "md:max-w-sm",
  md: "md:max-w-lg",
  lg: "md:max-w-2xl",
  xl: "md:max-w-4xl",
  "2xl": "md:max-w-6xl",
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
  viewportClassName = "",
  viewportStyle,
  bodyClassName = "",
  contentClassName = "",
  headerClassName = "",
  footerClassName = "",
  loading = false,
  busy = false,
  presentation = "dialog",
  placement = "center",
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
  const blocked = loading || busy;
  const sheetGesture = useSwipeGesture({ axis: "y", direction: "down", enabled: open && presentation === "sheet" && !blocked, onSwipe: onClose });
  const viewport = useOverlayViewport(render);
  useOverlayFocus(render && mounted, modalRef, () => { if (!blocked) onClose(); });

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
    <div style={{ ...viewport, ...viewportStyle }} className={cn("fixed inset-0 z-[var(--layer-dialog)] flex justify-center", presentation === "sheet" ? "p-0 md:p-4" : "p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]", placement === "top" ? "items-start" : presentation === "sheet" ? "items-end md:items-center" : "items-center", viewportClassName)}>
      {/* Overlay Backdrop */}
      <div
        className={cn(
          "overlay-backdrop absolute inset-0 cursor-pointer transition-all duration-200",
          isExiting ? "animate-backdrop-out" : "animate-backdrop-in"
        )}
        onClick={closeOnOverlay && !blocked ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        ref={modalRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-busy={blocked || undefined}
        tabIndex={-1}
        aria-labelledby={ariaLabelledBy || (title && !header ? titleId : undefined)}
        aria-describedby={ariaDescribedBy || (description && !header ? descriptionId : undefined)}
        aria-label={ariaLabel || (!ariaLabelledBy && (!title || header) ? title || "Dialog" : undefined)}
        style={{ translate: sheetGesture.offset ? `0 ${sheetGesture.offset}px` : undefined, transition: sheetGesture.dragging ? "none" : "translate 180ms ease" }}
        className={cn(
          "relative w-full bg-surface-elevated shadow-xl border border-border flex flex-col focus:outline-none overflow-hidden md:max-h-[min(90dvh,100%)]",
          presentation === "sheet"
            ? "rounded-t-overlay md:rounded-overlay max-h-[min(92dvh,100%)] pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-0"
            : "rounded-overlay max-h-full",
          presentation === "sheet"
            ? isExiting ? "animate-sheet-out" : "animate-sheet-in"
            : isExiting ? "animate-dialog-out" : "animate-dialog-in",
          presentation === "sheet" ? sheetSizeStyles[size] : sizeStyles[size],
          className
        )}
      >
        {/* Mobile Sheet Drag Handle */}
        {presentation === "sheet" && <div {...sheetGesture.handlers} aria-hidden="true" className="w-full h-8 flex items-center justify-center md:hidden shrink-0 [touch-action:pan-x_pinch-zoom]">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>}

        {/* Sticky Header Section */}
        {hasHeader && (
          <div className={cn(
            "px-4 md:px-6 pt-4 pb-3 md:pb-3.5 shrink-0 border-b border-border/70 bg-surface-elevated relative pr-14",
            headerClassName
          )}>
            {header ? (
              header
            ) : (
              <>
                {title && (
                  <h2 id={titleId} className="text-base font-semibold text-text tracking-tight leading-snug">
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
            "overflow-y-auto overscroll-contain flex-1 min-h-0 touch-scroll relative p-4 md:p-5",
            bodyClassName
          )}
        >
          {loading && (
            <div
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-surface  p-6 text-center animate-fade-in"
              role="status"
              aria-live="polite"
              aria-label={loadingText || "Loading..."}
            >
              <div aria-hidden="true"><Spinner size="md" label={loadingText || "Loading..."} /></div>
            </div>
          )}
          <div inert={loading || undefined} className={cn("w-full transition-opacity duration-200", loading && "opacity-30 pointer-events-none", contentClassName)}>
            {children}
          </div>
        </div>

        {/* Sticky Footer Section — Buttons stay pinned without requiring scroll */}
        {footer && (
          <div className={cn(
            "px-4 md:px-6 py-3 md:py-3.5 shrink-0 flex flex-col-reverse md:flex-row items-stretch md:items-center justify-end gap-2 md:gap-2.5 border-t border-border/80 bg-surface-elevated z-10",
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
            disabled={blocked}
            className="absolute top-2 right-2 md:top-3 md:right-3 w-11 h-11 md:w-8 md:h-8 flex items-center justify-center rounded-control cursor-pointer text-text-muted hover:text-text hover:bg-surface-hover transition-colors duration-[var(--motion-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring z-20 disabled:opacity-40 disabled:cursor-not-allowed"
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
