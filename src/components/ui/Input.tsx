"use client";

import { type InputHTMLAttributes, type ReactNode, forwardRef, useId, memo } from "react";
import { cn } from "./utils";

export type InputSize = "sm" | "md" | "lg";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  hint?: string;
  size?: InputSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  onClear?: () => void;
  containerClassName?: string;
}

const sizes: Record<InputSize, string> = {
  sm: "h-8 text-sm px-3 min-h-[34px] sm:min-h-[32px]",
  md: "h-9 text-sm px-3.5 min-h-[38px] sm:min-h-[36px]",
  lg: "h-11 text-base px-4 min-h-[44px]",
};

const iconPaddingLeft: Record<InputSize, string> = {
  sm: "pl-8.5",
  md: "pl-10",
  lg: "pl-11",
};

const iconPaddingRight: Record<InputSize, string> = {
  sm: "pr-8.5",
  md: "pr-10",
  lg: "pr-11",
};

const iconSizes: Record<InputSize, string> = {
  sm: "[&>svg]:h-3.5 [&>svg]:w-3.5 h-3.5 w-3.5",
  md: "[&>svg]:h-4 [&>svg]:w-4 h-4 w-4",
  lg: "[&>svg]:h-4.5 [&>svg]:w-4.5 h-4.5 w-4.5",
};

const Input = memo(
  forwardRef<HTMLInputElement, InputProps>(
    (
      {
        label,
        error,
        hint,
        size = "md",
        icon,
        iconRight,
        fullWidth = true,
        disabled,
        className = "",
        containerClassName = "",
        id: propId,
        onClear,
        "aria-describedby": ariaDescribedByProp,
        ...rest
      },
      ref
    ) => {
      const autoId = useId();
      const id = propId || autoId;
      const errorId = `${id}-error`;
      const hintId = `${id}-hint`;

      const hasClear = !!(onClear && rest.value !== undefined && rest.value !== "" && !disabled);

      const describedBy =
        [ariaDescribedByProp, error ? errorId : null, !error && hint ? hintId : null]
          .filter(Boolean)
          .join(" ") || undefined;

      return (
        <div className={cn("flex flex-col gap-1.5", fullWidth && "w-full", containerClassName)}>
          {label && (
            <label htmlFor={id} className="text-sm font-medium text-text select-none">
              {label}
            </label>
          )}
          <div className="relative flex items-center w-full">
            {icon && (
              <span
                className={cn(
                  "absolute left-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors duration-200 shrink-0 pointer-events-none",
                  iconSizes[size]
                )}
              >
                {icon}
              </span>
            )}
            <input
              ref={ref}
              id={id}
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              className={cn(
                "w-full rounded-xl border bg-surface/90 backdrop-blur-sm text-text font-normal transform-gpu transition-all duration-200 ease-smooth placeholder:text-text-muted/70 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-alt shadow-2xs",
                sizes[size],
                icon && iconPaddingLeft[size],
                (iconRight || hasClear) && iconPaddingRight[size],
                error
                  ? "border-danger-500/80 focus-visible:ring-4 focus-visible:ring-danger-500/15 focus-visible:border-danger-500"
                  : "border-border hover:border-border-focus focus-visible:border-primary-500 focus-visible:ring-4 focus-visible:ring-primary-500/15",
                className
              )}
              {...rest}
            />
            {hasClear ? (
              <button
                type="button"
                onClick={onClear}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text cursor-pointer transition-colors duration-150 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                aria-label="Clear input text"
              >
                <svg className={cn("shrink-0", iconSizes[size])} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : iconRight ? (
              <span
                className={cn(
                  "absolute right-3 top-1/2 -translate-y-1/2 text-text-muted shrink-0 flex items-center justify-center",
                  iconSizes[size]
                )}
              >
                {iconRight}
              </span>
            ) : null}
          </div>
          {error && (
            <p id={errorId} className="text-xs font-medium text-danger-500 animate-fade-in">
              {error}
            </p>
          )}
          {!error && hint && (
            <p id={hintId} className="text-xs text-text-muted">
              {hint}
            </p>
          )}
        </div>
      );
    }
  )
);

Input.displayName = "Input";
export default Input;


