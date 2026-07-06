"use client";

import { type ReactNode, useState, useRef, useEffect, useLayoutEffect } from "react";
import { cn } from "./utils";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
  disabled?: boolean;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  variant?: "underline" | "pills";
  onChange?: (tabId: string) => void;
  className?: string;
}

export default function Tabs({ tabs, defaultTab, variant = "underline", onChange, className = "" }: TabsProps) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.id);
  const [sliderStyle, setSliderStyle] = useState<React.CSSProperties>({ left: 0, width: 0, opacity: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  const handleChange = (id: string) => {
    setActive(id);
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

  return (
    <div className={className}>
      <div
        ref={containerRef}
        role="tablist"
        className={cn(
          "relative flex gap-0.5",
          variant === "underline" ? "border-b border-border pb-px" : "bg-surface-alt rounded-lg p-1",
        )}
      >
        {/* Underline Slider */}
        {variant === "underline" && (
          <div
            className="absolute bottom-0 h-0.5 bg-primary-500 transition-all duration-300 ease-out-expo"
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
            className="absolute bg-surface rounded-md shadow-sm transition-all duration-300 ease-out-expo"
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
              role="tab"
              type="button"
              aria-selected={isActive}
              disabled={tab.disabled}
              onClick={() => handleChange(tab.id)}
              className={cn(
                "relative z-10 flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium cursor-pointer transition-colors duration-300 disabled:opacity-40 disabled:cursor-not-allowed select-none active:scale-[0.98]",
                variant === "underline"
                  ? cn("-mb-px", isActive ? "text-primary-600" : "text-text-secondary hover:text-text")
                  : cn("rounded-md", isActive ? "text-text" : "text-text-secondary hover:text-text"),
              )}
            >
              {tab.icon && <span className="[&>svg]:h-4 [&>svg]:w-4 shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={cn(
                  "ml-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full leading-none",
                  isActive 
                    ? "bg-primary-100 text-primary-700 dark:bg-primary-950/40 dark:text-primary-400" 
                    : "bg-surface-alt text-text-muted",
                )}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="pt-4 animate-fade-up">{activeTab?.content}</div>
    </div>
  );
}

