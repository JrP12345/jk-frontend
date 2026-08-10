"use client";

import { type ReactNode, createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "./utils";

/* ─────────────────────────────────────────────────────────────────────────────
   ANANTA Healthcare OS — Production-Grade 3D Stacked Toast Notification Engine
   ───────────────────────────────────────────────────────────────────────────── */

export type ToastVariant = "default" | "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
  timestamp: number;
}

export interface ToastContextValue {
  toast: (options: Omit<Toast, "id" | "duration" | "timestamp"> & { id?: string; duration?: number; variant?: ToastVariant }) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

/* ── ToastProvider ──────────────────────────────────────────────────────────── */

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => setMounted(true), []);

  const addToast = useCallback(
    (options: Omit<Toast, "id" | "duration" | "timestamp"> & { id?: string; duration?: number; variant?: ToastVariant }) => {
      const now = Date.now();
      const id = options.id || `toast-${now}-${Math.random().toString(36).substring(2, 7)}`;
      const variant = options.variant || "default";
      const duration = options.duration || 4500;

      setToasts((prev) => {
        // If an explicit ID matches an active toast, update it cleanly
        if (options.id && prev.some((t) => t.id === options.id)) {
          return prev.map((t) => (t.id === options.id ? { ...t, ...options, duration, timestamp: now } : t));
        }
        // Cap max active toasts at 4 to maintain compact, clean stacking without screen overflow
        const updated = [...prev, { ...options, id, variant, duration, timestamp: now } as Toast];
        return updated.slice(-4);
      });
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast, dismiss, clearAll }}>
      {children}
      {mounted &&
        createPortal(
          <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="fixed bottom-5 right-5 z-[9999] p-4 -m-4 flex flex-col items-end w-[92vw] sm:w-[360px] pointer-events-none select-none"
          >
            {/* Stable Stack Container */}
            <div className="relative w-full min-h-[64px]">
              {toasts.map((t, index) => {
                const total = toasts.length;
                const depth = total - 1 - index; // 0 = newest front toast (depth 0), 1 = behind (depth 1)
                const isVisible = isHovered || depth < 3;

                // Continuous Hardware Accelerated Transforms:
                // Collapsed: depth 0 = 0px, depth 1 = -8px, depth 2 = -16px
                // Expanded: depth 0 = 0px, depth 1 = -92px, depth 2 = -184px, depth 3 = -276px (16px distinct gap between cards)
                const translateY = isHovered ? -depth * 92 : -depth * 8;
                const scale = isHovered ? 1 : Math.max(0.88, 1 - depth * 0.04);
                const opacity = isVisible ? (isHovered ? 1 : Math.max(0.45, 1 - depth * 0.22)) : 0;

                return (
                  <div
                    key={t.id}
                    className="absolute bottom-0 right-0 w-full pointer-events-auto transition-all duration-350 ease-[cubic-bezier(0.32,0.72,0,1)] transform-gpu"
                    style={{
                      transform: `translate3d(0, ${translateY}px, 0) scale(${scale})`,
                      opacity: opacity,
                      zIndex: 100 - depth,
                      transformOrigin: "bottom right",
                    }}
                  >
                    <ToastItem {...t} onDismiss={() => dismiss(t.id)} isHoveredStack={isHovered} />
                  </div>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

/* ── Status Icons ──────────────────────────────────────────────────────────── */

const icons: Record<ToastVariant, ReactNode> = {
  default: (
    <div className="w-8 h-8 rounded-xl bg-primary-500/10 border border-primary-500/30 flex items-center justify-center text-primary-500 shrink-0">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
      </svg>
    </div>
  ),
  info: (
    <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-500 shrink-0">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
      </svg>
    </div>
  ),
  success: (
    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a10 10 0 11-20 0 10 10 0 0120 0z" />
      </svg>
    </div>
  ),
  error: (
    <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a10 10 0 11-20 0 10 10 0 0120 0z" />
      </svg>
    </div>
  ),
  warning: (
    <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 2l10 18H2L12 2z" />
      </svg>
    </div>
  ),
};

const variantBorders: Record<ToastVariant, string> = {
  default: "border-border/80 shadow-black/40",
  info: "border-sky-500/30 shadow-sky-500/10",
  success: "border-emerald-500/30 shadow-emerald-500/10",
  error: "border-rose-500/30 shadow-rose-500/10",
  warning: "border-amber-500/30 shadow-amber-500/10",
};

const progressColors: Record<ToastVariant, string> = {
  default: "bg-primary-500",
  info: "bg-sky-500",
  success: "bg-emerald-500",
  error: "bg-rose-500",
  warning: "bg-amber-500",
};

/* ── Toast Item Component ──────────────────────────────────────────────────── */

interface ToastItemProps extends Toast {
  onDismiss: () => void;
  isHoveredStack: boolean;
}

function ToastItem({ id, title, description, variant, duration, onDismiss, isHoveredStack }: ToastItemProps) {
  const [exiting, setExiting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startXRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPaused = paused || isHoveredStack;

  // Auto Dismiss Timer with pause support
  useEffect(() => {
    if (isPaused) return;
    timerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 180);
    }, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [duration, onDismiss, isPaused]);

  // Window Drag Listeners
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startXRef.current;
      setDragX(diff);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (Math.abs(dragX) > 100) {
        setExiting(true);
        setTimeout(onDismiss, 150);
      } else {
        setDragX(0);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragX, onDismiss]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    startXRef.current = e.clientX;
    setIsDragging(true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const diff = e.touches[0].clientX - startXRef.current;
    setDragX(diff);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (Math.abs(dragX) > 100) {
      setExiting(true);
      setTimeout(onDismiss, 150);
    } else {
      setDragX(0);
    }
  };

  const triggerDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExiting(true);
    setTimeout(onDismiss, 180);
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={cn(
        "relative flex items-start gap-3 border rounded-2xl p-3 px-3.5 shadow-2xl backdrop-blur-xl bg-surface/95 dark:bg-surface/90 cursor-grab active:cursor-grabbing select-none overflow-hidden transform-gpu transition-all duration-200",
        variantBorders[variant],
        exiting ? "animate-toast-exit opacity-0 scale-95 translate-x-4" : "animate-toast-enter"
      )}
      style={{
        transform: dragX !== 0 ? `translateX(${dragX}px)` : undefined,
        opacity: dragX !== 0 ? Math.max(0, 1 - Math.abs(dragX) / 250) : undefined,
        transition: isDragging ? "none" : undefined,
      }}
      role="status"
      aria-live="polite"
    >
      {/* Icon */}
      {icons[variant]}

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-xs font-bold text-text tracking-tight leading-snug">{title}</p>
        {description && <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">{description}</p>}
      </div>

      {/* Dismiss Button */}
      <button
        type="button"
        onClick={triggerDismiss}
        onMouseDown={(e) => e.stopPropagation()}
        className="shrink-0 p-1 rounded-lg cursor-pointer text-text-muted hover:text-text hover:bg-surface-hover transition-colors focus-visible:outline-none"
        aria-label="Dismiss notification"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M3 3l8 8M11 3l-8 8" strokeLinecap="round" />
        </svg>
      </button>

      {/* Progress Countdown Bar */}
      <div
        className={cn(
          "absolute bottom-0 left-0 h-0.5 rounded-b-2xl opacity-70 animate-toast-progress",
          progressColors[variant]
        )}
        style={{
          animationDuration: `${duration}ms`,
          animationPlayState: isPaused ? "paused" : "running",
        }}
      />
    </div>
  );
}
