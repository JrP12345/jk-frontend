"use client";

import { useState, forwardRef, useId, memo } from "react";
import { cn } from "./utils";

export interface ToggleProps {
  label?: string;
  description?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  id?: string;
  className?: string;
}

const Toggle = memo(
  forwardRef<HTMLButtonElement, ToggleProps>(
    (
      {
        label,
        description,
        checked: controlledChecked,
        defaultChecked = false,
        onChange,
        disabled = false,
        size = "md",
        id: propId,
        className = "",
      },
      ref
    ) => {
      const autoId = useId();
      const id = propId || autoId;
      const labelId = `${id}-label`;
      const descriptionId = `${id}-desc`;

      const [internalChecked, setInternalChecked] = useState(defaultChecked);
      const isChecked = controlledChecked !== undefined ? controlledChecked : internalChecked;

      const toggle = () => {
        if (disabled) return;
        const next = !isChecked;
        if (controlledChecked === undefined) setInternalChecked(next);
        onChange?.(next);
      };

      const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          toggle();
        }
      };

      const isSm = size === "sm";
      const isLg = size === "lg";

      return (
        <div className={cn("inline-flex items-start gap-3 touch-manipulation", className)}>
          <button
            ref={ref}
            id={id}
            type="button"
            role="switch"
            aria-checked={isChecked}
            aria-labelledby={label ? labelId : undefined}
            aria-describedby={description ? descriptionId : undefined}
            disabled={disabled}
            onClick={toggle}
            onKeyDown={handleKeyDown}
            className={cn(
              "relative inline-flex shrink-0 items-center rounded-full cursor-pointer transform-gpu transition-all duration-200 ease-spring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-2xs",
              isSm ? "w-8 h-[18px]" : isLg ? "w-12 h-7" : "w-10 h-[22px]",
              isChecked ? "bg-primary-600 shadow-xs shadow-primary-500/25 border border-primary-500/30" : "bg-surface-alt border border-border hover:border-border-focus hover:bg-surface-hover"
            )}
          >
            <span
              className={cn(
                "inline-block rounded-full bg-white shadow-sm transform-gpu transition-transform duration-250 ease-spring",
                isSm ? "h-3.5 w-3.5" : isLg ? "h-5.5 w-5.5" : "h-4.5 w-4.5",
                isChecked
                  ? isSm
                    ? "translate-x-[15px]"
                    : isLg
                    ? "translate-x-[21px]"
                    : "translate-x-[19px]"
                  : "translate-x-[2px]"
              )}
            />
          </button>

          {(label || description) && (
            <div
              className={cn("flex flex-col select-none", disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer")}
              onClick={toggle}
            >
              {label && (
                <span id={labelId} className="text-sm font-medium text-text leading-tight hover:text-primary-600 transition-colors duration-150">
                  {label}
                </span>
              )}
              {description && (
                <span id={descriptionId} className="text-xs text-text-muted mt-0.5">
                  {description}
                </span>
              )}
            </div>
          )}
        </div>
      );
    }
  )
);

Toggle.displayName = "Toggle";
export default Toggle;


