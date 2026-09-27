"use client";

import { type ReactNode, memo } from "react";
import { cn } from "./utils";
import Spinner from "./Spinner";

export type CardVariant = "default" | "outline" | "flat" | "glass";
export type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps {
  children: ReactNode;
  padding?: CardPadding;
  variant?: CardVariant;
  hover?: boolean;
  className?: string;
  onClick?: () => void;
  role?: "button" | "group";
  loading?: boolean;
  loadingText?: string;
}

const paddings: Record<CardPadding, string> = {
  none: "",
  sm: "p-3 sm:p-4",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
};

const variants: Record<CardVariant, string> = {
  default: "bg-surface border border-border/80 shadow-xs hover:border-border transition-all duration-200",
  outline: "bg-transparent border border-border/70",
  flat: "bg-surface-alt border border-border/40",
  glass: "bg-surface-elevated border border-border shadow-sm",
};

const Card = memo(function Card({
  children,
  padding = "md",
  variant = "default",
  hover = false,
  className = "",
  onClick,
  role = onClick ? "button" : undefined,
  loading = false,
  loadingText,
}: CardProps) {
  const hasHoverEffect = hover || !!onClick;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (onClick && e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={onClick && role === "button" ? handleKeyDown : undefined}
      role={role}
      tabIndex={onClick && role === "button" ? 0 : undefined}
      className={cn(
        "relative overflow-hidden rounded-2xl transform-gpu transition-all duration-250 ease-smooth group",
        variants[variant],
        paddings[padding],
        onClick &&
          "cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        hasHoverEffect && "hover:shadow-sm hover:border-accent/50",
        className
      )}
    >
      {/* Card Content */}
      <div className={cn("relative z-10 w-full h-full flex flex-col transition-opacity duration-200", loading && "opacity-40 pointer-events-none")}>
        {children}
      </div>

      {/* Contextual Card Loading Overlay */}
      {loading && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-surface/70 dark:bg-surface  p-4 text-center animate-fade-in"
          role="status"
          aria-live="polite"
        >
          <Spinner size="md" label={loadingText} />
        </div>
      )}
    </div>
  );
});

export default Card;

export const CardHeader = memo(function CardHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col space-y-1.5 pb-3 sm:pb-4 border-b border-border/60", className)}>{children}</div>;
});

export const CardTitle = memo(function CardTitle({ children, className = "", as: Heading = "h3" }: { children: ReactNode; className?: string; as?: "h1" | "h2" | "h3" }) {
  return <Heading className={cn("text-base font-semibold text-text tracking-tight", className)}>{children}</Heading>;
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
