"use client";

import { useState, useEffect, useRef, forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "./utils";

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "size" | "value"> {
  value?: string;
  onChange?: (value: string) => void;
  debounce?: number;
  loading?: boolean;
  onClear?: () => void;
  size?: "sm" | "md";
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value: controlledValue, onChange, debounce = 300, loading = false, onClear, size = "md", className = "", ...rest }, ref) => {
    const [internal, setInternal] = useState(controlledValue ?? "");
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => { if (controlledValue !== undefined) setInternal(controlledValue); }, [controlledValue]);

    const handleChange = (val: string) => {
      setInternal(val);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onChange?.(val), debounce);
    };

    const handleClear = () => {
      setInternal("");
      onChange?.("");
      onClear?.();
    };

    const isSm = size === "sm";

    return (
      <div className={cn("relative group flex items-center w-full", className)}>
        <svg
          className={cn(
            "absolute top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary-500 pointer-events-none transition-colors duration-300",
            isSm ? "left-2.5 h-3.5 w-3.5" : "left-3 h-4 w-4"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>

        <input
          ref={ref}
          type="text"
          value={internal}
          onChange={(e) => handleChange(e.target.value)}
          className={cn(
            "w-full rounded-lg border border-border bg-surface font-normal transition-all duration-300 ease-spring placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 disabled:opacity-50",
            isSm ? "h-8 text-sm pl-8 pr-8" : "h-9 text-sm pl-9 pr-9",
          )}
          {...rest}
        />

        {(internal || loading) && (
          <span className={cn("absolute top-1/2 -translate-y-1/2 flex items-center justify-center", isSm ? "right-2" : "right-2.5")}>
            {loading ? (
              <svg className="h-4 w-4 animate-spin-slow text-primary-500" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-80" />
              </svg>
            ) : (
              <button
                type="button"
                onClick={handleClear}
                className="p-0.5 rounded cursor-pointer text-text-muted hover:text-text active:scale-75 transition-all duration-200"
                aria-label="Clear search"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M3 3l8 8M11 3l-8 8" />
                </svg>
              </button>
            )}
          </span>
        )}
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";
export default SearchInput;

