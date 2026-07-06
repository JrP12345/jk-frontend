"use client";

import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";
import { cn } from "./utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "warning" | "success";
type Size = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  children: ReactNode;
}

const base = "inline-flex items-center justify-center font-medium select-none cursor-pointer rounded-lg transition-all duration-300 ease-spring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.95] hover:scale-[1.01]";

const variants: Record<Variant, string> = {
  primary:   "bg-primary-600 text-white shadow-sm hover:bg-primary-500 hover:shadow-md active:bg-primary-700",
  secondary: "bg-surface-alt border border-border text-text hover:bg-surface-hover active:bg-surface-alt",
  outline:   "border border-border text-text hover:bg-surface-hover hover:border-text-secondary active:bg-surface-alt",
  ghost:     "text-text-secondary hover:bg-surface-hover hover:text-text active:bg-surface-alt",
  danger:    "bg-danger-600 text-white shadow-sm hover:bg-danger-500 hover:shadow-md active:bg-danger-700",
  warning:   "bg-warning-600 text-white shadow-sm hover:bg-warning-500 hover:shadow-md active:bg-warning-700",
  success:   "bg-success-600 text-white shadow-sm hover:bg-success-500 hover:shadow-md active:bg-success-700",
};

const sizes: Record<Size, string> = {
  xs: "h-7 px-2.5 text-xs gap-1 rounded-md",
  sm: "h-8 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-9 px-4 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-base gap-2 rounded-xl",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading = false, icon, iconRight, fullWidth = false, disabled, className = "", children, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)}
      {...rest}
    >
      {loading ? (
        <svg className="animate-spin-slow h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
        </svg>
      ) : icon ? (
        <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      ) : null}
      <span>{children}</span>
      {iconRight && !loading && <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{iconRight}</span>}
    </button>
  )
);

Button.displayName = "Button";
export default Button;
