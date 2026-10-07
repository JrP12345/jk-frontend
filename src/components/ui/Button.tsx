"use client";

import { type ButtonHTMLAttributes, type ReactNode, forwardRef, memo, useState, useRef, useLayoutEffect, useImperativeHandle } from "react";
import { vibrateFeedback } from "@/lib/haptics";
import { cn } from "./utils";
import { InlineLoader } from "./Spinner";

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
  "group relative inline-flex min-w-0 max-w-full items-center justify-center font-medium leading-snug text-center select-none cursor-pointer rounded-control transition-[color,background-color,border-color,box-shadow,opacity] duration-[var(--motion-fast)] ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none touch-manipulation min-h-[44px] md:min-h-0";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary border border-transparent shadow-xs hover:bg-primary-hover active:bg-primary-active",
  secondary:
    "bg-surface-alt border border-border hover:bg-surface-hover active:bg-active",
  outline:
    "border border-input-border bg-surface hover:bg-surface-hover hover:border-border-focus active:bg-active",
  ghost:
    "hover:bg-surface-hover hover:text-text active:bg-surface-alt border border-transparent",
  danger:
    "bg-error-text shadow-xs hover:brightness-95 active:brightness-90 border border-transparent",
  warning:
    "bg-warning-text shadow-xs hover:brightness-95 active:brightness-90 border border-transparent",
  success:
    "bg-success-text shadow-xs hover:brightness-95 active:brightness-90 border border-transparent",
};

const foregrounds: Record<ButtonVariant, string> = {
  primary: "text-brand-mist", secondary: "text-text", outline: "text-text",
  ghost: "text-text-secondary", danger: "text-background",
  warning: "text-background", success: "text-background",
};

// cn joins utilities without merging conflicts. Respect a caller's semantic
// foreground so a status-colored action keeps readable text in both modes.
const semanticForeground = /(?:^|\s)text-(?:background|accent|text(?:-primary|-secondary|-muted)?|brand-(?:mist|ink|primary|secondary|soft|warm)|(?:success|warning|danger|error)(?:-text)?)(?:\/\d+)?(?=\s|$)/;

const sizes: Record<ButtonSize, string> = {
  xs: "px-2.5 py-1 text-xs gap-1.5 rounded-lg font-medium tracking-tight min-h-[44px] md:min-h-[28px]",
  sm: "px-3.5 py-1 text-xs md:text-sm gap-1.5 rounded-control font-medium tracking-tight min-h-[44px] md:min-h-[32px]",
  md: "px-4 py-1.5 text-sm gap-2 rounded-control font-medium tracking-tight min-h-[44px] md:min-h-[36px]",
  lg: "px-5 py-2 text-base gap-2.5 rounded-control font-medium tracking-tight min-h-[48px] md:min-h-[44px]",
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
        loading: controlledLoading = false,
        loadingText,
        icon,
        iconRight,
        fullWidth = false,
        disabled,
        className = "",
        children,
        type = "button",
        onClick,
        ...rest
      },
      ref
    ) => {
      const [pending, setPending] = useState(false);
      const pendingRef = useRef(false);
      const elementRef = useRef<HTMLButtonElement>(null);
      const mountedRef = useRef(true);
      useImperativeHandle(ref, () => elementRef.current!, []);
      useLayoutEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
      const loading = controlledLoading || pending;
      const isBasicallyDisabled = disabled || loading;
      const spinnerSize = size === "xs" ? "xs" : "sm";

      return (
        <button
          data-touch-control
          ref={elementRef}
          type={type}
          disabled={isBasicallyDisabled}
          aria-busy={loading ? "true" : undefined}
          aria-disabled={isBasicallyDisabled ? "true" : undefined}
          className={cn(
            base,
            variants[variant],
            !semanticForeground.test(className) && foregrounds[variant],
            sizes[size],
            fullWidth && "w-full",
            !loading && "disabled:opacity-50",
            loading && "cursor-wait select-none",
            className
          )}
          {...rest}
          aria-label={rest["aria-label"] || (loading ? loadingText : undefined)}
          onClick={(event) => {
            if (isBasicallyDisabled || pendingRef.current) return;
            vibrateFeedback("selection");
            const result: unknown = onClick?.(event);
            // Async click actions share feedback even without caller-managed state.
            if (result && typeof (result as PromiseLike<unknown>).then === "function") {
              pendingRef.current = true;
              setPending(true);
              const release = () => { pendingRef.current = false; if (mountedRef.current) setPending(false); };
              Promise.resolve(result).then(release, release);
            }
          }}
        >
          <span className="grid min-w-0 max-w-full items-center gap-[inherit]">
            <span className={cn("[grid-area:1/1] inline-flex min-w-0 max-w-full items-center justify-center gap-[inherit]", loading && "invisible")} aria-hidden={loading || undefined}>
              {icon ? (
                <span className={cn("shrink-0 inline-flex items-center justify-center", iconSizes[size])}>
                  {icon}
                </span>
              ) : null}

              {children && (
                <span className="inline-flex min-w-0 max-w-full items-center justify-center gap-1.5 text-center whitespace-normal wrap-anywhere [&>span]:min-w-0 [&>svg]:shrink-0">
                  {children}
                </span>
              )}

              {iconRight && (
                <span className={cn("shrink-0 inline-flex items-center justify-center transition-transform duration-150 group-hover:scale-105", iconSizes[size])}>{iconRight}</span>
              )}
            </span>
            {loading && (
              <span className="[grid-area:1/1] inline-flex min-w-0 max-w-full items-center justify-center gap-[inherit]">
                <InlineLoader
                  size={spinnerSize}
                  color="text-current"
                  label={<span className="[&_svg]:hidden [&_[data-button-icon]]:hidden">{loadingText || children}</span>}
                  inheritTypography
                  className="max-w-full"
                />
              </span>
            )}
          </span>
        </button>
      );
    }
  )
);

Button.displayName = "Button";
export default Button;
