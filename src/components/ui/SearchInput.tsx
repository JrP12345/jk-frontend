"use client";

import { useState, useEffect, useRef, forwardRef, type InputHTMLAttributes, memo } from "react";
import { cn } from "./utils";

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "size" | "value"> {
  value?: string;
  onChange?: (value: string) => void;
  debounce?: number;
  loading?: boolean;
  onClear?: () => void;
  size?: "sm" | "md";
  shortcut?: string;
}

const SearchInput = memo(
  forwardRef<HTMLInputElement, SearchInputProps>(
    (
      {
        value: controlledValue,
        onChange,
        debounce = 300,
        loading = false,
        onClear,
        size = "md",
        shortcut,
        className = "",
        ...rest
      },
      ref
    ) => {
      const [internal, setInternal] = useState(controlledValue ?? "");
      const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

      useEffect(() => {
        if (controlledValue !== undefined) setInternal(controlledValue);
      }, [controlledValue]);

      useEffect(() => {
        return () => {
          if (timerRef.current) clearTimeout(timerRef.current);
        };
      }, []);

      const handleChange = (val: string) => {
        setInternal(val);
        if (timerRef.current) clearTimeout(timerRef.current);
        if (debounce > 0) {
          timerRef.current = setTimeout(() => onChange?.(val), debounce);
        } else {
          onChange?.(val);
        }
      };

      const handleClear = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setInternal("");
        onChange?.("");
        onClear?.();
      };

      const isSm = size === "sm";

      return (
        <div className={cn("relative group flex items-center w-full touch-manipulation", className)}>
          <svg
            className={cn(
              "absolute top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary-500 group-focus-within:scale-105 pointer-events-none transform-gpu transition-all duration-200 shrink-0",
              isSm ? "left-2.5 h-3.5 w-3.5" : "left-3 h-4 w-4"
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>

          <input
            ref={ref}
            type="search"
            value={internal}
            onChange={(e) => handleChange(e.target.value)}
            className={cn(
              "w-full rounded-lg border border-border bg-surface text-text font-normal transform-gpu transition-all duration-200 ease-smooth placeholder:text-text-muted/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-primary-500 disabled:opacity-50 shadow-2xs",
              isSm ? "h-8 text-sm pl-8 pr-8 min-h-[34px] sm:min-h-[32px]" : "h-9 text-sm pl-9 pr-9 min-h-[38px] sm:min-h-[36px]",
              shortcut && !internal && !loading ? (isSm ? "pr-14" : "pr-16") : ""
            )}
            {...rest}
          />

          {shortcut && !internal && !loading && (
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-surface-alt font-mono text-[10px] font-medium text-text-muted select-none pointer-events-none shadow-2xs">
              {shortcut}
            </kbd>
          )}

          {(internal || loading) && (
            <span className={cn("absolute top-1/2 -translate-y-1/2 flex items-center justify-center", isSm ? "right-2" : "right-2.5")}>
              {loading ? (
                <svg className="h-4 w-4 animate-spin text-primary-500 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-80" />
                </svg>
              ) : (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1 rounded-md cursor-pointer text-text-muted hover:text-text hover:bg-surface-hover active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  aria-label="Clear search"
                >
                  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M3 3l8 8M11 3l-8 8" />
                  </svg>
                </button>
              )}
            </span>
          )}
        </div>
      );
    }
  )
);

SearchInput.displayName = "SearchInput";
export default SearchInput;



