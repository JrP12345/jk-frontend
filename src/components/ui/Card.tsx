"use client";

import { type ReactNode, useState, useRef } from "react";
import { cn } from "./utils";

interface CardProps {
  children: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
  className?: string;
  onClick?: () => void;
}

const paddings = { none: "", sm: "p-3 sm:p-4", md: "p-4 sm:p-5", lg: "p-5 sm:p-6" };

export default function Card({ children, padding = "md", hover = false, className = "", onClick }: CardProps) {
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCoords({ x, y });
  };

  const hasHoverEffect = hover || onClick;

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={hasHoverEffect ? handleMouseMove : undefined}
      onMouseEnter={hasHoverEffect ? () => setIsHovered(true) : undefined}
      onMouseLeave={hasHoverEffect ? () => setIsHovered(false) : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        "relative overflow-hidden bg-surface rounded-2xl border border-border shadow-sm transition-all duration-300 ease-out group",
        paddings[padding],
        onClick && "cursor-pointer active:scale-[0.99]",
        hasHoverEffect && "hover:shadow-md hover:border-primary-500/30 hover:-translate-y-0.5",
        className
      )}
    >
      {/* Dynamic Cursor Shine Overlay */}
      {hasHoverEffect && isHovered && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none animate-fade-in"
          style={{
            background: `radial-gradient(600px circle at ${coords.x}px ${coords.y}px, color-mix(in srgb, var(--color-primary-500) 8%, transparent), transparent 60%)`,
          }}
        />
      )}
      
      {/* Card Content - positioned above shine overlay */}
      <div className="relative z-10 w-full h-full flex flex-col">
        {children}
      </div>
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col space-y-1.5 pb-4 border-b border-border", className)}>{children}</div>;
}

export function CardTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("text-base font-semibold text-text", className)}>{children}</h3>;
}

export function CardDescription({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-sm text-text-secondary", className)}>{children}</p>;
}

export function CardContent({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cn("pt-4 flex-1", className)}>{children}</div>;
}

export function CardFooter({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex items-center justify-end gap-2 pt-4 border-t border-border mt-4", className)}>{children}</div>;
}

