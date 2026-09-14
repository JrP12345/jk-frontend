"use client";

import { type InputHTMLAttributes, type ReactNode, forwardRef, useId, memo } from "react";
import { cn } from "./utils";

export type InputSize = "sm" | "md" | "lg";
export type InputVariant = "default" | "filled" | "flush" | "pill" | "inset";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  label?: string;
  error?: string;
  hint?: string;
  size?: InputSize;
  variant?: InputVariant;
  icon?: ReactNode;
  leftIcon?: ReactNode;
  iconRight?: ReactNode;
  rightIcon?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
  fullWidth?: boolean;
  onClear?: () => void;
  containerClassName?: string;
}

const sizes: Record<InputSize, string> = {
  sm: "text-base sm:text-sm px-3 min-h-[38px] sm:min-h-[32px] sm:h-8",
  md: "text-base sm:text-sm px-3.5 min-h-[42px] sm:min-h-[36px] sm:h-9",
  lg: "text-base px-4 min-h-[46px] sm:min-h-[44px] h-11",
};

const variantStyles: Record<InputVariant, string> = {
  default: "rounded-xl border border-border bg-surface/90 backdrop-blur-sm hover:border-border-focus focus-visible:border-primary-500 focus-visible:ring-4 focus-visible:ring-primary-500/15 shadow-2xs",
  filled: "rounded-xl border border-transparent bg-surface-alt hover:bg-surface-hover focus-visible:bg-surface focus-visible:border-primary-500 focus-visible:ring-4 focus-visible:ring-primary-500/15 shadow-2xs",
  flush: "rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-0 px-1 py-1 min-h-0",
  pill: "rounded-full border border-border bg-surface/90 backdrop-blur-sm hover:border-border-focus focus-visible:border-primary-500 focus-visible:ring-4 focus-visible:ring-primary-500/15 shadow-2xs",
  inset: "rounded-xl border border-border bg-surface/95 hover:border-border-focus focus-visible:border-primary-500 focus-visible:ring-4 focus-visible:ring-primary-500/15 shadow-2xs",
};

const iconPaddingLeft: Record<InputSize, string> = {
  sm: "pl-8",
  md: "pl-9",
  lg: "pl-10",
};

const iconPaddingRight: Record<InputSize, string> = {
  sm: "pr-8",
  md: "pr-9",
  lg: "pr-10",
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
        variant = "default",
        icon,
        leftIcon,
        iconRight,
        rightIcon,
        prefix,
        suffix,
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

      const resolvedLeftIcon = icon || leftIcon;
      const resolvedRightIcon = iconRight || rightIcon;

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
          <div className="group relative flex items-center w-full">
            <input
              ref={ref}
              id={id}
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              className={cn(
                "w-full text-text font-normal transform-gpu transition-all duration-200 ease-smooth placeholder:text-text-muted/70 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-alt",
                sizes[size],
                variantStyles[variant],
                resolvedLeftIcon && !prefix && iconPaddingLeft[size],
                resolvedLeftIcon && prefix && (size === "sm" ? "pl-15" : size === "lg" ? "pl-18" : "pl-16"),
                !resolvedLeftIcon && prefix && (size === "sm" ? "pl-10" : size === "lg" ? "pl-13" : "pl-11"),
                (resolvedRightIcon || hasClear || suffix) && iconPaddingRight[size],
                error && variant !== "flush" && "border-danger-500/80 focus-visible:ring-4 focus-visible:ring-danger-500/15 focus-visible:border-danger-500",
                className
              )}
              {...rest}
            />
            {resolvedLeftIcon && (
              <span
                className={cn(
                  "absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-hover:text-text-secondary group-focus-within:text-primary-600 dark:group-focus-within:text-primary-400 transition-colors duration-200 shrink-0 pointer-events-none flex items-center justify-center z-10",
                  variant === "flush" && "left-2",
                  iconSizes[size]
                )}
              >
                {resolvedLeftIcon}
              </span>
            )}
            {prefix && (
              <span
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 text-text-secondary text-xs font-semibold select-none pointer-events-none shrink-0 flex items-center border-r border-border/60 pr-1.5 h-4 z-10",
                  resolvedLeftIcon ? (size === "sm" ? "left-8" : size === "lg" ? "left-10" : "left-9") : (size === "sm" ? "left-2.5" : "left-3")
                )}
              >
                {prefix}
              </span>
            )}
            {suffix && (
              <span
                className={cn(
                  "absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs font-medium select-none pointer-events-none shrink-0 flex items-center z-10",
                  hasClear && "right-9"
                )}
              >
                {suffix}
              </span>
            )}
            {hasClear ? (
              <button
                type="button"
                onClick={onClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 sm:p-1 text-text-muted hover:text-text cursor-pointer transition-colors duration-150 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[32px] min-w-[32px] flex items-center justify-center z-10"
                aria-label="Clear input text"
              >
                <svg className={cn("shrink-0", iconSizes[size])} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : resolvedRightIcon ? (
              <span
                className={cn(
                  "absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary-600 transition-colors duration-200 shrink-0 flex items-center justify-center pointer-events-none [&_button]:pointer-events-auto [&_button]:cursor-pointer [&_a]:pointer-events-auto z-10",
                  iconSizes[size]
                )}
              >
                {resolvedRightIcon}
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


