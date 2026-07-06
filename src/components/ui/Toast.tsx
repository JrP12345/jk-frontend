"use client";

import { type ReactNode, createContext, useContext, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "./utils";

/* ────────────────────────────────────────────────
   Toast — Notification system with gestures & progress lines
   ──────────────────────────────────────────────── */

type ToastVariant = "default" | "success" | "error" | "warning";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextValue {
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
    const id = options.id || crypto.randomUUID();
    setToasts((prev) => [...prev, { ...options, id, duration: options.duration || 4000 } as Toast]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast, dismiss }}>
      {children}
      {mounted && createPortal(
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0">
          {toasts.map((t) => (
            <ToastItem key={t.id} {...t} onDismiss={() => dismiss(t.id)} />
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
    <svg className="h-5 w-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
    </svg>
  ),
  success: (
    <svg className="h-5 w-5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  ),
  error: (
    <svg className="h-5 w-5 text-danger-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  ),
  warning: (
    <svg className="h-5 w-5 text-warning-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 2l10 18H2L12 2z" />
    </svg>
  ),
};

function ToastItem({ id, title, description, variant, duration, onDismiss }: Toast & { onDismiss: () => void }) {
  const [exiting, setExiting] = useState(false);
  const [startX, setStartX] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 250);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

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
      setTimeout(onDismiss, 200);
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
      setTimeout(onDismiss, 200);
    } else {
      setDragX(0);
    }
  };

  const variantStyles = {
    default: "bg-surface border-border text-text",
    success: "bg-success-600/10 border-success-500/20 text-success-700 dark:bg-success-500/20 dark:text-success-100",
    error: "bg-danger-600/10 border-danger-500/20 text-danger-700 dark:bg-danger-500/20 dark:text-danger-100",
    warning: "bg-warning-600/10 border-warning-500/20 text-warning-700 dark:bg-warning-500/20 dark:text-warning-100",
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={cn(
        "relative flex items-start gap-3 border rounded-xl px-4 py-3.5 shadow-lg backdrop-blur-md cursor-grab active:cursor-grabbing select-none overflow-hidden transition-all duration-300 ease-spring",
        variantStyles[variant],
        exiting ? "animate-toast-out" : "animate-toast-in",
      )}
      style={{
        transform: dragX > 0 ? `translateX(${dragX}px)` : undefined,
        opacity: dragX > 0 ? Math.max(0, 1 - dragX / 300) : undefined,
        transition: isDragging ? "none" : undefined,
      }}
      role="alert"
    >
      <style>{`
        @keyframes toast-progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>

      <span className="shrink-0 mt-0.5">{icons[variant]}</span>

      <div className="flex-1 min-w-0 pr-2">
        <p className="text-sm font-semibold">{title}</p>
        {description && <p className="text-xs opacity-90 mt-0.5 leading-relaxed">{description}</p>}
      </div>

      <button
        type="button"
        onClick={() => {
          setExiting(true);
          setTimeout(onDismiss, 250);
        }}
        className="shrink-0 p-1.5 rounded-lg cursor-pointer text-text-muted hover:text-text hover:bg-surface-hover transition-all duration-200 active:scale-75"
        aria-label="Dismiss"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M3 3l8 8M11 3l-8 8" />
        </svg>
      </button>

      {/* Progress countdown bar */}
      <div
        className={cn(
          "absolute bottom-0 left-0 h-0.5 bg-current opacity-25 rounded-b-xl"
        )}
        style={{
          animation: `toast-progress ${duration}ms linear forwards`
        }}
      />
    </div>
  );
}

