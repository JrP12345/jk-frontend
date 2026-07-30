"use client";

import { type ReactNode, createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "./utils";

/* ────────────────────────────────────────────────
   Toast — Notification system with gestures & progress lines
   ──────────────────────────────────────────────── */

export type ToastVariant = "default" | "success" | "error" | "warning";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

export interface ToastContextValue {
  toast: (options: Omit<Toast, "id" | "duration"> & { id?: string; duration?: number }) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

/* ── ToastProvider ───────────────────────────── */

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const addToast = useCallback((options: Omit<Toast, "id" | "duration"> & { id?: string; duration?: number }) => {
    setToasts((prev) => {
      if (prev.some((t) => t.title === options.title && t.description === options.description)) {
        return prev;
      }
      const id = options.id || crypto.randomUUID();
      return [...prev, { ...options, id, duration: options.duration || 4000 } as Toast];
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast, dismiss }}>
      {children}
      {mounted &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2.5 max-w-sm w-full px-4 sm:px-0 pointer-events-none">
            {toasts.map((t) => (
              <div key={t.id} className="pointer-events-auto">
                <ToastItem {...t} onDismiss={() => dismiss(t.id)} />
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

/* ── Single toast item with drag dismiss ─────── */

const icons: Record<ToastVariant, ReactNode> = {
  default: (
    <svg className="h-5 w-5 text-primary-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
    </svg>
  ),
  success: (
    <svg className="h-5 w-5 text-success-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  ),
  error: (
    <svg className="h-5 w-5 text-danger-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  ),
  warning: (
    <svg className="h-5 w-5 text-warning-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 2l10 18H2L12 2z" />
    </svg>
  ),
};

function ToastItem({ title, description, variant, duration, onDismiss }: Toast & { onDismiss: () => void }) {
  const [exiting, setExiting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [startX, setStartX] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 200);
    }, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [duration, onDismiss, paused]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    if (diff > 0) setDragX(diff);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragX > 120) {
      setExiting(true);
      setTimeout(onDismiss, 150);
    } else {
      setDragX(0);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setStartX(e.clientX);
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const diff = e.clientX - startX;
    if (diff > 0) setDragX(diff);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (dragX > 120) {
      setExiting(true);
      setTimeout(onDismiss, 150);
    } else {
      setDragX(0);
    }
  };

  const variantStyles: Record<ToastVariant, string> = {
    default: "bg-surface/95 border-border/80 ring-1 ring-white/10 text-text shadow-xl shadow-black/20",
    success: "bg-surface/95 border-success-500/30 ring-1 ring-success-500/10 text-text shadow-xl shadow-success-500/5",
    error: "bg-surface/95 border-danger-500/30 ring-1 ring-danger-500/10 text-text shadow-xl shadow-danger-500/5",
    warning: "bg-surface/95 border-warning-500/30 ring-1 ring-warning-500/10 text-text shadow-xl shadow-warning-500/5",
  };

  const progressColors: Record<ToastVariant, string> = {
    default: "bg-primary-500",
    success: "bg-success-500",
    error: "bg-danger-500",
    warning: "bg-warning-500",
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        handleMouseUp();
        setPaused(false);
      }}
      onMouseEnter={() => setPaused(true)}
      className={cn(
        "relative flex items-start gap-3 border rounded-xl px-4 py-3.5 shadow-xl backdrop-blur-md cursor-grab active:cursor-grabbing select-none overflow-hidden transform-gpu",
        variantStyles[variant],
        exiting ? "animate-toast-slide-out" : "animate-toast-slide-in"
      )}
      style={{
        transform: dragX > 0 ? `translateX(${dragX}px)` : undefined,
        opacity: dragX > 0 ? Math.max(0, 1 - dragX / 300) : undefined,
        transition: isDragging ? "none" : undefined,
      }}
      role="status"
      aria-live="polite"
    >
      <span className="shrink-0 mt-0.5">{icons[variant]}</span>

      <div className="flex-1 min-w-0 pr-2">
        <p className="text-sm font-semibold text-text tracking-tight">{title}</p>
        {description && <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{description}</p>}
      </div>

      <button
        type="button"
        onClick={() => {
          setExiting(true);
          setTimeout(onDismiss, 150);
        }}
        className="shrink-0 p-1.5 rounded-md cursor-pointer text-text-muted hover:text-text hover:bg-surface-hover active:scale-90 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        aria-label="Dismiss notification"
      >
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M3 3l8 8M11 3l-8 8" />
        </svg>
      </button>

      {/* Progress countdown bar */}
      <div
        className={cn(
          "absolute bottom-0 left-0 h-0.5 rounded-b-xl transition-all duration-100 opacity-70",
          progressColors[variant],
          paused && "opacity-20"
        )}
        style={{
          width: paused ? "100%" : "0%",
          transitionDuration: paused ? "0ms" : `${duration}ms`,
        }}
      />
    </div>
  );
}


