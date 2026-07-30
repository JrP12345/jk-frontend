"use client";

import { type SelectHTMLAttributes, type ReactNode, forwardRef, useId, useState, useEffect, useRef, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { cn } from "./utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type SelectSize = "sm" | "md" | "lg";

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size" | "onChange"> {
  label?: string;
  error?: string;
  hint?: string;
  size?: SelectSize;
  options: SelectOption[];
  placeholder?: string;
  icon?: ReactNode;
  fullWidth?: boolean;
  searchable?: boolean;
  value?: string;
  onChange?: (e: { target: { name?: string; value: string } }) => void;
  containerClassName?: string;
}

const triggerSizes: Record<SelectSize, string> = {
  sm: "h-8 text-sm px-3 gap-2 min-h-[34px] sm:min-h-[32px]",
  md: "h-9 text-sm px-3.5 gap-2 min-h-[38px] sm:min-h-[36px]",
  lg: "h-11 text-base px-4 gap-2.5 min-h-[44px]",
};

const iconSizes: Record<SelectSize, string> = {
  sm: "[&>svg]:h-3.5 [&>svg]:w-3.5 h-3.5 w-3.5",
  md: "[&>svg]:h-4 [&>svg]:w-4 h-4 w-4",
  lg: "[&>svg]:h-4.5 [&>svg]:w-4.5 h-4.5 w-4.5",
};

