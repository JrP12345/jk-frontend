"use client";

import { type TextareaHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "./utils";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, fullWidth = true, disabled, className = "", id: propId, ...rest }, ref) => {
    const autoId = useId();
    const id = propId || autoId;
    const valueLength = String(rest.value || rest.defaultValue || "").length;
    const showCounter = !!rest.maxLength;

    return (
      <div className={cn("flex flex-col gap-1.5", fullWidth && "w-full")}>
        <div className="flex items-center justify-between gap-2">
          {label && <label htmlFor={id} className="text-sm font-medium text-text">{label}</label>}
          {showCounter && (
            <span className="text-xs text-text-muted tabular-nums">
              {valueLength} / {rest.maxLength}
            </span>
          )}
        </div>
        <textarea
          ref={ref}
          id={id}
          disabled={disabled}
          className={cn(
            "w-full rounded-lg border bg-surface px-3.5 py-2.5 text-sm min-h-[80px] resize-y font-normal transition-all duration-300 ease-spring placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-alt",
            error ? "border-danger-500 focus:ring-2 focus:ring-danger-500/15 focus:border-danger-500" : "border-border focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15",
            className,
          )}
          {...rest}
        />
        {error && <p className="text-xs text-danger-500 animate-fade-in">{error}</p>}
        {!error && hint && <p className="text-xs text-text-muted">{hint}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
export default Textarea;
