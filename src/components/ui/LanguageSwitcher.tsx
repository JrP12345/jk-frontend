"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation, LanguageCode } from "@/lib/i18n";
import { Globe, Check, ChevronDown } from "lucide-react";
import { cn } from "./utils";

interface LanguageSwitcherProps {
  className?: string;
  variant?: "pill" | "icon" | "minimal";
}

export function LanguageSwitcher({ className = "", variant = "pill" }: LanguageSwitcherProps) {
  const { language, setLanguage, supportedLanguages, t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const defaultOption = supportedLanguages[0];
  const activeLang = mounted ? language : "en";
  const currentOption = supportedLanguages.find((l) => l.code === activeLang) || defaultOption;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (code: LanguageCode) => {
    try {
      localStorage.setItem("ananta_lang_manual", "true");
    } catch {}
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className={cn("relative inline-block text-left", className)} ref={dropdownRef}>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-xl text-text-secondary hover:text-text hover:bg-surface-hover border border-border/60 transition-all duration-150 cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center active:scale-95"
          title={`Language: ${currentOption.label}`}
          aria-label={`Current language: ${currentOption.label}`}
        >
          <span className="text-sm mr-1" suppressHydrationWarning>{currentOption.flag}</span>
          <Globe className="w-3.5 h-3.5 text-text-muted" />
        </button>
      ) : variant === "minimal" ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-text cursor-pointer py-1 px-2 rounded-lg hover:bg-surface-hover transition-colors"
        >
          <span suppressHydrationWarning>{currentOption.flag}</span>
          <span className="uppercase text-[11px] font-bold" suppressHydrationWarning>{currentOption.code}</span>
          <ChevronDown className={cn("w-3 h-3 text-text-muted transition-transform", isOpen && "rotate-180")} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-border/70 bg-surface/90 hover:bg-surface-hover text-text text-xs font-semibold shadow-2xs hover:shadow-xs transition-all duration-150 cursor-pointer active:scale-95 min-h-[36px]"
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <span className="text-sm leading-none" suppressHydrationWarning>{currentOption.flag}</span>
          <span className="font-medium" suppressHydrationWarning>{currentOption.nativeLabel}</span>
          <ChevronDown className={cn("w-3 h-3 text-text-muted transition-transform duration-200", isOpen && "rotate-180")} />
        </button>
      )}

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-44 rounded-2xl bg-surface/98 backdrop-blur-2xl border border-border/80 shadow-xl ring-1 ring-border/50 py-1.5 z-50 animate-scale-in origin-top-right focus:outline-none">
          <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-text-muted tracking-wider border-b border-border/40 mb-1">
            {t("common.select_language", "Select Language")}
          </div>
          {supportedLanguages.map((lang) => {
            const isSelected = lang.code === language;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelect(lang.code)}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs flex items-center justify-between rounded-xl mx-auto my-0.5 max-w-[calc(100%-8px)] transition-colors cursor-pointer",
                  isSelected
                    ? "bg-primary-600/10 text-primary-600 font-bold"
                    : "text-text hover:bg-surface-hover text-text-secondary hover:text-text font-medium"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{lang.flag}</span>
                  <div>
                    <p className="leading-tight">{lang.nativeLabel}</p>
                    <p className="text-[10px] text-text-muted leading-tight">{lang.label}</p>
                  </div>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-primary-600 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
export default LanguageSwitcher;
