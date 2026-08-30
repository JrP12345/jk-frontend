"use client";

import { type ButtonHTMLAttributes, type ReactNode, forwardRef, memo } from "react";
import { cn } from "./utils";
import Spinner from "./Spinner";

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
  "group relative inline-flex items-center justify-center font-medium select-none cursor-pointer rounded-xl transform-gpu transition-all duration-150 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 disabled:pointer-events-none disabled:transform-none active:scale-[0.98] hover:translate-y-[-1px] touch-manipulation min-h-[36px] sm:min-h-0";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-b from-primary-500 to-primary-600 text-white shadow-xs shadow-primary-500/20 hover:from-primary-400 hover:to-primary-500 hover:shadow-md hover:shadow-primary-500/30 active:from-primary-600 active:to-primary-700 border border-primary-400/30 overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/25 active:scale-[0.98]",
  secondary:
    "bg-surface-alt/90 backdrop-blur-sm border border-border/80 text-text shadow-xs hover:bg-surface-hover hover:border-border hover:shadow-sm active:bg-surface-alt active:scale-[0.98]",
  outline:
    "border border-border/80 bg-surface text-text shadow-xs hover:bg-surface-hover hover:border-border active:bg-surface-alt active:scale-[0.98]",
  ghost:
    "text-text-secondary hover:bg-surface-hover hover:text-text active:bg-surface-alt border border-transparent",
  danger:
    "bg-gradient-to-b from-danger-500 to-danger-600 text-white shadow-xs shadow-danger-500/20 hover:from-danger-400 hover:to-danger-500 hover:shadow-md hover:shadow-danger-500/30 active:from-danger-600 active:to-danger-700 border border-danger-400/30 overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/25 active:scale-[0.98]",
  warning:
    "bg-gradient-to-b from-warning-500 to-warning-600 text-white shadow-xs shadow-warning-500/20 hover:from-warning-400 hover:to-warning-500 hover:shadow-md hover:shadow-warning-500/30 active:from-warning-600 active:to-warning-700 border border-warning-400/30 overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/25 active:scale-[0.98]",
  success:
    "bg-gradient-to-b from-success-500 to-success-600 text-white shadow-xs shadow-success-500/20 hover:from-success-400 hover:to-success-500 hover:shadow-md hover:shadow-success-500/30 active:from-success-600 active:to-success-700 border border-success-400/30 overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/25 active:scale-[0.98]",
};

const sizes: Record<ButtonSize, string> = {
  xs: "h-7 px-2.5 text-xs gap-1.5 rounded-lg font-medium tracking-tight min-h-[32px] sm:min-h-[28px]",
  sm: "h-8 px-3 text-xs sm:text-sm gap-1.5 rounded-xl font-medium tracking-tight min-h-[36px] sm:min-h-[32px]",
  md: "h-9 px-4 text-sm gap-2 rounded-xl font-medium tracking-tight min-h-[40px] sm:min-h-[36px]",
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
            <Spinner
              size={size === "xs" ? "xs" : size === "sm" ? "sm" : size === "lg" ? "md" : "sm"}
              color="text-current"
              className="shrink-0"
            />
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


