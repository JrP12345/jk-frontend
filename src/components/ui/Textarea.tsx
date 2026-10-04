"use client";

import { type TextareaHTMLAttributes, forwardRef, useId, memo, useState } from "react";
import { cn } from "./utils";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
  containerClassName?: string;
  showCharacterCount?: boolean;
}

const Textarea = memo(
  forwardRef<HTMLTextAreaElement, TextareaProps>(
    (
      {
        label,
        error,
        hint,
        fullWidth = true,
        disabled,
        className = "",
        containerClassName = "",
        showCharacterCount,
        id: propId,
        onChange,
        onBlur,
        onInvalid,
        "aria-describedby": ariaDescribedByProp,
        ...rest
      },
      ref
    ) => {
      const autoId = useId();
      const id = propId || autoId;
      const errorId = `${id}-error`;
      const hintId = `${id}-hint`;
      const [nativeError, setNativeError] = useState("");
      const visibleError = error || nativeError;

      const valueLength = String(rest.value || rest.defaultValue || "").length;
      const hasMaxLength = typeof rest.maxLength === "number";
      const displayCounter = showCharacterCount || hasMaxLength;

      const describedBy =
        [ariaDescribedByProp, visibleError ? errorId : null, !visibleError && hint ? hintId : null]
          .filter(Boolean)
          .join(" ") || undefined;

      return (
        <div className={cn("flex flex-col gap-1.5", fullWidth && "w-full", containerClassName)}>
          <div className="flex items-center justify-between gap-2">
            {label && (
              <label htmlFor={id} className="text-sm font-medium text-text select-none">
                {label}
              </label>
            )}
            {displayCounter && (
              <span
                className={cn(
                  "text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded border border-border/60 bg-surface-alt transition-colors duration-150 ml-auto select-none",
                  hasMaxLength && valueLength >= rest.maxLength!
                    ? "text-danger-text font-semibold border-danger-500/30 bg-danger-500/10"
                    : "text-text-muted"
                )}
                aria-live="polite"
              >
                {valueLength}
                {hasMaxLength ? ` / ${rest.maxLength}` : " chars"}
              </span>
            )}
          </div>
          <textarea
            data-touch-control
            ref={ref}
            id={id}
            disabled={disabled}
            aria-invalid={visibleError ? true : undefined}
            aria-describedby={describedBy}
            onChange={(event) => {
              setNativeError(event.currentTarget.validity.valid ? "" : event.currentTarget.validationMessage);
              onChange?.(event);
            }}
            onBlur={(event) => {
              setNativeError(event.currentTarget.validity.valid ? "" : event.currentTarget.validationMessage);
              onBlur?.(event);
            }}
            onInvalid={(event) => {
              setNativeError(event.currentTarget.validationMessage);
              onInvalid?.(event);
            }}
            className={cn(
              "w-full rounded-xl border bg-surface text-text px-3.5 py-2.5 text-base md:text-sm min-h-[88px] resize-y font-normal transform-gpu transition-all duration-200 ease-smooth placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-alt shadow-2xs",
              visibleError
                ? "border-danger-500/80 focus-visible:ring-2 focus-visible:ring-danger-500 focus-visible:border-danger-500"
                : "border-border hover:border-border-focus focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-focus-ring",
              className
            )}
            {...rest}
          />
          {visibleError && (
            <p id={errorId} role="alert" className="text-xs font-medium text-danger-text animate-fade-in">
              {visibleError}
            </p>
          )}
          {!visibleError && hint && (
            <p id={hintId} className="text-xs text-text-muted">
              {hint}
            </p>
          )}
        </div>
      );
    }
  )
);

Textarea.displayName = "Textarea";
export default Textarea;