const Select = memo(
  forwardRef<HTMLSelectElement, SelectProps>(
    (
      {
        label,
        error,
        hint,
        size = "md",
        options = [],
        placeholder = "Select an option...",
        icon,
        fullWidth = true,
        searchable,
        disabled,
        className = "",
        containerClassName = "",
        name,
        value: controlledValue,
        onChange,
        id: propId,
        "aria-describedby": ariaDescribedByProp,
        ...rest
      },
      ref
    ) => {
      const autoId = useId();
      const id = propId || autoId;
      const errorId = `${id}-error`;
      const hintId = `${id}-hint`;
      const listboxId = `${id}-listbox`;

      const [isOpen, setIsOpen] = useState(false);
      const [render, setRender] = useState(false);
      const [isExiting, setIsExiting] = useState(false);
      const [openUpward, setOpenUpward] = useState(false);
      const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
      const [search, setSearch] = useState("");
      const [selectedValue, setSelectedValue] = useState(controlledValue || "");
      const [focusedIndex, setFocusedIndex] = useState(-1);
      const [mounted, setMounted] = useState(false);

      const buttonRef = useRef<HTMLButtonElement>(null);
      const searchInputRef = useRef<HTMLInputElement>(null);
      const listboxRef = useRef<HTMLDivElement>(null);

      useEffect(() => {
        setMounted(true);
      }, []);

      useEffect(() => {
        if (controlledValue !== undefined) {
          setSelectedValue(controlledValue);
        }
      }, [controlledValue]);

      useEffect(() => {
        if (isOpen) {
          setRender(true);
          setIsExiting(false);
        } else if (render) {
          setIsExiting(true);
          const timer = setTimeout(() => {
            setRender(false);
            setIsExiting(false);
          }, 140);
          return () => clearTimeout(timer);
        }
      }, [isOpen, render]);

      const updateCoords = useCallback(() => {
        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          const spaceBelow = window.innerHeight - rect.bottom;
          const isUpward = spaceBelow < 230 && rect.top > 230;

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

      useEffect(() => {
        if (!isOpen) return;

        const handler = (e: MouseEvent) => {
          if (buttonRef.current && buttonRef.current.contains(e.target as Node)) return;
          const portalEl = document.getElementById(`select-portal-${id}`);
          if (portalEl && portalEl.contains(e.target as Node)) return;
          setIsOpen(false);
        };

        const onScrollOrResize = (e: Event) => {
          const portalEl = document.getElementById(`select-portal-${id}`);
          if (portalEl && portalEl.contains(e.target as Node)) return;
          if (buttonRef.current && buttonRef.current.contains(e.target as Node)) return;
          updateCoords();
        };

        document.addEventListener("mousedown", handler);
        window.addEventListener("scroll", onScrollOrResize, { capture: true, passive: true });
        window.addEventListener("resize", onScrollOrResize, { passive: true });

        return () => {
          document.removeEventListener("mousedown", handler);
          window.removeEventListener("scroll", onScrollOrResize, { capture: true });
          window.removeEventListener("resize", onScrollOrResize);
        };
      }, [isOpen, id, updateCoords]);

      const shouldShowSearch = searchable !== undefined ? searchable : options.length > 6;

      const activeOption = (options || []).find((o) => o.value === selectedValue);
      const filteredOptions = (options || []).filter((o) =>
        o.label?.toLowerCase().includes(search.toLowerCase())
      );

      const wasOpenRef = useRef(false);

      useEffect(() => {
        if (isOpen) {
          wasOpenRef.current = true;
          setSearch("");
          const initialIndex = filteredOptions.findIndex((o) => o.value === selectedValue);
          setFocusedIndex(initialIndex >= 0 ? initialIndex : 0);
          if (shouldShowSearch) {
            setTimeout(() => searchInputRef.current?.focus(), 50);
          }
        } else if (wasOpenRef.current) {
          buttonRef.current?.focus();
          wasOpenRef.current = false;
        }
      }, [isOpen, shouldShowSearch]);

      // Auto scroll focused option into view
      useEffect(() => {
        if (isOpen && focusedIndex >= 0 && listboxRef.current) {
          const focusedElement = listboxRef.current.children[focusedIndex] as HTMLElement;
          if (focusedElement) {
            focusedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }
        }
      }, [focusedIndex, isOpen]);

      const handleSelectOption = (o: SelectOption) => {
        if (o.disabled) return;
        setSelectedValue(o.value);
        onChange?.({
          target: {
            name,
            value: o.value,
          },
        });
        setIsOpen(false);
      };

      const handleKeyDown = (e: React.KeyboardEvent) => {
        if (disabled) return;
        if (!isOpen) {
          if (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === " ") {
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

      const describedBy =
        [ariaDescribedByProp, error ? errorId : null, !error && hint ? hintId : null]
          .filter(Boolean)
          .join(" ") || undefined;

      const activeOptionId = focusedIndex >= 0 && filteredOptions[focusedIndex] ? `${id}-opt-${focusedIndex}` : undefined;

      return (
        <div className={cn("flex flex-col gap-1.5 relative", fullWidth && "w-full", containerClassName)}>
          {label && (
            <label htmlFor={id} className="text-sm font-medium text-text select-none">
              {label}
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

          <div className="relative flex items-center w-full">
            {icon && (
              <span
                className={cn(
                  "absolute left-3 top-1/2 -translate-y-1/2 text-text-muted shrink-0 pointer-events-none",
                  iconSizes[size]
                )}
              >
                {icon}
              </span>
            )}

            <button
              ref={buttonRef}
              type="button"
              role="combobox"
              aria-expanded={isOpen}
              aria-haspopup="listbox"
              aria-controls={isOpen ? listboxId : undefined}
              aria-activedescendant={isOpen ? activeOptionId : undefined}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              disabled={disabled}
              onClick={handleToggle}
              onKeyDown={handleKeyDown}
              className={cn(
                "flex items-center justify-between w-full rounded-lg border bg-surface font-normal text-text text-left transform-gpu transition-all duration-200 ease-smooth focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-alt cursor-pointer hover:border-border-focus shadow-2xs",
                triggerSizes[size],
                icon && (size === "sm" ? "pl-8.5" : size === "lg" ? "pl-11" : "pl-10"),
                error
                  ? "border-danger-500/80 focus-visible:ring-2 focus-visible:ring-danger-500 focus-visible:border-danger-500"
                  : "border-border focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500",
                isOpen && "border-primary-500 ring-2 ring-primary-500"
              )}
            >
              <span className={cn("truncate flex-1 min-w-0 text-left", !activeOption && "text-text-muted/70")}>
                {activeOption ? activeOption.label : placeholder}
              </span>
              <svg
                className={cn(
                  "h-4 w-4 text-text-muted shrink-0 transition-transform duration-200 ease-smooth ml-auto",
                  isOpen && "rotate-180"
                )}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          {/* Custom Portal Dropdown panel */}
          {render &&
            mounted &&
            coords &&
            createPortal(
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
                className={cn(
                  "flex flex-col rounded-2xl border border-border/80 bg-surface/95 shadow-2xl shadow-black/30 overflow-hidden backdrop-blur-xl ring-1 ring-white/10 select-none transform-gpu",
                  isExiting ? "animate-popover-out" : "animate-popover-in"
                )}
              >
                {shouldShowSearch && (
                  <div className="flex items-center border-b border-border/60 px-3 py-2 bg-surface-alt/70">
                    <svg
                      className="h-3.5 w-3.5 text-text-muted shrink-0 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
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
                      onKeyDown={handleKeyDown}
                      className="w-full text-xs font-normal bg-transparent focus:outline-none placeholder:text-text-muted/70 border-none p-0 text-text"
                    />
                  </div>
                )}

                {/* Options list */}
                <div
                  ref={listboxRef}
                  id={listboxId}
                  role="listbox"
                  tabIndex={-1}
                  className="overflow-y-auto max-h-52 p-1 space-y-0.5"
                >
                  {filteredOptions.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-text-muted text-center select-none">
                      No options match your search.
                    </div>
                  ) : (
                    filteredOptions.map((o, idx) => {
                      const isSelected = o.value === selectedValue;
                      const isFocused = idx === focusedIndex;
                      return (
                        <button
                          key={o.value}
                          id={`${id}-opt-${idx}`}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          disabled={o.disabled}
                          onClick={() => handleSelectOption(o)}
                          className={cn(
                            "flex items-center justify-between w-full text-left px-3 py-2 text-xs font-medium rounded-xl transition-all duration-150 cursor-pointer select-none",
                            isSelected
                              ? "bg-primary-500/10 text-primary-500 font-semibold"
                              : "text-text-secondary hover:bg-surface-hover hover:text-text",
                            isFocused && "bg-surface-hover text-text",
                            o.disabled && "opacity-40 cursor-not-allowed"
                          )}
                        >
                          <span className="truncate">{o.label}</span>
                          {isSelected && (
                            <svg
                              className="h-4 w-4 text-primary-500 shrink-0"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.5}
                              aria-hidden="true"
                            >
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

Select.displayName = "Select";
export default Select;


