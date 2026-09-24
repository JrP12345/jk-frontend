"use client";

import React, { useEffect, useState, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { cn } from "./utils";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import Spinner from "./Spinner";

export type DrawerPosition = "left" | "right" | "top" | "bottom";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  header?: React.ReactNode;
  position?: DrawerPosition;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  loading?: boolean;
  loadingText?: string;
}

const positionStyles: Record<DrawerPosition, string> = {
  right: "inset-y-0 right-0 max-w-full flex pl-10 animate-slide-in-right",
  left: "inset-y-0 left-0 max-w-full flex pr-10 animate-slide-in-left",
  top: "inset-x-0 top-0 max-h-full flex pb-10 animate-slide-in-down",
  bottom: "inset-x-0 bottom-0 max-h-full flex pt-10 animate-slide-in-up",
};

export const Drawer = memo(function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  header,
  position = "right",
  children,
  footer,
  width = "w-screen max-w-md",
  className = "",
  bodyClassName = "",
  headerClassName = "",
  footerClassName = "",
  loading = false,
  loadingText,
}: DrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [render, setRender] = useState(isOpen);
  const [isExiting, setIsExiting] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setRender(true);
      setIsExiting(false);
    } else if (render) {
      setIsExiting(true);
      const timer = setTimeout(() => {
        setRender(false);
        setIsExiting(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, render]);

  useEffect(() => {
    if (!isOpen) return;
    lockScroll();
    previousFocusRef.current = document.activeElement as HTMLElement;

    const timer = setTimeout(() => {
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable && focusable.length > 0) {
        focusable[0].focus();
      } else {
        drawerRef.current?.focus();
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      unlockScroll();
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  // Focus trap & Escape handling
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (loading) return; // Prevent dismissing drawer while critical action is in-flight
        onClose();
        return;
      }
      if (e.key === "Tab") {
        if (!drawerRef.current) return;
        const focusable = Array.from(
          drawerRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
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

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, loading]);

  if (!render || !mounted) return null;

  const getAnimationClass = () => {
    if (isExiting) {
      return position === "bottom" ? "animate-drawer-out-bottom" : "animate-drawer-out-right";
    }
    return position === "bottom" ? "animate-drawer-bottom" : "animate-drawer-right";
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop Overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-black/60 backdrop-blur-md cursor-pointer transition-all duration-200",
          isExiting ? "animate-backdrop-out" : "animate-backdrop-in"
        )}
        onClick={loading ? undefined : onClose}
        aria-hidden="true"
      />

      <div className={cn("fixed", positionStyles[position])}>
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          aria-labelledby={ariaLabelledBy || (title ? "drawer-title" : undefined)}
          aria-describedby={ariaDescribedBy || (subtitle ? "drawer-subtitle" : undefined)}
          aria-label={ariaLabel || (!title && !ariaLabelledBy ? "Drawer" : undefined)}
          className={cn(
            "bg-surface/98 backdrop-blur-2xl border-border/80 shadow-2xl ring-1 ring-border/50 flex flex-col overflow-hidden transform-gpu focus:outline-none",
            getAnimationClass(),
            width,
            position === "right" && "border-l",
            position === "left" && "border-r",
            position === "top" && "border-b",
            position === "bottom" && "border-t rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[85vh]",
            className
          )}
        >
          {position === "bottom" && (
            <div className="w-full flex items-center justify-center pt-2.5 pb-1 bg-surface-alt/70 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-border" />
            </div>
          )}

          {/* Header */}
          {(header || title || subtitle) && (
            <div className={cn(
              "bg-surface-alt/70 border-b border-border/80 p-4 sm:p-5 flex items-center justify-between shrink-0",
              headerClassName
            )}>
              {header ? (
                header
              ) : (
                <div className="min-w-0 pr-3">
                  {title && (
                    <h3 id="drawer-title" className="text-sm sm:text-base font-semibold text-text leading-tight tracking-tight truncate">
                      {title}
                    </h3>
                  )}
                  {subtitle && (
                    <p id="drawer-subtitle" className="text-xs text-text-secondary mt-0.5 leading-relaxed truncate">
                      {subtitle}
                    </p>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl bg-surface hover:bg-surface-hover border border-border flex items-center justify-center text-text-muted hover:text-text text-sm transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 shrink-0 min-h-[40px] sm:min-h-0 min-w-[40px] sm:min-w-0 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Close drawer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Drawer Body */}
          <div className={cn("flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 bg-surface touch-scroll relative", bodyClassName)}>
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

          {/* Sticky Footer */}
          {footer && (
            <div className={cn(
              "p-4 sm:p-5 border-t border-border/80 bg-surface-alt/80 backdrop-blur-md flex items-center justify-end gap-2.5 shrink-0 z-10",
              footerClassName
            )}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
});

export function DrawerHeader({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("p-4 sm:p-5 border-b border-border/80 shrink-0 bg-surface-alt/70", className)}>
      {children}
    </div>
  );
}

export function DrawerBody({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 bg-surface", className)}>
      {children}
    </div>
  );
}

export function DrawerFooter({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("p-4 sm:p-5 border-t border-border/80 bg-surface-alt/80 backdrop-blur-md flex items-center justify-end gap-2.5 shrink-0 z-10", className)}>
      {children}
    </div>
  );
}


