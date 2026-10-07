"use client";

import { type SelectHTMLAttributes, type ReactNode, forwardRef, useId, useState, useEffect, useRef, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { popoverPosition } from "@/lib/popoverPosition";
import { cn } from "./utils";
import { fieldBase, fieldError, fieldLabel, fieldVariants } from "./controlStyles";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type SelectSize = "sm" | "md" | "lg";
export type SelectVariant = "default" | "filled" | "flush" | "pill";

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size" | "onChange"> {
  label?: string;
  error?: string;
  hint?: string;
  size?: SelectSize;
  variant?: SelectVariant;
  options: SelectOption[];
  /** Compact trigger content; dropdown options retain their full labels. */
  renderValue?: (option: SelectOption) => ReactNode;
  placeholder?: string;
  icon?: ReactNode;
  fullWidth?: boolean;
  searchable?: boolean;
  value?: string;
  onChange?: (e: { target: { name?: string; value: string } }) => void;
  containerClassName?: string;
  compactOnMobile?: boolean;
  iconOnly?: boolean;
  minMenuWidth?: number;
  align?: "left" | "right";
}

const triggerSizes: Record<SelectSize, string> = {
  sm: "text-base md:text-sm px-3 gap-2 min-h-[44px] md:min-h-[32px] md:h-8",
  md: "text-base md:text-sm px-3.5 gap-2 min-h-[44px] md:min-h-[36px] md:h-9",
  lg: "text-base px-4 gap-2.5 min-h-[46px] md:min-h-[44px] h-11",
};

