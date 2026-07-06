"use client";

import { useState, forwardRef, useId } from "react";
import { cn } from "./utils";

interface ToggleProps {
  label?: string;
  description?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  id?: string;
  className?: string;
}

const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  ({ label, description, checked: controlledChecked, defaultChecked = false, onChange, disabled = false, size = "md", id: propId, className = "" }, ref) => {
    const autoId = useId();
    const id = propId || autoId;
    const [internalChecked, setInternalChecked] = useState(defaultChecked);
    const isChecked = controlledChecked !== undefined ? controlledChecked : internalChecked;

    const toggle = () => {
      if (disabled) return;
      const next = !isChecked;
      if (controlledChecked === undefined) setInternalChecked(next);
      onChange?.(next);
    };

    const isSm = size === "sm";

    return (
      <div className={cn("flex items-start gap-3", className)}>
        <button
          ref={ref}
          id={id}
          type="button"
          role="switch"
          aria-checked={isChecked}
          disabled={disabled}
          onClick={toggle}
          className={cn(
            "relative inline-flex shrink-0 items-center rounded-full cursor-pointer transition-colors duration-300 ease-spring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
            isSm ? "w-8 h-[18px]" : "w-10 h-[22px]",
            isChecked ? "bg-primary-600" : "bg-text-muted/30",
          )}
        >
          <span className={cn(
            "inline-block rounded-full bg-white shadow-sm transition-all duration-300 ease-spring",
            isSm ? "h-3.5 w-3.5" : "h-4.5 w-4.5",
            isChecked
              ? isSm ? "translate-x-[16px]" : "translate-x-[20px]"
              : "translate-x-[2px]",
          )} />
        </button>

        {(label || description) && (
          <label htmlFor={id} className={cn("flex flex-col", disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer")} onClick={toggle}>
            {label && <span className="text-sm font-medium text-text leading-tight">{label}</span>}
            {description && <span className="text-xs text-text-muted mt-0.5">{description}</span>}
          </label>
        )}
      </div>
    );
  }
);

Toggle.displayName = "Toggle";
export default Toggle;
