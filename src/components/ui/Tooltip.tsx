"use client";

import { type ReactNode, useState, useRef, useEffect, memo } from "react";
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
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setMounted(true);
  }, []);

  const enter = () => {
    if (disabled || !content) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShow(true), delay);
  };

  const leave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShow(false);
  };

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  // Escape key dismiss listener
  useEffect(() => {
    if (!show) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        leave();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [show]);

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
      if (left < gap) {
        left = gap;
      } else if (left + tooltipRect.width > window.innerWidth - gap) {
        left = window.innerWidth - tooltipRect.width - gap;
      }

      if (top < gap) {
        if (position === "top") {
          top = triggerRect.bottom + gap;
        } else {
          top = gap;
        }
      } else if (top + tooltipRect.height > window.innerHeight - gap) {
        if (position === "bottom") {
          top = triggerRect.top - tooltipRect.height - gap;
        } else {
          top = window.innerHeight - tooltipRect.height - gap;
        }
      }

      setCoords({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition, { passive: true });
    window.addEventListener("scroll", updatePosition, { capture: true, passive: true });

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, [show, position]);

  return (
    <div
      ref={triggerRef}
      className={cn("relative inline-flex", className)}
      onMouseEnter={enter}
      onMouseLeave={leave}
      onFocus={enter}
      onBlur={leave}
    >
      {children}
      {show &&
        mounted &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            className={cn(
              "fixed z-50 px-2.5 py-1.5 text-xs font-semibold text-text bg-surface/95 backdrop-blur-xl border border-border/80 rounded-xl shadow-xl pointer-events-none animate-scale-in transform-gpu transition-opacity duration-150 select-none",
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



