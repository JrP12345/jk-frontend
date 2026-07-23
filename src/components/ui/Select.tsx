"use client";

import { type SelectHTMLAttributes, type ReactNode, forwardRef, useId, useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "./utils";

interface SelectOption { value: string; label: string; disabled?: boolean }

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size" | "onChange"> {
  label?: string;
  error?: string;
  hint?: string;
  size?: "sm" | "md" | "lg";
  options: SelectOption[];
  placeholder?: string;
  icon?: ReactNode;
  fullWidth?: boolean;
  value?: string;
  onChange?: (e: { target: { name?: string; value: string } }) => void;
}

const triggerSizes = {
  sm: "h-8 text-sm px-3 gap-2",
  md: "h-9 text-sm px-3.5 gap-2",
  lg: "h-11 text-base px-4 gap-2.5",
};

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, size = "md", options = [], placeholder = "Select an option...", icon, fullWidth = true, disabled, className = "", name, value: controlledValue, onChange, ...rest }, ref) => {
    const autoId = useId();
    const id = rest.id || autoId;

    const [isOpen, setIsOpen] = useState(false);
    const [openUpward, setOpenUpward] = useState(false);
    const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
    const [search, setSearch] = useState("");
    const [selectedValue, setSelectedValue] = useState(controlledValue || "");
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [mounted, setMounted] = useState(false);

    const buttonRef = useRef<HTMLButtonElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      setMounted(true);
    }, []);

    // Sync state with controlled value
    useEffect(() => {
      if (controlledValue !== undefined) {
        setSelectedValue(controlledValue);
      }
    }, [controlledValue]);

    const updateCoords = useCallback(() => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const isUpward = spaceBelow < 220;

        setOpenUpward(isUpward);
        setCoords({
          top: isUpward ? rect.top : rect.bottom,
          left: rect.left,
          width: rect.width,
        });
      }
    }, []);

    const handleToggle = () => {
      if (disabled) return;
      if (!isOpen) {
        updateCoords();
      }
      setIsOpen(!isOpen);
    };

    // Click outside & scroll listener
    useEffect(() => {
      if (!isOpen) return;

      const handler = (e: MouseEvent) => {
        if (buttonRef.current && buttonRef.current.contains(e.target as Node)) return;
        const portalEl = document.getElementById(`select-portal-${id}`);
        if (portalEl && portalEl.contains(e.target as Node)) return;
        setIsOpen(false);
      };

      const onScroll = (e: Event) => {
        const portalEl = document.getElementById(`select-portal-${id}`);
        if (portalEl && portalEl.contains(e.target as Node)) return;
        if (buttonRef.current && buttonRef.current.contains(e.target as Node)) return;
        updateCoords();
      };

      document.addEventListener("mousedown", handler);
      window.addEventListener("scroll", onScroll, { capture: true, passive: true });

      return () => {
        document.removeEventListener("mousedown", handler);
        window.removeEventListener("scroll", onScroll, { capture: true });
      };
    }, [isOpen, id, updateCoords]);

    // Focus search input when opening
    useEffect(() => {
      if (isOpen) {
        setSearch("");
        setFocusedIndex(-1);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }, [isOpen]);

    const activeOption = (options || []).find(o => o.value === selectedValue);
    const filteredOptions = (options || []).filter(o =>
      o.label?.toLowerCase().includes(search.toLowerCase())
    );

    const handleSelectOption = (o: SelectOption) => {
      if (o.disabled) return;
      setSelectedValue(o.value);
      onChange?.({
        target: {
          name,
          value: o.value
        }
      });
      setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (!isOpen) {
        if (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp") {
          updateCoords();
          setIsOpen(true);
          e.preventDefault();
        }
        return;
      }

      if (e.key === "Escape") {
        setIsOpen(false);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter" && focusedIndex >= 0 && filteredOptions[focusedIndex]) {
        e.preventDefault();
        handleSelectOption(filteredOptions[focusedIndex]);
      }
    };

    return (
      <div className={cn("flex flex-col gap-1.5 relative", fullWidth && "w-full", className)}>
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-text flex items-center justify-between">
            <span>{label}</span>
          </label>
        )}
        
        {/* Hidden HTML Select for native form compatibility */}
        <select
          ref={ref}
          name={name}
          id={id}
          value={selectedValue}
          onChange={(e) => {
            setSelectedValue(e.target.value);
            onChange?.(e);
          }}
          className="sr-only"
          tabIndex={-1}
          disabled={disabled}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>

        <div className="relative">
          {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted [&>svg]:h-4 [&>svg]:w-4 pointer-events-none">{icon}</span>}
          
          <button
            ref={buttonRef}
            type="button"
            disabled={disabled}
            onClick={handleToggle}
            onKeyDown={handleKeyDown}
            className={cn(
              "flex items-center justify-between w-full rounded-lg border bg-surface font-normal text-left transition-all duration-300 ease-spring placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-alt cursor-pointer hover:border-text-secondary",
              triggerSizes[size],
              icon && "pl-10",
              error ? "border-danger-500 focus:ring-2 focus:ring-danger-500/15 focus:border-danger-500" : "border-border focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15",
              isOpen && "border-primary-500 ring-2 ring-primary-500/15"
            )}
          >
            <span className={cn("truncate flex-1 min-w-0 text-left", !activeOption && "text-text-muted")}>
              {activeOption ? activeOption.label : placeholder}
            </span>
            <svg
              className={cn("h-4 w-4 text-text-muted shrink-0 transition-transform duration-300 ease-spring ml-auto", isOpen && "rotate-180")}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Custom Portal Dropdown panel */}
        {isOpen && mounted && coords && createPortal(
          <div
            id={`select-portal-${id}`}
            style={{
              position: "fixed",
              top: openUpward ? undefined : coords.top + 4,
              bottom: openUpward ? window.innerHeight - coords.top + 4 : undefined,
              left: coords.left,
              width: coords.width,
              zIndex: 99999,
            }}
            className="flex flex-col rounded-xl border border-border bg-surface shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden backdrop-blur-xl bg-surface/95"
          >
            {/* Option Filter Input */}
            <div className="flex items-center border-b border-border px-3 py-2 bg-surface-alt/70">
              <svg className="h-3.5 w-3.5 text-text-muted shrink-0 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Type to search..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setFocusedIndex(-1);
                }}
                className="w-full text-xs font-normal bg-transparent focus:outline-none placeholder:text-text-muted border-none p-0 text-text"
              />
            </div>

            {/* Options list */}
            <div className="overflow-y-auto max-h-48 py-1 divide-y divide-border/20">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-3 text-xs text-text-muted text-center">No options match your search.</div>
              ) : (
                filteredOptions.map((o, idx) => {
                  const isSelected = o.value === selectedValue;
                  const isFocused = idx === focusedIndex;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      disabled={o.disabled}
                      onClick={() => handleSelectOption(o)}
                      className={cn(
                        "flex items-center justify-between w-full text-left px-3.5 py-2 text-xs font-normal transition-all cursor-pointer select-none",
                        isSelected ? "bg-primary-500/10 text-primary-500 font-bold" : "text-text-secondary hover:bg-surface-hover hover:text-text",
                        isFocused && "bg-surface-hover text-text",
                        o.disabled && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      <span className="truncate">{o.label}</span>
                      {isSelected && (
                        <svg className="h-4 w-4 text-primary-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}

        {error && <p className="text-xs text-danger-500 animate-fade-in">{error}</p>}
        {!error && hint && <p className="text-xs text-text-muted">{hint}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
export default Select;
