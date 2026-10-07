"use client";

import { type ReactNode, useState, useRef, useEffect, useId, useCallback, cloneElement, isValidElement, memo } from "react";
import { createPortal } from "react-dom";
import { cn } from "./utils";

export type TooltipPosition = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  content: ReactNode;
  position?: TooltipPosition;
  delay?: number;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

const Tooltip = memo(function Tooltip({
  content,
  position = "top",
  delay = 200,
  children,
  className = "",
  disabled = false,
}: TooltipProps) {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const id = useId();
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setMounted(true);
  }, []);

  const enter = () => {
    if (disabled || !content) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    timerRef.current = setTimeout(() => setShow(true), delay);
  };

  const leave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShow(false), 120);
  };

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setShow(false);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    []
  );

  // Escape key dismiss listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismiss();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dismiss]);

  useEffect(() => {
    if (!show || !triggerRef.current) {
      setCoords(null);
      return;
    }

    const updatePosition = () => {
      if (!triggerRef.current || !tooltipRef.current) return;
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const gap = 6;
      const viewport = window.visualViewport;
      const leftEdge = viewport?.offsetLeft ?? 0;
      const topEdge = viewport?.offsetTop ?? 0;
      const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth);
      const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight);

      let top = 0;
      let left = 0;

      switch (position) {
        case "top":
          top = triggerRect.top - tooltipRect.height - gap;
          left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
          break;
        case "bottom":
          top = triggerRect.bottom + gap;
          left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
          break;
        case "left":
          top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
          left = triggerRect.left - tooltipRect.width - gap;
          break;
        case "right":
          top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
          left = triggerRect.right + gap;
          break;
      }

      // Boundary collision checking
      left = Math.max(leftEdge + gap, Math.min(left, rightEdge - tooltipRect.width - gap));

      if (top < topEdge + gap) {
        if (position === "top") {
          top = triggerRect.bottom + gap;
        } else {
          top = topEdge + gap;
        }
      } else if (top + tooltipRect.height > bottomEdge - gap) {
        if (position === "bottom") {
          top = triggerRect.top - tooltipRect.height - gap;
        } else {
          top = bottomEdge - tooltipRect.height - gap;
        }
      }

      top = Math.max(topEdge + gap, Math.min(top, bottomEdge - tooltipRect.height - gap));

      setCoords({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition, { passive: true });
    window.addEventListener("scroll", updatePosition, { capture: true, passive: true });
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, { capture: true });
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
    };
  }, [show, position]);

  return (
    <div
      ref={triggerRef}
      className={cn("relative inline-flex", className)}
      onMouseEnter={enter}
      onMouseLeave={leave}
      onFocus={enter}
      onBlur={dismiss}
    >
      {isValidElement<{ "aria-describedby"?: string }>(children)
        ? cloneElement(children, { "aria-describedby": [children.props["aria-describedby"], show && !disabled ? id : null].filter(Boolean).join(" ") || undefined })
        : children}
      {show &&
        mounted &&
        createPortal(
          <div
            ref={tooltipRef}
            id={id}
            role="tooltip"
            onMouseEnter={() => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); }}
            onMouseLeave={leave}
            className={cn(
              "fixed z-[var(--layer-tooltip)] max-w-[min(20rem,calc(100vw-1rem))] max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain px-2.5 py-1.5 text-xs font-medium leading-relaxed text-text bg-surface-elevated border border-border rounded-lg shadow-md whitespace-normal wrap-anywhere animate-scale-in transition-opacity duration-150",
              !coords && "opacity-0"
            )}
            style={{
              top: coords ? `${coords.top}px` : "0px",
              left: coords ? `${coords.left}px` : "0px",
            }}
          >
            {content}
          </div>,
          document.body
        )}
    </div>
  );
});

export default Tooltip;
