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
    if (typeof window !== "undefined") {
      const domMode = document.documentElement.getAttribute("data-mode") as Mode;
      if (domMode) return (localStorage.getItem("jk-mode") as Mode) || domMode;
      return (localStorage.getItem("jk-mode") as Mode) || "light";
    }
    return "light";
  });
  const [palette, setPaletteRaw] = useState<Palette>(() => {
    if (typeof window !== "undefined") {
      const domPal = document.documentElement.getAttribute("data-palette") as Palette;
      if (domPal) return domPal;
      return (localStorage.getItem("jk-palette") as Palette) || "blue";
    }
    return "blue";
  });
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      if (document.documentElement.classList.contains("dark")) return "dark";
      if (mode === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      return mode === "dark" ? "dark" : "light";
    }
    return mode === "system" ? "light" : mode;
  });

  const applyThemeMode = useCallback((newMode: Mode, nextResolved: "light" | "dark") => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.add("theme-transitioning");

    root.setAttribute("data-mode", nextResolved);
    root.classList.toggle("dark", nextResolved === "dark");
    root.style.colorScheme = nextResolved;

    setModeRaw(newMode);
    setResolvedMode(nextResolved);

    if (typeof window !== "undefined") {
      localStorage.setItem("jk-mode", newMode);
    }

    window.setTimeout(() => {
      root.classList.remove("theme-transitioning");
    }, 350);
  }, []);

  const setMode = useCallback((m: Mode) => {
    const nextResolved = m === "system"
      ? (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : m;
    applyThemeMode(m, nextResolved);
  }, [applyThemeMode]);

  const setPalette = useCallback((p: Palette) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.add("theme-transitioning");
    root.setAttribute("data-palette", p);
    setPaletteRaw(p);
    if (typeof window !== "undefined") {
      localStorage.setItem("jk-palette", p);
    }
    window.setTimeout(() => {
      root.classList.remove("theme-transitioning");
    }, 350);
  }, []);

  const toggleMode = useCallback(() => {
    const next = resolvedMode === "light" ? "dark" : "light";
    setMode(next);
  }, [resolvedMode, setMode]);

  // Resolve system preference
  useEffect(() => {
    if (mode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const nextRes = mq.matches ? "dark" : "light";
      document.documentElement.setAttribute("data-mode", nextRes);
      document.documentElement.classList.toggle("dark", nextRes === "dark");
      document.documentElement.style.colorScheme = nextRes;
      setResolvedMode(nextRes);
      const handler = (e: MediaQueryListEvent) => {
        const r = e.matches ? "dark" : "light";
        document.documentElement.setAttribute("data-mode", r);
        document.documentElement.classList.toggle("dark", r === "dark");
        document.documentElement.style.colorScheme = r;
        setResolvedMode(r);
      };
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [mode]);

  // Ensure initial attributes match state on mount
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-mode", resolvedMode);
    root.classList.toggle("dark", resolvedMode === "dark");
    root.style.colorScheme = resolvedMode;
    root.setAttribute("data-palette", palette);
  }, [resolvedMode, palette]);

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
        "relative h-8 w-14 rounded-full cursor-pointer p-0.5 border border-border/80",
        "transition-colors duration-300 ease-out shadow-xs",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2",
        isDark ? "bg-primary-600/90" : "bg-surface-alt",
        className,
      )}
    >
      {/* Track pill */}
      <span
        className={cn(
          "flex items-center justify-center h-6.5 w-6.5 rounded-full bg-surface text-text shadow-sm border border-border/60",
          "transition-all duration-300 ease-out-expo",
          isDark ? "translate-x-6" : "translate-x-0",
        )}
      >
        {/* Sun */}
        <svg
          className={cn(
            "absolute h-3.5 w-3.5 text-amber-500 transition-all duration-300",
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
            "absolute h-3.5 w-3.5 text-primary-400 transition-all duration-300",
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
        className="flex items-center justify-center h-8 w-8 rounded-full border border-border/80 bg-surface hover:bg-surface-hover hover:border-primary-500/30 transition-all duration-300 ease-spring cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
      >
        <span
          className="h-4 w-4 rounded-full shadow-sm ring-1 ring-black/10 dark:ring-white/20"
          style={{ backgroundColor: activePalette.swatch }}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-border/80 bg-surface/98 backdrop-blur-2xl p-3.5 shadow-xl ring-1 ring-border/50 animate-slide-down">
          <h4 className="text-xs font-bold text-text-secondary mb-2.5 px-1 uppercase tracking-wider">Color Theme Palette</h4>
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
                    "h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-300 ease-spring cursor-pointer border hover:scale-105 active:scale-95",
                    isSelected ? "border-primary-500 ring-2 ring-primary-500/30 scale-105 bg-primary-500/10" : "border-border/60 hover:border-text-secondary bg-surface-alt/40"
                  )}
                >
                  <span
                    className="h-5 w-5 rounded-full shadow-inner"
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