const variantStyles: Record<SelectVariant, string> = fieldVariants;

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
        variant = "default",
        options = [],
        renderValue,
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
        compactOnMobile,
        iconOnly,
        minMenuWidth,
        align,
        ...rest
      },
      ref
    ) => {
      const autoId = useId();
      const id = propId || autoId;
      const errorId = `${id}-error`;
      const hintId = `${id}-hint`;
      const listboxId = `${id}-listbox`;

      const [nativeError, setNativeError] = useState("");
      const visibleError = error || nativeError;
      const [isOpen, setIsOpen] = useState(false);
      const [render, setRender] = useState(false);
      const [isExiting, setIsExiting] = useState(false);
      const [owner, setOwner] = useState<string>();
      const [coords, setCoords] = useState<ReturnType<typeof popoverPosition> | null>(null);
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
          setOwner(buttonRef.current.closest('[role="dialog"]')?.id || undefined);
          const computedWidth = Math.max(rect.width, minMenuWidth || (compactOnMobile || iconOnly ? 210 : rect.width));
          const autoAlign = align || (rect.left + computedWidth > (window.visualViewport?.width || window.innerWidth) - 16 ? "right" : "left");
          setCoords(popoverPosition(rect, computedWidth, 280, autoAlign));
        }
      }, [align, compactOnMobile, iconOnly, minMenuWidth]);

      const handleToggle = () => {
        if (disabled) return;
        if (!isOpen) {
          buttonRef.current?.focus();
          updateCoords();
        }
        setIsOpen(!isOpen);
      };

      useEffect(() => {
        if (!isOpen) return;

        const handler = (e: MouseEvent) => {
          if (buttonRef.current && e.target instanceof Node && buttonRef.current.contains(e.target)) return;
          const portalEl = document.getElementById(`select-portal-${id}`);
          if (portalEl && e.target instanceof Node && portalEl.contains(e.target)) return;
          restoreFocusRef.current = false;
          setIsOpen(false);
        };

        const onScrollOrResize = (e: Event) => {
          const portalEl = document.getElementById(`select-portal-${id}`);
          if (portalEl && e.target instanceof Node && portalEl.contains(e.target)) return;
          if (buttonRef.current && e.target instanceof Node && buttonRef.current.contains(e.target)) return;
          updateCoords();
        };

        document.addEventListener("mousedown", handler);
        window.addEventListener("scroll", onScrollOrResize, { capture: true, passive: true });
        window.addEventListener("resize", onScrollOrResize, { passive: true });
        window.visualViewport?.addEventListener("resize", updateCoords);

        return () => {
          document.removeEventListener("mousedown", handler);
          window.removeEventListener("scroll", onScrollOrResize, { capture: true });
          window.removeEventListener("resize", onScrollOrResize);
          window.visualViewport?.removeEventListener("resize", updateCoords);
        };
      }, [isOpen, id, updateCoords]);

      const shouldShowSearch = searchable !== undefined ? searchable : options.length > 6;

      const activeOption = (options || []).find((o) => o.value === selectedValue);
      const filteredOptions = (options || []).filter((o) =>
        o.label?.toLowerCase().includes(search.toLowerCase())
      );

      const wasOpenRef = useRef(false);
      const restoreFocusRef = useRef(true);

      useEffect(() => {
        if (isOpen) {
          wasOpenRef.current = true;
          restoreFocusRef.current = true;
          setSearch("");
          const initialIndex = options.findIndex((o) => o.value === selectedValue);
          setFocusedIndex(initialIndex >= 0 && !options[initialIndex]?.disabled ? initialIndex : options.findIndex((option) => !option.disabled));
          if (shouldShowSearch) {
            setTimeout(() => searchInputRef.current?.focus(), 50);
          }
        } else if (wasOpenRef.current) {
          if (rest.required && !selectedValue) setNativeError("Please choose an option.");
          if (restoreFocusRef.current) buttonRef.current?.focus();
          wasOpenRef.current = false;
        }
      }, [isOpen, shouldShowSearch, selectedValue, rest.required]);

      // Auto scroll focused option into view
      useEffect(() => {
        if (isOpen && focusedIndex >= 0 && listboxRef.current) {
          const focusedElement = listboxRef.current.children[focusedIndex] as HTMLElement;
          if (focusedElement) {
            focusedElement.scrollIntoView({ block: "nearest", behavior: "auto" });
          }
        }
      }, [focusedIndex, isOpen]);

      const handleSelectOption = (o: SelectOption) => {
        if (o.disabled) return;
        setNativeError("");
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

        if (e.key === "Tab") {
          restoreFocusRef.current = false;
          buttonRef.current?.focus();
          setIsOpen(false);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setIsOpen(false);
          return;
        }

        if (e.key === "ArrowDown") {
          e.preventDefault();
          setFocusedIndex((previous) => { const next = filteredOptions.findIndex((option, index) => index > previous && !option.disabled); return next < 0 ? previous : next; });
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setFocusedIndex((previous) => { for (let index = previous - 1; index >= 0; index--) if (!filteredOptions[index].disabled) return index; return previous; });
        } else if (e.key === "Enter" && focusedIndex >= 0 && filteredOptions[focusedIndex]) {
          e.preventDefault();
          handleSelectOption(filteredOptions[focusedIndex]);
        }
      };

      const describedBy =
        [ariaDescribedByProp, visibleError ? errorId : null, !visibleError && hint ? hintId : null]
          .filter(Boolean)
          .join(" ") || undefined;

      const activeOptionId = focusedIndex >= 0 && filteredOptions[focusedIndex] ? `${id}-opt-${focusedIndex}` : undefined;

      return (
        <div className={cn("flex flex-col gap-1.5 relative", fullWidth && "w-full", containerClassName)}>
          {label && (
            <label id={`${id}-label`} htmlFor={`${id}-trigger`} className={fieldLabel}>
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
              setNativeError("");
              setSelectedValue(e.target.value);
              onChange?.(e);
            }}
            className="sr-only"
            tabIndex={-1}
            disabled={disabled}
            {...rest}
            aria-hidden="true"
            onInvalid={(event) => { event.preventDefault(); setNativeError("Please choose an option."); buttonRef.current?.focus(); rest.onInvalid?.(event); }}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
          </select>

          <div className={cn("relative flex items-center", fullWidth && "w-full")}>
            {icon && !compactOnMobile && !iconOnly && (
              <span
                className={cn(
                  "absolute left-3 top-1/2 -translate-y-1/2 z-10 text-text-muted shrink-0 pointer-events-none",
                  iconSizes[size]
                )}
              >
                {icon}
              </span>
            )}

            <button
              id={`${id}-trigger`}
              data-touch-control
              ref={buttonRef}
              aria-label={rest["aria-label"] || (!label && !rest["aria-labelledby"] ? placeholder : undefined)}
              aria-labelledby={rest["aria-labelledby"] || (label ? `${id}-label` : undefined)}
              aria-required={rest.required || undefined}
              type="button"
              role="combobox"
              aria-expanded={isOpen}
              aria-haspopup="listbox"
              aria-controls={isOpen ? listboxId : undefined}
              aria-activedescendant={isOpen ? activeOptionId : undefined}
              aria-invalid={visibleError ? true : undefined}
              aria-describedby={describedBy}
              disabled={disabled}
              onClick={handleToggle}
              onBlur={() => {
                if (!isOpen && rest.required && !selectedValue) setNativeError("Please choose an option.");
              }}
              onKeyDown={handleKeyDown}
              className={cn(
                fieldBase, "text-left cursor-pointer relative",
                iconOnly
                  ? "w-11 h-11 min-w-11 min-h-11 md:w-9 md:h-9 md:min-w-9 md:min-h-9 p-0 flex items-center justify-center rounded-control"
                  : compactOnMobile
                  ? "w-11 min-w-11 h-11 min-h-11 p-0 flex items-center justify-center rounded-control sm:w-auto sm:min-w-0 sm:h-9 sm:px-3 sm:py-1.5 sm:gap-2 sm:justify-between"
                  : cn("flex items-center justify-between w-full", triggerSizes[size]),
                variantStyles[variant],
                !iconOnly && !compactOnMobile && icon && (size === "sm" ? "pl-9" : size === "lg" ? "pl-11" : "pl-10"),
                visibleError && fieldError,
                isOpen && variant !== "flush" && "border-primary-500 ring-2 ring-focus-ring",
                className
              )}
            >
              {iconOnly ? (
                <>
                  <span className="flex items-center justify-center shrink-0">{icon}</span>
                  {activeOption && activeOption.value !== "" && activeOption.value !== "rating" && (
                    <span className="w-2 h-2 rounded-full bg-accent absolute top-1.5 right-1.5 ring-2 ring-surface" aria-hidden="true" />
                  )}
                </>
              ) : compactOnMobile ? (
                <>
                  <span className="sm:hidden flex items-center justify-center shrink-0">{icon}</span>
                  {activeOption && activeOption.value !== "" && activeOption.value !== "rating" && (
                    <span className="sm:hidden w-2 h-2 rounded-full bg-accent absolute top-1.5 right-1.5 ring-2 ring-surface" aria-hidden="true" />
                  )}
                  <span className="hidden sm:inline-flex items-center shrink-0">{icon}</span>
                  <span className={cn("hidden sm:inline truncate flex-1 min-w-0 text-left text-xs font-medium", !activeOption && "text-text-muted")}>
                    {activeOption ? (renderValue?.(activeOption) ?? activeOption.label) : placeholder}
                  </span>
                  <svg
                    className={cn(
                      "hidden sm:block h-3.5 w-3.5 text-text-muted shrink-0 transition-transform duration-200 ease-smooth ml-1",
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
                </>
              ) : (
                <>
                  <span className={cn("truncate flex-1 min-w-0 text-left", !activeOption && "text-text-muted")}>
                    {activeOption ? (renderValue?.(activeOption) ?? activeOption.label) : placeholder}
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
                </>
              )}
            </button>
          </div>

          {/* Custom Portal Dropdown panel */}
          {render &&
            mounted &&
            coords &&
            createPortal(
              <div
                id={`select-portal-${id}`}
                data-overlay-owner={owner}
                data-exiting={isExiting}
                style={{
                  position: "fixed",
                  top: coords.top,
                  bottom: coords.bottom,
                  left: coords.left,
                  width: coords.width,
                  maxHeight: coords.maxHeight,
                  zIndex: "var(--layer-popover)",
                }}
                className={cn(
                  "material-glass-elevated flex flex-col rounded-container overflow-hidden select-none",
                  isExiting ? "animate-popover-out" : "animate-popover-in"
                )}
              >
                {shouldShowSearch && (
                  <div className="flex items-center border-b border-border/60 px-3 py-2 bg-surface-alt">
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
                      aria-label={`Search ${label || rest["aria-label"] || "options"}`}
                      type="text"
                      role="combobox"
                      aria-expanded={isOpen}
                      aria-controls={listboxId}
                      aria-activedescendant={activeOptionId}
                      aria-autocomplete="list"
                      placeholder="Type to search..."
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setFocusedIndex(-1);
                      }}
                      onKeyDown={handleKeyDown}
                      className="w-full text-base md:text-xs font-normal bg-transparent focus:outline-none placeholder:text-text-muted border-none p-0 text-text"
                    />
                  </div>
                )}

                {/* Options list */}
                <div
                  ref={listboxRef}
                  id={listboxId}
                  role="listbox"
                    aria-label={label || rest["aria-label"] || placeholder}
                  tabIndex={-1}
                  className="min-h-0 overflow-y-auto max-h-52 p-1 space-y-0.5"
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
                          tabIndex={-1}
                          aria-selected={isSelected}
                          disabled={o.disabled}
                          onClick={() => handleSelectOption(o)}
                          className={cn(
                            "flex items-center justify-between w-full text-left px-3.5 py-2.5 md:py-2 text-sm font-medium rounded-lg transition-colors duration-[var(--motion-fast)] cursor-pointer select-none min-h-[44px] md:min-h-0",
                            isSelected
                              ? "bg-selected text-accent font-semibold"
                              : "text-text-secondary hover:bg-surface-hover hover:text-text",
                            isFocused && "bg-surface-hover text-text",
                            o.disabled && "opacity-40 cursor-not-allowed"
                          )}
                        >
                          <span className="truncate">{o.label}</span>
                          {isSelected && (
                            <svg
                              className="h-4 w-4 text-accent shrink-0"
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

Select.displayName = "Select";
export default Select;
