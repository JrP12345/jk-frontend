"use client";

import React, { useEffect } from "react";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: string;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = "w-[380px] sm:w-[440px]",
}: DrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-overlay backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          className={`w-screen ${width} bg-surface border-l border-border shadow-2xl flex flex-col overflow-hidden animate-slide-in-right`}
        >
          {/* Header */}
          {(title || subtitle) && (
            <div className="bg-surface-alt border-b border-border p-4 flex items-center justify-between shrink-0">
              <div>
                {title && <h3 className="text-sm font-bold text-text leading-tight">{title}</h3>}
                {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-surface hover:bg-surface-hover border border-border flex items-center justify-center text-text-secondary hover:text-text text-xs font-bold transition-colors"
              >
                ✕
              </button>
            </div>
          )}

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-4 bg-surface">{children}</div>
        </div>
      </div>
    </div>
  );
}
