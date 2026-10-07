"use client";

import { type ReactNode, createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useToastPosition } from "@/hooks/useToastPosition";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { cn } from "./utils";
import { vibrateFeedback } from "@/lib/haptics";
import { userFacingError } from "@/lib/userFacingError";

/* ─────────────────────────────────────────────────────────────────────────────
   Ekavyu notifications — accessible messages clear of application controls
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

export type ToastOptions = Omit<Toast, "id" | "duration" | "timestamp" | "variant"> & {
  id?: string;
  duration?: number;
  variant?: ToastVariant;
};

export interface ToastContextValue {
  hasActiveToasts: boolean;
  toast: (options: ToastOptions) => void;
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
  const [expanded, setExpanded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const position = useToastPosition(toasts.length > 0);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const update = () => setPageHidden(document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (toasts.length < 2) setExpanded(false);
    if (!toasts.length || (previousFocus.current && document.activeElement === document.body)) {
      setPaused(false);
      if (previousFocus.current?.isConnected) previousFocus.current.focus({ preventScroll: true });
      previousFocus.current = null;
    }
  }, [toasts]);

  const addToast = useCallback((options: ToastOptions) => {
    const now = Date.now();
    const id = options.id || "toast-" + now + "-" + Math.random().toString(36).slice(2, 7);
    const variant = options.variant || "default";
    options = { ...options,
      title: userFacingError(options.title, variant === "error" ? "Unable to complete the action" : "Notification"),
      description: options.description === undefined ? undefined : userFacingError(options.description, variant === "error" ? "Please try again. If the problem continues, contact support." : "Open the related page for details."),
    };
    if (variant === "success" || variant === "error") vibrateFeedback(variant);
    const requestedDuration = options.duration ?? 4500;
    const duration = requestedDuration >= 0 ? requestedDuration : 4500;
    setToasts(previous => {
      const duplicate = previous.find(item => options.id
        ? item.id === options.id
        : now - item.timestamp < 3500 && item.variant === variant && item.title === options.title && item.description === options.description);
      // A refresh starts a new countdown, even when messages arrive in the same millisecond.
      const timestamp = duplicate ? Math.max(now, duplicate.timestamp + 1) : now;
      const item: Toast = { ...options, id: duplicate?.id || id, variant, duration, timestamp };
      return duplicate ? [...previous.filter(old => old.id !== duplicate.id), item] : [...previous, item].slice(-3);
    });
  }, []);
  const dismiss = useCallback((id: string) => setToasts(previous => previous.filter(item => item.id !== id)), []);
  const clearAll = useCallback(() => setToasts([]), []);
  const newest = toasts.at(-1);
  return <ToastContext.Provider value={{ toast: addToast, dismiss, clearAll, hasActiveToasts: toasts.length > 0 }}>
    {children}
    {mounted && createPortal(<>
      <div data-overlay-live className="sr-only" role="status" aria-live="polite" aria-atomic="true">{newest ? newest.title + (newest.description ? ". " + newest.description : "") : ""}</div>
      {newest && <div ref={regionRef} data-overlay-live role="region" aria-label="Notifications" style={position}
        onMouseEnter={() => setPaused(true)} onMouseLeave={() => { if (!regionRef.current?.contains(document.activeElement)) setPaused(false); }}
        onFocusCapture={event => { setPaused(true); if (!regionRef.current?.contains(event.relatedTarget as Node)) previousFocus.current = event.relatedTarget as HTMLElement | null; }}
        onBlurCapture={event => { if (!regionRef.current?.contains(event.relatedTarget as Node)) { setPaused(false); previousFocus.current = null; } }}
        className="toast-region fixed left-1/2 -translate-x-1/2 z-[var(--layer-toast)] flex flex-col w-[calc(100vw-2rem)] max-w-[390px] pointer-events-none">
        <div id="transient-notification-list" className="flex flex-col gap-2 min-h-0 p-3 -m-3 overflow-y-auto overscroll-contain pointer-events-auto">
          {[...toasts].reverse().map((item, index) => <div key={item.id} hidden={!expanded && index > 0}><ToastItem {...item} onDismiss={() => dismiss(item.id)} isHoveredStack={paused || expanded || pageHidden || index > 0} /></div>)}
        </div>
        {toasts.length > 1 && <div className="flex items-center justify-center gap-2 mt-2 shrink-0 pointer-events-auto">
          <button type="button" aria-expanded={expanded} aria-controls="transient-notification-list" onClick={() => setExpanded(value => !value)}
            className="min-h-11 px-3 rounded-xl text-xs font-medium bg-surface text-text-secondary border border-border shadow-sm cursor-pointer hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
            {expanded ? "Show latest" : "Show " + (toasts.length - 1) + " more"}
          </button>
          {expanded && <button type="button" onClick={clearAll} className="min-h-11 px-3 rounded-xl text-xs font-medium bg-surface text-text-secondary border border-border shadow-sm cursor-pointer hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">Clear all</button>}
        </div>}
      </div>}
    </>, document.body)}
  </ToastContext.Provider>;
}

const icons: Record<ToastVariant, ReactNode> = {
  default: (
    <div className="w-8 h-8 rounded-xl bg-primary-500/10 border border-primary-500/30 flex items-center justify-center text-accent shrink-0">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
      </svg>
    </div>
  ),
  info: (
    <div className="w-8 h-8 rounded-xl bg-primary/10 border border-accent/30 flex items-center justify-center text-accent shrink-0">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
      </svg>
    </div>
  ),
  success: (
    <div className="w-8 h-8 rounded-xl bg-success/10 border border-success/30 flex items-center justify-center text-success-text shrink-0">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a10 10 0 11-20 0 10 10 0 0120 0z" />
      </svg>
    </div>
  ),
  error: (
    <div className="w-8 h-8 rounded-xl bg-danger/10 border border-danger/30 flex items-center justify-center text-danger-text shrink-0">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a10 10 0 11-20 0 10 10 0 0120 0z" />
      </svg>
    </div>
  ),
  warning: (
    <div className="w-8 h-8 rounded-xl bg-warning/10 border border-warning/30 flex items-center justify-center text-warning-text shrink-0">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 2l10 18H2L12 2z" />
      </svg>
    </div>
  ),
};

const variantBorders: Record<ToastVariant, string> = {
  default: "border-border/80 ",
  info: "border-accent/30 ",
  success: "border-success/30 shadow-success/10",
  error: "border-danger/30 shadow-danger/10",
  warning: "border-warning/30 shadow-warning/10",
};

const progressColors: Record<ToastVariant, string> = {
  default: "bg-primary-500",
  info: "bg-primary",
  success: "bg-success",
  error: "bg-danger",
  warning: "bg-warning",
};

/* ── Toast Item Component ──────────────────────────────────────────────────── */

