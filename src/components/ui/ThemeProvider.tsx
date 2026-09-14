"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { SunMedium, MoonStar, Sparkles } from "lucide-react";
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
  const [mounted, setMounted] = useState(false);
  const [mode, setModeRaw] = useState<Mode>("light");
  const [palette, setPaletteRaw] = useState<Palette>("blue");
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">("light");

  // Read persisted theme on mount to prevent SSR hydration mismatch
  useEffect(() => {
    const domMode = document.documentElement.getAttribute("data-mode") as Mode;
    const savedMode = (localStorage.getItem("jk-mode") as Mode) || domMode || "light";
    const domPal = document.documentElement.getAttribute("data-palette") as Palette;
    const savedPal = (localStorage.getItem("jk-palette") as Palette) || domPal || "blue";

    setModeRaw(savedMode);
    setPaletteRaw(savedPal);

    let nextResolved: "light" | "dark" = "light";
    if (document.documentElement.classList.contains("dark")) {
      nextResolved = "dark";
    } else if (savedMode === "system") {
      nextResolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
      nextResolved = savedMode === "dark" ? "dark" : "light";
    }
    setResolvedMode(nextResolved);
    setMounted(true);
  }, []);

  const applyThemeMode = useCallback((newMode: Mode, nextResolved: "light" | "dark") => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    const updateDOM = () => {
      root.setAttribute("data-mode", nextResolved);
      root.classList.toggle("dark", nextResolved === "dark");
      root.style.colorScheme = nextResolved;

      setModeRaw(newMode);
      setResolvedMode(nextResolved);

      if (typeof window !== "undefined") {
        localStorage.setItem("jk-mode", newMode);
      }
    };

    // Use native GPU-accelerated View Transitions API for buttery smooth 60fps crossfade
    if ("startViewTransition" in document) {
      (document as any).startViewTransition(() => {
        updateDOM();
      });
    } else {
      root.classList.add("theme-transitioning");
      updateDOM();
      window.setTimeout(() => {
        root.classList.remove("theme-transitioning");
      }, 250);
    }
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

    const updateDOM = () => {
      root.setAttribute("data-palette", p);
      setPaletteRaw(p);
      if (typeof window !== "undefined") {
        localStorage.setItem("jk-palette", p);
      }
    };

    if ("startViewTransition" in document) {
      (document as any).startViewTransition(() => {
        updateDOM();
      });
    } else {
      root.classList.add("theme-transitioning");
      updateDOM();
      window.setTimeout(() => {
        root.classList.remove("theme-transitioning");
      }, 250);
    }
  }, []);

  const toggleMode = useCallback(() => {
    const next = resolvedMode === "light" ? "dark" : "light";
    setMode(next);
  }, [resolvedMode, setMode]);

  // Resolve system preference
  useEffect(() => {
    if (!mounted || mode !== "system") return;
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
  }, [mounted, mode]);

  // Ensure DOM attributes match state after initial mount
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.setAttribute("data-mode", resolvedMode);
    root.classList.toggle("dark", resolvedMode === "dark");
    root.style.colorScheme = resolvedMode;
    root.setAttribute("data-palette", palette);
  }, [mounted, resolvedMode, palette]);

  return (
    <ThemeContext.Provider value={{ mode, palette, resolvedMode, setMode, setPalette, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

/* ────────────────────────────────────────────────
   Celestial Icons — Handcrafted Vector Sun & Moon
   ──────────────────────────────────────────────── */

export function CelestialSun({ className = "", rotating = true }: { className?: string; rotating?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("w-4 h-4", className)}
      aria-hidden="true"
    >
      {/* Radiant Solar Core */}
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      {/* Rotating Solar Corona Rays */}
      <g
        className={rotating ? "animate-celestial-spin" : ""}
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      >
        <line x1="12" y1="2" x2="12" y2="4.5" />
        <line x1="12" y1="19.5" x2="12" y2="22" />
        <line x1="2" y1="12" x2="4.5" y2="12" />
        <line x1="19.5" y1="12" x2="22" y2="12" />
        <line x1="4.93" y1="4.93" x2="6.7" y2="6.7" />
        <line x1="17.3" y1="17.3" x2="19.07" y2="19.07" />
        <line x1="4.93" y1="19.07" x2="6.7" y2="17.3" />
        <line x1="17.3" y1="6.7" x2="19.07" y2="4.93" />
      </g>
    </svg>
  );
}

export function CelestialMoon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("w-4 h-4", className)}
      aria-hidden="true"
    >
      {/* Sculpted Smooth Lunar Crescent */}
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        fill="currentColor"
      />
      {/* 4-Point Diamond Sparkle Star */}
      <path
        d="M19.5 2.5l.55 1.5 1.5.55-1.5.55-.55 1.5-.55-1.5-1.5-.55 1.5-.55.55-1.5z"
        fill="currentColor"
        className="animate-celestial-twinkle-1"
      />
      {/* Ambient Starlight Point */}
      <circle cx="20.5" cy="10" r="0.75" fill="currentColor" className="animate-celestial-twinkle-3" />
    </svg>
  );
}

