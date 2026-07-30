"use client";

import { type ButtonHTMLAttributes, type ReactNode, forwardRef, memo } from "react";
import { cn } from "./utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "warning" | "success";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  children?: ReactNode;
}

const base =
  "group relative inline-flex items-center justify-center font-medium select-none cursor-pointer rounded-lg transform-gpu transition-all duration-200 ease-spring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 disabled:pointer-events-none disabled:transform-none active:scale-[0.96] hover:scale-[1.01] touch-manipulation min-h-[36px] sm:min-h-0";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-600 text-white shadow-xs shadow-primary-500/20 hover:bg-primary-500 hover:shadow-md hover:shadow-primary-500/25 active:bg-primary-700 border border-primary-500/30",
  secondary:
    "bg-surface-alt border border-border text-text shadow-2xs hover:bg-surface-hover hover:border-border-focus hover:shadow-xs active:bg-surface-alt",
  outline:
    "border border-border/80 text-text hover:bg-surface-hover hover:border-text-secondary active:bg-surface-alt",
  ghost:
    "text-text-secondary hover:bg-surface-hover hover:text-text active:bg-surface-alt",
  danger:
    "bg-danger-600 text-white shadow-xs shadow-danger-500/20 hover:bg-danger-500 hover:shadow-md hover:shadow-danger-500/25 active:bg-danger-700 border border-danger-500/30",
  warning:
    "bg-warning-600 text-white shadow-xs shadow-warning-500/20 hover:bg-warning-500 hover:shadow-md hover:shadow-warning-500/25 active:bg-warning-700 border border-warning-500/30",
  success:
    "bg-success-600 text-white shadow-xs shadow-success-500/20 hover:bg-success-500 hover:shadow-md hover:shadow-success-500/25 active:bg-success-700 border border-success-500/30",
};

const sizes: Record<ButtonSize, string> = {
  xs: "h-7 px-2.5 text-xs gap-1.5 rounded-md font-medium tracking-tight min-h-[32px] sm:min-h-[28px]",
  sm: "h-8 px-3 text-xs sm:text-sm gap-1.5 rounded-lg font-medium tracking-tight min-h-[36px] sm:min-h-[32px]",
  md: "h-9 px-4 text-sm gap-2 rounded-lg font-medium tracking-tight min-h-[40px] sm:min-h-[36px]",
  lg: "h-11 px-5 text-base gap-2.5 rounded-xl font-medium tracking-tight min-h-[44px]",
};

const iconSizes: Record<ButtonSize, string> = {
  xs: "[&>svg]:h-3.5 [&>svg]:w-3.5 h-3.5 w-3.5",
  sm: "[&>svg]:h-4 [&>svg]:w-4 h-4 w-4",
  md: "[&>svg]:h-4 [&>svg]:w-4 h-4 w-4",
  lg: "[&>svg]:h-5 [&>svg]:w-5 h-5 w-5",
};

const Button = memo(
  forwardRef<HTMLButtonElement, ButtonProps>(
    (
      {
        variant = "primary",
        size = "md",
        loading = false,
        loadingText,
        icon,
        iconRight,
        fullWidth = false,
        disabled,
        className = "",
        children,
        type = "button",
        ...rest
      },
      ref
    ) => {
      const isBasicallyDisabled = disabled || loading;

      return (
        <button
          ref={ref}
          type={type}
          disabled={isBasicallyDisabled}
          aria-busy={loading || undefined}
          aria-disabled={isBasicallyDisabled || undefined}
          className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)}
          {...rest}
        >
          {loading ? (
            <svg
              className={cn("animate-spin-smooth origin-center shrink-0 transition-opacity duration-200", iconSizes[size])}
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-85" />
            </svg>
          ) : icon ? (
            <span className={cn("shrink-0 inline-flex items-center justify-center transition-transform duration-150 group-hover:scale-105", iconSizes[size])}>{icon}</span>
          ) : null}

          {children && (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap truncate max-w-full">
              {loading && loadingText ? loadingText : children}
            </span>
          )}

          {iconRight && !loading && (
            <span className={cn("shrink-0 inline-flex items-center justify-center transition-transform duration-150 group-hover:scale-105", iconSizes[size])}>{iconRight}</span>
          )}
        </button>
      );
    }
  )
);

Button.displayName = "Button";
export default Button;


