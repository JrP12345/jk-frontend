import { type SelectHTMLAttributes, type ReactNode, forwardRef, useId, useState, useEffect, useRef } from "react";
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
  sm: "h-8 text-sm pl-3 pr-8",
  md: "h-9 text-sm pl-3.5 pr-9",
  lg: "h-11 text-base pl-4 pr-10",
};

const Select = forwardRef<HTMLInputElement, SelectProps>(
  ({ label, error, hint, size = "md", options, placeholder = "Select an option...", icon, fullWidth = true, disabled, className = "", name, value: controlledValue, onChange, ...rest }, ref) => {
    const autoId = useId();
    const id = rest.id || autoId;

    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedValue, setSelectedValue] = useState(controlledValue || "");
    const [focusedIndex, setFocusedIndex] = useState(-1);

    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Sync state with controlled value
    useEffect(() => {
      if (controlledValue !== undefined) {
        setSelectedValue(controlledValue);
      }
    }, [controlledValue]);

    // Click outside listener
    useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Focus search input when opening
    useEffect(() => {
      if (isOpen) {
        setSearch("");
        setFocusedIndex(-1);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }, [isOpen]);

    const activeOption = options.find(o => o.value === selectedValue);
    const filteredOptions = options.filter(o =>
      o.label.toLowerCase().includes(search.toLowerCase())
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
          setIsOpen(true);
          e.preventDefault();
        }
        return;
      }

      if (e.key === "Escape") {
        setIsOpen(false);
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        setFocusedIndex(prev => (prev + 1) % filteredOptions.length);
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        setFocusedIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length);
        e.preventDefault();
      } else if (e.key === "Enter") {
        if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
          handleSelectOption(filteredOptions[focusedIndex]);
        }
        e.preventDefault();
      }
    };

    return (
      <div ref={containerRef} className={cn("relative flex flex-col gap-1.5", fullWidth && "w-full", className)}>
        {label && <label htmlFor={id} className="text-sm font-medium text-text">{label}</label>}
        
        {/* Hidden input for forms / react-hook-form integration */}
        <input
          ref={ref}
          type="hidden"
          name={name}
          value={selectedValue}
          id={id}
          disabled={disabled}
        />

        <div className="relative">
          {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted [&>svg]:h-4 [&>svg]:w-4 pointer-events-none">{icon}</span>}
          
          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && setIsOpen(!isOpen)}
            onKeyDown={handleKeyDown}
            className={cn(
              "flex items-center justify-between w-full rounded-lg border bg-surface font-normal text-left transition-all duration-300 ease-spring placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-alt",
              triggerSizes[size],
              icon && "pl-10",
              error ? "border-danger-500 focus:ring-2 focus:ring-danger-500/15 focus:border-danger-500" : "border-border focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15",
              isOpen && "border-primary-500 ring-2 ring-primary-500/15"
            )}
          >
            <span className={cn(!activeOption && "text-text-muted")}>
              {activeOption ? activeOption.label : placeholder}
            </span>
            <svg
              className={cn("h-4 w-4 text-text-muted shrink-0 transition-transform duration-300 ease-spring", isOpen && "rotate-180")}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Custom Dropdown panel */}
          {isOpen && (
            <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 flex flex-col rounded-lg border border-border bg-surface shadow-lg animate-slide-down overflow-hidden">
              {/* Option Filter Input */}
              <div className="flex items-center border-b border-border px-3 py-2 bg-surface-alt">
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
                          "flex items-center justify-between w-full text-left px-4 py-2 text-xs font-normal transition-all cursor-pointer select-none",
                          isSelected ? "bg-primary-50 text-primary-700 font-medium dark:bg-primary-950/30 dark:text-primary-400" : "text-text-secondary hover:bg-surface-hover hover:text-text",
                          isFocused && "bg-surface-hover text-text",
                          o.disabled && "opacity-40 cursor-not-allowed"
                        )}
                      >
                        <span>{o.label}</span>
                        {isSelected && (
                          <svg className="h-4.5 w-4.5 text-primary-600 dark:text-primary-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-danger-500 animate-fade-in">{error}</p>}
        {!error && hint && <p className="text-xs text-text-muted">{hint}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
export default Select;
