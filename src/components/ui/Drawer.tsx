"use client";

import React, { useEffect, useState, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { cn } from "./utils";

export type DrawerPosition = "left" | "right" | "top" | "bottom";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  position?: DrawerPosition;
  children: React.ReactNode;
  width?: string;
  className?: string;
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
  position = "right",
  children,
  width = "w-screen max-w-md",
  className = "",
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
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    previousFocusRef.current = document.activeElement as HTMLElement;

    setTimeout(() => {
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable && focusable.length > 0) {
        focusable[0].focus();
      } else {
        drawerRef.current?.focus();
      }
    }, 50);

    return () => {
      document.body.style.overflow = originalOverflow;
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  // Focus trap & Escape handling
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        if (!drawerRef.current) return;
        const focusable = Array.from(
          drawerRef.current.querySelectorAll<HTMLElement>(
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

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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
        onClick={onClose}
        aria-hidden="true"
      />

      <div className={cn("fixed", positionStyles[position])}>
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          aria-labelledby={title ? "drawer-title" : undefined}
          aria-describedby={subtitle ? "drawer-subtitle" : undefined}
          className={cn(
            "bg-surface/98 backdrop-blur-2xl border-border/80 shadow-2xl ring-1 ring-border/50 flex flex-col overflow-hidden transform-gpu focus:outline-none",
            getAnimationClass(),
            width,
            position === "right" && "border-l",
            position === "left" && "border-r",
            position === "top" && "border-b",
            position === "bottom" && "border-t rounded-t-2xl",
            className
          )}
        >
          {position === "bottom" && (
            <div className="w-full flex items-center justify-center pt-2 pb-1 bg-surface-alt/70">
              <div className="w-10 h-1 rounded-full bg-text-muted/30 hover:bg-text-muted/50 transition-colors" />
            </div>
          )}

          {/* Header */}
          {(title || subtitle) && (
            <div className="bg-surface-alt/70 border-b border-border/80 p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div>
                {title && (
                  <h3 id="drawer-title" className="text-sm sm:text-base font-semibold text-text leading-tight tracking-tight">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p id="drawer-subtitle" className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                    {subtitle}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-surface hover:bg-surface-hover border border-border flex items-center justify-center text-text-muted hover:text-text text-sm transition-all duration-150 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                aria-label="Close drawer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-surface">{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
});


