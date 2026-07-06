"use client";

import { forwardRef, useId } from "react";
import { cn } from "./utils";

/* ────────────────────────────────────────────────
   Checkbox — Styled checkbox with label
   ──────────────────────────────────────────────── */

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  description?: string;
  error?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, error, disabled, className = "", id: propId, checked, defaultChecked, onChange, ...rest }, ref) => {
    const autoId = useId();
    const id = propId || autoId;

    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <label
          htmlFor={id}
          className={cn(
            "group flex items-start gap-3",
            disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
          )}
        >
          <div className="relative mt-0.5">
            <input
              ref={ref}
              id={id}
              type="checkbox"
              disabled={disabled}
              checked={checked}
              defaultChecked={defaultChecked}
              onChange={onChange}
              className="peer sr-only"
              {...rest}
            />
            {/* Custom Box */}
            <div className={cn(
              "flex items-center justify-center h-4.5 w-4.5 rounded border border-border bg-surface text-white transition-all duration-300 ease-spring",
              "peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500/20",
              "peer-checked:bg-primary-600 peer-checked:border-primary-600 peer-checked:[&_svg]:scale-100",
              "group-hover:border-primary-500/50 peer-checked:group-hover:bg-primary-500 peer-checked:group-hover:border-primary-500"
            )}>
              {/* Checkmark Icon */}
              <svg
                className="h-3 w-3 shrink-0 scale-0 transition-transform duration-300 ease-spring"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2.5 6L5 8.5L9.5 3.5" />
              </svg>
            </div>
          </div>

          <div className="flex flex-col select-none">
            {label && <span className="text-sm font-medium text-text leading-tight transition-colors duration-200 group-hover:text-primary-600">{label}</span>}
            {description && <span className="text-xs text-text-muted mt-0.5">{description}</span>}
          </div>
        </label>

        {error && <p className="text-xs text-danger-500 ml-7.5 animate-fade-in">{error}</p>}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";
export default Checkbox;
