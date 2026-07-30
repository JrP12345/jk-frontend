"use client";

import { forwardRef, useId, useEffect, useRef, useImperativeHandle, memo } from "react";
import { cn } from "./utils";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  description?: string;
  error?: string;
  indeterminate?: boolean;
}

const Checkbox = memo(
  forwardRef<HTMLInputElement, CheckboxProps>(
    (
      {
        label,
        description,
        error,
        disabled,
        className = "",
        id: propId,
        checked,
        defaultChecked,
        onChange,
        indeterminate = false,
        "aria-describedby": ariaDescribedByProp,
        ...rest
      },
      ref
    ) => {
      const autoId = useId();
      const id = propId || autoId;
      const errorId = `${id}-error`;
      const descriptionId = `${id}-desc`;

      const innerRef = useRef<HTMLInputElement | null>(null);
      useImperativeHandle(ref, () => innerRef.current!);

      useEffect(() => {
        if (innerRef.current) {
          innerRef.current.indeterminate = indeterminate;
        }
      }, [indeterminate]);

      const describedBy =
        [ariaDescribedByProp, error ? errorId : null, description ? descriptionId : null]
          .filter(Boolean)
          .join(" ") || undefined;

      return (
        <div className={cn("flex flex-col gap-1", className)}>
          <label
            htmlFor={id}
            className={cn(
              "group/chk inline-flex items-start gap-2.5 touch-manipulation min-h-[32px] sm:min-h-0",
              disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            )}
          >
            <div className="relative mt-0.5 flex items-center justify-center shrink-0">
              <input
                ref={innerRef}
                id={id}
                type="checkbox"
                disabled={disabled}
                checked={checked}
                defaultChecked={defaultChecked}
                onChange={onChange}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy}
                className="peer sr-only"
                {...rest}
              />
              {/* Custom Box */}
              <div
                className={cn(
                  "flex items-center justify-center h-4.5 w-4.5 rounded-md border border-border bg-surface text-white transform-gpu transition-all duration-200 ease-smooth active:scale-90 shadow-2xs",
                  "peer-focus-visible:ring-4 peer-focus-visible:ring-primary-500/20 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface",
                  "peer-checked:bg-primary-600 peer-checked:border-primary-600 peer-checked:shadow-xs peer-checked:shadow-primary-500/30 peer-checked:[&_svg]:scale-100",
                  indeterminate && "bg-primary-600 border-primary-600 shadow-xs shadow-primary-500/30 [&_svg]:scale-100",
                  error ? "border-danger-500/80" : "group-hover/chk:border-primary-500/60"
                )}
              >
                {/* Checkmark or Indeterminate Icon */}
                {indeterminate ? (
                  <svg
                    className="h-3 w-3 shrink-0 transform-gpu scale-100 transition-transform duration-200 ease-spring"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M2.5 6h7" />
                  </svg>
                ) : (
                  <svg
                    className="h-3 w-3 shrink-0 transform-gpu scale-0 transition-transform duration-200 ease-spring"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M2.5 6L5 8.5L9.5 3.5" />
                  </svg>
                )}
              </div>
            </div>

            <div className="flex flex-col select-none">
              {label && (
                <span className="text-sm font-medium text-text leading-tight transition-colors duration-150 group-hover/chk:text-primary-600">
                  {label}
                </span>
              )}
              {description && (
                <span id={descriptionId} className="text-xs text-text-muted mt-0.5">
                  {description}
                </span>
              )}
            </div>
          </label>

          {error && (
            <p id={errorId} className="text-xs font-medium text-danger-500 ml-7 animate-fade-in">
              {error}
            </p>
          )}
        </div>
      );
    }
  )
);

Checkbox.displayName = "Checkbox";
export default Checkbox;


