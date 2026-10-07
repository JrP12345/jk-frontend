"use client";

import { type ReactNode, memo } from "react";
import { cn } from "./utils";
import Spinner from "./Spinner";

export type CardVariant = "default" | "outline" | "flat";
export type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps {
  children: ReactNode;
  padding?: CardPadding;
  variant?: CardVariant;
  hover?: boolean;
  className?: string;
  contentClassName?: string;
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
  default: "bg-surface border border-border shadow-xs",
  outline: "bg-transparent border border-border/70",
  flat: "bg-surface-alt border border-transparent",
};

const Card = memo(function Card({
  children,
  padding = "md",
  variant = "default",
  hover = false,
  className = "",
  contentClassName,
  onClick,
  role = onClick ? "button" : undefined,
  loading = false,
  loadingText,
}: CardProps) {
  const hasHoverEffect = !loading && (hover || !!onClick);
  const hasBasePadding = /(?:^|\s)p-/.test(className);
  const hasResponsivePadding = /(?:^|\s)(?:[a-z0-9-]+:)+p-/.test(className);
  const defaultPadding = hasBasePadding ? "" : hasResponsivePadding ? paddings[padding].split(" ")[0] : paddings[padding];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (onClick && e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      onClick={loading ? undefined : onClick}
      onKeyDown={!loading && onClick && role === "button" ? handleKeyDown : undefined}
      role={role}
      aria-busy={loading || undefined}
      aria-disabled={role === "button" && loading ? true : undefined}
      tabIndex={onClick && role === "button" ? loading ? -1 : 0 : undefined}
      className={cn(
        "relative overflow-hidden rounded-container transition-[background-color,border-color,box-shadow] duration-[var(--motion-standard)] ease-smooth group",
        variants[variant],
        defaultPadding,
        onClick && !loading &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        hasHoverEffect && "hover:shadow-sm hover:border-accent/50",
        className
      )}
    >
      {/* Card Content */}
      <div inert={loading || undefined} className={cn("relative z-10 w-full h-full flex flex-col transition-opacity duration-200", loading && "opacity-40 pointer-events-none", contentClassName)}>
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
  const hasHeadingScale = /(?:^|\s)(?:page-title|section-title)(?=\s|$)/.test(className);
  return <Heading className={cn(!hasHeadingScale && "text-base", "font-semibold text-text tracking-tight", className)}>{children}</Heading>;
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
