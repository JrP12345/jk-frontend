"use client";

import { type InputHTMLAttributes, type ReactNode, forwardRef, useId } from "react";
import { cn } from "./utils";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  hint?: string;
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  onClear?: () => void;
}

const sizes = {
  sm: "h-8 text-sm px-3",
  md: "h-9 text-sm px-3.5",
  lg: "h-11 text-base px-4",
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, size = "md", icon, iconRight, fullWidth = true, disabled, className = "", id: propId, onClear, ...rest }, ref) => {
    const autoId = useId();
    const id = propId || autoId;
    const hasClear = !!(onClear && rest.value);

    return (
      <div className={cn("flex flex-col gap-1.5", fullWidth && "w-full")}>
        {label && <label htmlFor={id} className="text-sm font-medium text-text">{label}</label>}
        <div className="relative">
          {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors duration-200 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
          <input
            ref={ref}
            id={id}
            disabled={disabled}
            className={cn(
              "w-full rounded-lg border bg-surface font-normal transition-all duration-300 ease-spring placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-alt",
              sizes[size],
              icon && "pl-10",
              (iconRight || hasClear) ? "pr-10" : "",
              error ? "border-danger-500 focus:ring-2 focus:ring-danger-500/15 focus:border-danger-500" : "border-border focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15",
              className,
            )}
            {...rest}
          />
          {hasClear ? (
            <button
              type="button"
              onClick={onClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text cursor-pointer transition-colors duration-200"
              aria-label="Clear input"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : iconRight ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted [&>svg]:h-4 [&>svg]:w-4">{iconRight}</span>
          ) : null}
        </div>
        {error && <p className="text-xs text-danger-500 animate-fade-in">{error}</p>}
        {!error && hint && <p className="text-xs text-text-muted">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
