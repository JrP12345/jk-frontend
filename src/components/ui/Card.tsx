"use client";

import { type ReactNode, useState, useRef, memo } from "react";
import { cn } from "./utils";

export type CardVariant = "default" | "outline" | "flat" | "glass";
export type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps {
  children: ReactNode;
  padding?: CardPadding;
  variant?: CardVariant;
  hover?: boolean;
  className?: string;
  onClick?: () => void;
}

const paddings: Record<CardPadding, string> = {
  none: "",
  sm: "p-3 sm:p-4",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
};

const variants: Record<CardVariant, string> = {
  default: "bg-surface border border-border/80 shadow-2xs",
  outline: "bg-transparent border border-border/70",
  flat: "bg-surface-alt/70 border border-transparent",
  glass: "bg-surface/85 backdrop-blur-xl border border-border/80 shadow-xs",
};

const Card = memo(function Card({
  children,
  padding = "md",
  variant = "default",
  hover = false,
  className = "",
  onClick,
}: CardProps) {
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

  const hasHoverEffect = hover || !!onClick;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (onClick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      onMouseMove={hasHoverEffect ? handleMouseMove : undefined}
      onMouseEnter={hasHoverEffect ? () => setIsHovered(true) : undefined}
      onMouseLeave={hasHoverEffect ? () => setIsHovered(false) : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        "relative overflow-hidden rounded-2xl transform-gpu transition-all duration-250 ease-smooth group",
        variants[variant],
        paddings[padding],
        onClick &&
          "cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/15 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        hasHoverEffect && "hover:shadow-md hover:shadow-black/5 hover:border-border hover:-translate-y-0.5",
        className
      )}
    >
      {/* Dynamic Cursor Shine Overlay */}
      {hasHoverEffect && isHovered && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-300"
          style={{
            background: `radial-gradient(500px circle at ${coords.x}px ${coords.y}px, color-mix(in srgb, var(--color-primary-500) 7%, transparent), transparent 60%)`,
          }}
        />
      )}

      {/* Card Content */}
      <div className="relative z-10 w-full h-full flex flex-col">{children}</div>
    </div>
  );
});

export default Card;

export const CardHeader = memo(function CardHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col space-y-1.5 pb-3 sm:pb-4 border-b border-border/60", className)}>{children}</div>;
});

export const CardTitle = memo(function CardTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("text-base font-semibold text-text tracking-tight", className)}>{children}</h3>;
});

export const CardDescription = memo(function CardDescription({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-xs sm:text-sm text-text-secondary leading-relaxed", className)}>{children}</p>;
});

export const CardContent = memo(function CardContent({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cn("pt-3 sm:pt-4 flex-1", className)}>{children}</div>;
});

export const CardFooter = memo(function CardFooter({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-end gap-2 pt-3 sm:pt-4 border-t border-border/60 mt-3 sm:mt-4", className)}>
      {children}
    </div>
  );
});