interface ToastItemProps extends Toast { onDismiss: () => void; isHoveredStack: boolean; }

function ToastItem({ title, description, variant, duration, timestamp, onDismiss, isHoveredStack }: ToastItemProps) {
  const [exiting, setExiting] = useState(false);
  const gesture = useSwipeGesture({ axis: "x", enabled: !exiting, threshold: 64, onSwipe: () => setExiting(true) });
  const remaining = useRef(duration);
  const dismissRef = useRef(onDismiss);
  useEffect(() => { dismissRef.current = onDismiss; }, [onDismiss]);
  useEffect(() => { remaining.current = duration; setExiting(false); }, [timestamp, duration]);
  useEffect(() => {
    if (isHoveredStack || gesture.dragging || exiting || duration === Infinity) return;
    const started = Date.now();
    const timer = setTimeout(() => setExiting(true), remaining.current);
    return () => { clearTimeout(timer); remaining.current = Math.max(0, remaining.current - (Date.now() - started)); };
  }, [isHoveredStack, gesture.dragging, exiting, timestamp, duration]);
  useEffect(() => {
    if (!exiting) return;
    const timer = setTimeout(() => dismissRef.current(), 180);
    return () => clearTimeout(timer);
  }, [exiting, timestamp]);
  return <div role="group" aria-label={title}
    {...gesture.handlers}
    className={cn("relative flex items-start gap-3 border rounded-2xl p-3 bg-surface-elevated shadow-lg overflow-hidden [touch-action:pan-y_pinch-zoom] transition-[opacity,transform] duration-[var(--motion-standard)]", variantBorders[variant], exiting ? "animate-toast-exit opacity-0" : "animate-toast-enter")}
    style={{ translate: gesture.offset ? `${gesture.offset}px 0` : undefined, transition: gesture.dragging ? "none" : undefined }}>
    {icons[variant]}
    <div className="flex-1 min-w-0 pt-0.5 break-words">
      <p className="text-sm font-semibold text-text leading-snug">{title}</p>
      {description && <p className="text-xs text-text-secondary mt-1 leading-relaxed">{description}</p>}
    </div>
    <button type="button" aria-disabled={exiting} onClick={() => { if (!exiting) setExiting(true); }} aria-label="Dismiss notification"
      className="shrink-0 w-11 h-11 -mt-1 -mr-1 flex items-center justify-center rounded-xl text-text-muted hover:text-text hover:bg-surface-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 4l8 8M12 4l-8 8" /></svg>
    </button>
    {duration !== Infinity && <div key={timestamp} aria-hidden="true" className={cn("absolute bottom-0 left-0 h-0.5 opacity-60 animate-toast-progress", progressColors[variant])} style={{ animationDuration: duration + "ms", animationPlayState: isHoveredStack || gesture.dragging || exiting ? "paused" : "running" }} />}
  </div>;
}
