"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { cn } from "./utils";

/* ────────────────────────────────────────────────
   Theme Provider — Smooth dark mode + palettes
   ──────────────────────────────────────────────── */

type Mode = "light" | "dark" | "system";
type Palette = "blue" | "teal" | "emerald" | "cyan" | "indigo" | "violet" | "rose" | "amber" | "bronze" | "slate";

interface ThemeContextValue {
  mode: Mode;
  palette: Palette;
  resolvedMode: "light" | "dark";
  setMode: (m: Mode) => void;
  setPalette: (p: Palette) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

export const PALETTES: { id: Palette; label: string; swatch: string }[] = [
  { id: "blue",    label: "Sapphire Blue",  swatch: "#1068eb" },
  { id: "teal",    label: "Teal Green",     swatch: "#0d9488" },
  { id: "emerald", label: "Mint Green",     swatch: "#16a34a" },
  { id: "cyan",    label: "Aqua Blue",      swatch: "#0891b2" },
  { id: "indigo",  label: "Deep Indigo",    swatch: "#4f46e5" },
  { id: "violet",  label: "Amethyst Purple",swatch: "#9333ea" },
  { id: "rose",    label: "Crimson Red",    swatch: "#e03131" },
  { id: "amber",   label: "Bronze Gold",    swatch: "#ca8a04" },
  { id: "bronze",  label: "Warm Stone",     swatch: "#78716c" },
  { id: "slate",   label: "Steel Gray",     swatch: "#475569" },
];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeRaw] = useState<Mode>(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("jk-mode") as Mode) || "dark";
    return "dark";
  });
  const [palette, setPaletteRaw] = useState<Palette>(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("jk-palette") as Palette) || "blue";
    return "blue";
  });
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">(mode === "system" ? "dark" : mode);

  // Wrap setters to trigger smooth transition
  const triggerTransition = useCallback(() => {
    const root = document.documentElement;
    root.setAttribute("data-transitioning", "");
    // Remove after transition completes
    const id = setTimeout(() => root.removeAttribute("data-transitioning"), 400);
    return () => clearTimeout(id);
  }, []);

  const setMode = useCallback((m: Mode) => {
    triggerTransition();
    setModeRaw(m);
  }, [triggerTransition]);

  const setPalette = useCallback((p: Palette) => {
    triggerTransition();
    setPaletteRaw(p);
  }, [triggerTransition]);

  const toggleMode = useCallback(() => {
    setMode(resolvedMode === "light" ? "dark" : "light");
  }, [resolvedMode, setMode]);

  // Resolve system preference
  useEffect(() => {
    if (mode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      setResolvedMode(mq.matches ? "dark" : "light");
      const handler = (e: MediaQueryListEvent) => setResolvedMode(e.matches ? "dark" : "light");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    setResolvedMode(mode);
  }, [mode]);

  // Apply data attributes & save to localStorage
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-mode", resolvedMode);
    root.setAttribute("data-palette", palette);
    if (typeof window !== "undefined") {
      localStorage.setItem("jk-mode", mode);
      localStorage.setItem("jk-palette", palette);
    }
  }, [resolvedMode, palette, mode]);

  return (
    <ThemeContext.Provider value={{ mode, palette, resolvedMode, setMode, setPalette, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

/* ────────────────────────────────────────────────
   ModeSwitcher — Animated sun/moon toggle
   ──────────────────────────────────────────────── */

export function ModeSwitcher({ className = "" }: { className?: string }) {
  const { resolvedMode, toggleMode } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => setMounted(true), []);
  
  if (!mounted) {
    return <div className={cn("h-8 w-14 rounded-full bg-surface-alt/50", className)} />;
  }

  const isDark = resolvedMode === "dark";

  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "relative h-8 w-14 rounded-full cursor-pointer p-0.5",
        "transition-colors duration-300 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2",
        isDark ? "bg-primary-600" : "bg-text-muted/25",
        className,
      )}
    >
      {/* Track pill */}
      <span
        className={cn(
          "flex items-center justify-center h-7 w-7 rounded-full bg-white shadow-md",
          "transition-all duration-300 ease-out-expo",
          isDark ? "translate-x-6" : "translate-x-0",
        )}
      >
        {/* Sun */}
        <svg
          className={cn(
            "absolute h-4 w-4 text-amber-500 transition-all duration-300",
            isDark ? "opacity-0 rotate-90 scale-0" : "opacity-100 rotate-0 scale-100",
          )}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
        {/* Moon */}
        <svg
          className={cn(
            "absolute h-4 w-4 text-primary-600 transition-all duration-300",
            isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-0",
          )}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
        </svg>
      </span>
    </button>
  );
}

/* ────────────────────────────────────────────────
   PaletteSwitcher — Custom circle dropdown selector
   ──────────────────────────────────────────────── */

export function PaletteSwitcher({ className = "" }: { className?: string }) {
  const { palette, setPalette } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const activePalette = PALETTES.find(p => p.id === palette) || PALETTES[0];

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select color palette"
        className="flex items-center justify-center h-8 w-8 rounded-full border border-border bg-surface hover:bg-surface-hover hover:border-primary-500/30 transition-all duration-300 ease-spring cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
      >
        <span
          className="h-4 w-4 rounded-full shadow-sm"
          style={{ backgroundColor: activePalette.swatch }}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-border bg-surface p-3 shadow-lg animate-slide-down">
          <h4 className="text-xs font-bold text-text-secondary mb-2.5 px-1 uppercase tracking-wider">Palette Theme</h4>
          <div className="grid grid-cols-5 gap-2">
            {PALETTES.map(p => {
              const isSelected = p.id === palette;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPalette(p.id);
                    setIsOpen(false);
                  }}
                  title={p.label}
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center transition-all duration-300 ease-spring cursor-pointer border hover:scale-105 active:scale-95",
                    isSelected ? "border-primary-500 ring-2 ring-primary-500/30 scale-105" : "border-border hover:border-text-secondary"
                  )}
                >
                  <span
                    className="h-5.5 w-5.5 rounded-full shadow-inner"
                    style={{ backgroundColor: p.swatch }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


