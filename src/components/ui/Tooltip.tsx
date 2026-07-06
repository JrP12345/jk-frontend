"use client";

import { type ReactNode, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "./utils";

type TooltipPosition = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  content: ReactNode;
  position?: TooltipPosition;
  delay?: number;
  children: ReactNode;
  className?: string;
}

export default function Tooltip({
  content,
  position = "top",
  delay = 200,
  children,
  className = "",
}: TooltipProps) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const enter = () => {
    timerRef.current = setTimeout(() => setShow(true), delay);
  };
  const leave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShow(false);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  useEffect(() => {
    if (!show || !triggerRef.current) {
      setCoords(null);
      return;
    }

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const triggerRect = triggerRef.current.getBoundingClientRect();
      
      let top = 0;
      let left = 0;

      const tooltipEl = tooltipRef.current;
      if (!tooltipEl) return;
      const tooltipRect = tooltipEl.getBoundingClientRect();

      const gap = 6;

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
          top = triggerRect.bottom + gap; // Flip to bottom
        } else {
          top = gap;
        }
      } else if (top + tooltipRect.height > window.innerHeight - gap) {
        if (position === "bottom") {
          top = triggerRect.top - tooltipRect.height - gap; // Flip to top
        } else {
          top = window.innerHeight - tooltipRect.height - gap;
        }
      }

      setCoords({ top, left });
    };

    updatePosition();
    // Re-adjust position on window resize and scroll
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, { passive: true });

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
      {show && typeof window !== "undefined" && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          className={cn(
            "fixed z-50 px-2.5 py-1.5 text-xs font-semibold text-text bg-surface border border-border rounded-lg shadow-xl pointer-events-none animate-scale-in backdrop-blur-md bg-surface/95 transition-opacity duration-150",
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
}

