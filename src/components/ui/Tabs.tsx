"use client";

import { type ReactNode, useState, useRef, useEffect, useLayoutEffect, memo } from "react";
import { cn } from "./utils";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
  disabled?: boolean;
  content?: ReactNode;
}

export interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  activeTab?: string;
  variant?: "underline" | "pills";
  onChange?: (tabId: string) => void;
  className?: string;
}

const Tabs = memo(function Tabs({
  tabs,
  defaultTab,
  activeTab: controlledActiveTab,
  variant = "underline",
  onChange,
  className = "",
}: TabsProps) {
  const [internalActive, setInternalActive] = useState(defaultTab || tabs[0]?.id);
  const active = controlledActiveTab !== undefined ? controlledActiveTab : internalActive;
  const [sliderStyle, setSliderStyle] = useState<React.CSSProperties>({ left: 0, width: 0, opacity: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  const handleChange = (id: string) => {
    if (controlledActiveTab === undefined) {
      setInternalActive(id);
    }
    onChange?.(id);
  };

  const activeTab = tabs.find((t) => t.id === active);

  const updateSlider = () => {
    if (!activeTabRef.current || !containerRef.current) return;
    const activeRect = activeTabRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    setSliderStyle({
      left: activeRect.left - containerRect.left,
      width: activeRect.width,
      opacity: 1,
    });
  };

  useIsomorphicLayoutEffect(() => {
    updateSlider();
    window.addEventListener("resize", updateSlider);
    return () => window.removeEventListener("resize", updateSlider);
  }, [active, variant, tabs]);

  const enabledTabs = tabs.filter((t) => !t.disabled);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (enabledTabs.length === 0) return;
    const currentIndex = enabledTabs.findIndex((t) => t.id === active);

    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextTab = enabledTabs[(currentIndex + 1) % enabledTabs.length];
      if (nextTab) handleChange(nextTab.id);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevTab = enabledTabs[(currentIndex - 1 + enabledTabs.length) % enabledTabs.length];
      if (prevTab) handleChange(prevTab.id);
    } else if (e.key === "Home") {
      e.preventDefault();
      if (enabledTabs[0]) handleChange(enabledTabs[0].id);
    } else if (e.key === "End") {
      e.preventDefault();
      if (enabledTabs[enabledTabs.length - 1]) handleChange(enabledTabs[enabledTabs.length - 1].id);
    }
  };

  return (
    <div className={className}>
      <div
        ref={containerRef}
        role="tablist"
        onKeyDown={handleKeyDown}
        className={cn(
          "relative flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth max-w-full select-none touch-manipulation",
          variant === "underline" ? "border-b border-border pb-px" : "bg-surface-alt rounded-xl p-1"
        )}
      >
        {/* Underline Slider */}
        {variant === "underline" && (
          <div
            className="absolute bottom-0 h-[3px] rounded-full bg-gradient-to-r from-primary-500 to-primary-600 shadow-xs shadow-primary-500/50 transform-gpu transition-all duration-300 ease-spring"
            style={{
              left: sliderStyle.left,
              width: sliderStyle.width,
              opacity: sliderStyle.opacity,
            }}
          />
        )}

        {/* Pills Slider */}
        {variant === "pills" && (
          <div
            className="absolute bg-surface/90 backdrop-blur-md rounded-lg shadow-sm border border-border/60 transform-gpu transition-all duration-300 ease-spring"
            style={{
              top: "4px",
              bottom: "4px",
              left: sliderStyle.left,
              width: sliderStyle.width,
              opacity: sliderStyle.opacity,
            }}
          />
        )}

        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={isActive ? activeTabRef : null}
              id={`tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => handleChange(tab.id)}
              className={cn(
                "relative z-10 flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium cursor-pointer transform-gpu transition-all duration-200 ease-smooth disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg min-h-[36px] sm:min-h-0",
                variant === "underline"
                  ? cn("-mb-px", isActive ? "text-primary-600 dark:text-primary-400 font-bold" : "text-text-secondary hover:text-text")
                  : cn(isActive ? "text-text font-bold" : "text-text-secondary hover:text-text")
              )}
            >
              {tab.icon && <span className="[&>svg]:h-4 [&>svg]:w-4 shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    "ml-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full leading-none transition-colors duration-200",
                    isActive
                      ? "bg-primary-500/10 text-primary-600 dark:text-primary-400"
                      : "bg-surface-alt text-text-muted"
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {activeTab?.content && (
        <div
          id={`tabpanel-${activeTab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab.id}`}
          tabIndex={0}
          className="pt-4 animate-fade-in transform-gpu transition-all duration-250 ease-smooth focus-visible:outline-none"
        >
          {activeTab.content}
        </div>
      )}
    </div>
  );
});

export default Tabs;