/* ────────────────────────────────────────────────
   ModeSwitcher — Celestial Day & Night Horizon Toggle
   ──────────────────────────────────────────────── */

export interface ModeSwitcherProps {
  className?: string;
  variant?: "pill" | "segmented" | "icon";
}

export function ModeSwitcher({ className = "", variant = "segmented" }: ModeSwitcherProps) {
  const { resolvedMode, toggleMode } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        className={cn(
          variant === "pill"
            ? "h-8.5 w-[62px] rounded-full bg-surface-alt/60"
            : variant === "segmented"
            ? "h-8.5 w-[68px] rounded-full bg-surface-alt/60"
            : "h-9 w-9 rounded-xl bg-surface-alt/60",
          className
        )}
      />
    );
  }

  const isDark = resolvedMode === "dark";

  // Segmented Variant (Linear / Raycast Style Dual Capsule)
  if (variant === "segmented") {
    return (
      <div
        className={cn(
          "group relative inline-flex items-center h-8.5 p-0.5 rounded-full cursor-pointer select-none",
          "bg-surface/80 hover:bg-surface backdrop-blur-xl border border-border/80 hover:border-border shadow-2xs transition-all duration-300",
          "focus-within:ring-2 focus-within:ring-primary-500/40",
          className
        )}
        onClick={toggleMode}
        role="group"
        aria-label="Theme mode toggle"
      >
        {/* Sliding magnetic thumb */}
        <span
          className={cn(
            "absolute top-0.5 bottom-0.5 w-7 rounded-full shadow-sm",
            "transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] pointer-events-none",
            isDark
              ? "translate-x-[32px] bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-800 text-indigo-300 shadow-[0_2px_10px_rgba(99,102,241,0.4)] border border-indigo-400/40 ring-1 ring-indigo-400/20"
              : "translate-x-0.5 bg-gradient-to-tr from-amber-50 via-white to-amber-100/90 text-amber-500 shadow-[0_2px_10px_rgba(245,158,11,0.28)] border border-amber-300/60 ring-1 ring-amber-300/30"
          )}
        />

        {/* Sun Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleMode();
          }}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          aria-pressed={!isDark}
          className={cn(
            "relative z-10 flex items-center justify-center h-7.5 w-7.5 rounded-full cursor-pointer transition-all duration-300",
            !isDark
              ? "text-amber-500 scale-105"
              : "text-text-muted hover:text-text-secondary hover:scale-105 active:scale-95"
          )}
        >
          <CelestialSun className="w-4 h-4" rotating={!isDark} />
        </button>

        {/* Moon Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleMode();
          }}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          aria-pressed={isDark}
          className={cn(
            "relative z-10 flex items-center justify-center h-7.5 w-7.5 rounded-full cursor-pointer transition-all duration-300",
            isDark
              ? "text-indigo-300 scale-105"
              : "text-text-muted hover:text-text-secondary hover:scale-105 active:scale-95"
          )}
        >
          <CelestialMoon className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Single Icon Button Variant
  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggleMode}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className={cn(
          "relative h-9 w-9 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-300",
          "border border-border/70 hover:border-primary-500/40 bg-surface/80 hover:bg-surface-hover backdrop-blur-md shadow-2xs hover:shadow-xs",
          "active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
          className
        )}
      >
        <span className="relative w-4.5 h-4.5 flex items-center justify-center">
          <CelestialSun
            className={cn(
              "absolute inset-0 text-amber-500 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
              isDark ? "opacity-0 rotate-90 scale-0 pointer-events-none" : "opacity-100 rotate-0 scale-100"
            )}
            rotating={!isDark}
          />
          <CelestialMoon
            className={cn(
              "absolute inset-0 text-primary-400 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
              isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-0 pointer-events-none"
            )}
          />
        </span>
      </button>
    );
  }

  // Default "pill" — Deluxe Celestial Horizon Sliding Toggle
  return (
    <button
      type="button"
      onClick={toggleMode}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      className={cn(
        "group relative inline-flex items-center h-8.5 w-[62px] p-0.5 rounded-full cursor-pointer select-none",
        "backdrop-blur-xl transition-all duration-500 shadow-2xs overflow-hidden",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2",
        "hover:scale-[1.03] active:scale-[0.96]",
        isDark
          ? "bg-slate-950/90 border border-indigo-500/35 shadow-inner hover:border-indigo-400/50"
          : "bg-surface/90 border border-amber-300/60 shadow-inner hover:border-amber-400/70",
        className
      )}
    >
      {/* Background Track Horizon Indicators */}
      <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
        {/* Subtle Sun Silhouette on Left */}
        <span
          className={cn(
            "transition-opacity duration-400",
            isDark ? "opacity-25 group-hover:opacity-45 text-slate-400" : "opacity-0"
          )}
        >
          <CelestialSun className="w-3.5 h-3.5" rotating={false} />
        </span>

        {/* Subtle Moon Silhouette on Right */}
        <span
          className={cn(
            "transition-opacity duration-400",
            isDark ? "opacity-0" : "opacity-30 group-hover:opacity-55 text-amber-900/60 dark:text-amber-200/60"
          )}
        >
          <CelestialMoon className="w-3.5 h-3.5" />
        </span>
      </div>

      {/* Celestial Sliding Orb (Knob) */}
      <span
        className={cn(
          "relative z-10 flex items-center justify-center h-7 w-7 rounded-full shadow-md",
          "transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          isDark
            ? "translate-x-[30px] bg-gradient-to-tr from-indigo-700 via-indigo-600 to-violet-500 text-white shadow-[0_2px_10px_rgba(99,102,241,0.5)] ring-1 ring-indigo-300/50"
            : "translate-x-0 bg-gradient-to-tr from-amber-400 via-amber-300 to-yellow-100 text-amber-950 shadow-[0_2px_10px_rgba(245,158,11,0.45)] ring-1 ring-amber-300/80"
        )}
      >
        {/* Sun Icon (Day) */}
        <CelestialSun
          className={cn(
            "absolute transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            isDark
              ? "opacity-0 rotate-180 scale-0 pointer-events-none"
              : "opacity-100 rotate-0 scale-100 text-amber-950"
          )}
          rotating={!isDark}
        />

        {/* Moon Icon (Night) */}
        <CelestialMoon
          className={cn(
            "absolute transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            isDark
              ? "opacity-100 rotate-0 scale-100 text-white"
              : "opacity-0 -rotate-180 scale-0 pointer-events-none"
          )}
        />
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
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted) {
    return (
      <div className={cn("relative inline-block", className)}>
        <div
          className="flex items-center justify-center h-8 w-8 rounded-full border border-border/80 bg-surface shadow-xs"
          aria-hidden="true"
        >
          <span className="h-4 w-4 rounded-full bg-surface-alt/80 ring-1 ring-black/10 dark:ring-white/20" />
        </div>
      </div>
    );
  }

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
          suppressHydrationWarning
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


