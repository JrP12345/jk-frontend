"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

import { cn } from "./utils";

/* ────────────────────────────────────────────────
   Theme Provider — Ekavyu light, dark and system mode
   ──────────────────────────────────────────────── */

type Mode = "light" | "dark" | "system";

function applyResolvedMode(resolvedMode: "light" | "dark") {
  const root = document.documentElement;
  root.setAttribute("data-mode", resolvedMode);
  root.classList.toggle("dark", resolvedMode === "dark");
  root.style.colorScheme = resolvedMode;
}

interface ThemeContextValue {
  mode: Mode;
  resolvedMode: "light" | "dark";
  setMode: (m: Mode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [mode, setModeRaw] = useState<Mode>("light");
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">("light");

  // Read persisted theme on mount to prevent SSR hydration mismatch
  useEffect(() => {
    const domMode = document.documentElement.getAttribute("data-mode") as Mode;
    let storedMode: string | null = null;
    try { storedMode = localStorage.getItem("ekavyu-mode"); } catch { /* Storage may be unavailable. */ }
    const savedMode: Mode = storedMode === "light" || storedMode === "dark" || storedMode === "system"
      ? storedMode : domMode === "dark" ? "dark" : "light";

    setModeRaw(savedMode);

    let nextResolved: "light" | "dark" = "light";
    if (savedMode === "system") {
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
      applyResolvedMode(nextResolved);

      setModeRaw(newMode);
      setResolvedMode(nextResolved);

      if (typeof window !== "undefined") {
        try { localStorage.setItem("ekavyu-mode", newMode); } catch { /* Mode still works without persistence. */ }
      }
    };

    const animate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (animate && "startViewTransition" in document) {
      (document as any).startViewTransition(() => {
        updateDOM();
      });
    } else {
      if (animate) root.classList.add("theme-transitioning");
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

  const toggleMode = useCallback(() => {
    const next = resolvedMode === "light" ? "dark" : "light";
    setMode(next);
  }, [resolvedMode, setMode]);

  // Resolve system preference
  useEffect(() => {
    if (!mounted || mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const nextRes = mq.matches ? "dark" : "light";
    applyResolvedMode(nextRes);
    setResolvedMode(nextRes);
    const handler = (e: MediaQueryListEvent) => {
      const r = e.matches ? "dark" : "light";
      applyResolvedMode(r);
      setResolvedMode(r);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mounted, mode]);

  // Ensure DOM attributes match state after initial mount
  useEffect(() => {
    if (!mounted) return;
    applyResolvedMode(resolvedMode);
  }, [mounted, resolvedMode]);

  return (
    <ThemeContext.Provider value={{ mode, resolvedMode, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

/* ────────────────────────────────────────────────
   Celestial Icons — Handcrafted Vector Sun & Moon
   ──────────────────────────────────────────────── */

function CelestialSun({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("w-4 h-4", className)}
      aria-hidden="true"
    >
      {/* Radiant Solar Core */}
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      {/* Solar Corona Rays */}
      <g
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

function CelestialMoon({ className = "" }: { className?: string }) {
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

      />
      {/* Ambient Starlight Point */}
      <circle cx="20.5" cy="10" r="0.75" fill="currentColor"  />
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

  // One material group with a solid, bounded selection indicator.
  if (variant === "segmented") {
    return (
      <button
        type="button"
        onClick={toggleMode}
        className={cn(
          "group relative inline-flex items-center h-8.5 p-0.5 rounded-full cursor-pointer select-none",
          "material-glass-control material-appearance-control transition-colors duration-[var(--motion-fast)]",
          "focus-within:ring-2 focus-within:ring-focus-ring",
          className
        )}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {/* Sliding selection thumb */}
        <span
          className={cn(
            "absolute top-0.5 bottom-0.5 w-7 rounded-full shadow-sm",
            "transition-transform duration-[var(--motion-standard)] ease-smooth pointer-events-none",
            isDark
              ? "translate-x-[32px] bg-accent-subtle text-accent border border-border"
              : "translate-x-0.5 bg-accent-subtle text-accent border border-border"
          )}
        />

        {/* Both icons are part of one toggle, including its selected side. */}
        <span
          aria-hidden="true"
          className={cn(
            "relative z-10 flex items-center justify-center h-7.5 w-7.5 rounded-full cursor-pointer transition-all duration-300",
            !isDark
              ? "text-accent"
              : "text-text-secondary"
          )}
        >
          <CelestialSun className="w-4 h-4" />
        </span>

        {/* Moon indicator */}
        <span
          aria-hidden="true"
          className={cn(
            "relative z-10 flex items-center justify-center h-7.5 w-7.5 rounded-full cursor-pointer transition-all duration-300",
            isDark
              ? "text-accent"
              : "text-text-secondary"
          )}
        >
          <CelestialMoon className="w-4 h-4" />
        </span>
      </button>
    );
  }

  // Single Icon Button Variant
  if (variant === "icon") {
    return (
      <button
        type="button"
        data-material-control
        onClick={toggleMode}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className={cn(
          "relative h-11 w-11 md:h-9 md:w-9 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-300",
          "border border-border/70 hover:border-primary-500/40 bg-surface hover:bg-surface-hover  shadow-2xs hover:shadow-xs",
          "active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
          className
        )}
      >
        <span className="relative w-4.5 h-4.5 flex items-center justify-center">
          <CelestialSun
            className={cn(
              "absolute inset-0 text-accent transition-all duration-[var(--motion-standard)] ease-smooth",
              isDark ? "opacity-0 rotate-90 scale-0 pointer-events-none" : "opacity-100 rotate-0 scale-100"
            )}
          />
          <CelestialMoon
            className={cn(
              "absolute inset-0 text-accent transition-all duration-[var(--motion-standard)] ease-smooth",
              isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-0 pointer-events-none"
            )}
          />
        </span>
      </button>
    );
  }

  // Sliding theme toggle.
  return (
    <button
      type="button"
      onClick={toggleMode}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      className={cn(
        "group relative inline-flex items-center h-8.5 w-[62px] p-0.5 rounded-full cursor-pointer select-none",
        " transition-all duration-500 shadow-2xs overflow-hidden",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
        "hover:scale-[1.03] active:scale-[0.96]",
        "bg-surface-muted border border-border hover:border-accent",
        className
      )}
    >
      {/* Background Track Horizon Indicators */}
      <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
        {/* Subtle Sun Silhouette on Left */}
        <span
          className={cn(
            "transition-opacity duration-400",
            isDark ? "opacity-25 group-hover:opacity-45 text-text-muted" : "opacity-0"
          )}
        >
          <CelestialSun className="w-3.5 h-3.5" />
        </span>

        {/* Subtle Moon Silhouette on Right */}
        <span
          className={cn(
            "transition-opacity duration-400",
            isDark ? "opacity-0" : "opacity-30 group-hover:opacity-55 text-accent dark:text-accent"
          )}
        >
          <CelestialMoon className="w-3.5 h-3.5" />
        </span>
      </div>

      {/* Celestial Sliding Orb (Knob) */}
      <span
        className={cn(
          "relative z-10 flex items-center justify-center h-7 w-7 rounded-full shadow-xs",
          "transition-all duration-[var(--motion-standard)] ease-smooth",
          isDark
            ? "translate-x-[30px] bg-accent-subtle text-accent ring-1 ring-border"
            : "translate-x-0 bg-accent-subtle text-accent ring-1 ring-border"
        )}
      >
        {/* Sun Icon (Day) */}
        <CelestialSun
          className={cn(
            "absolute transition-all duration-[var(--motion-standard)] ease-smooth",
            isDark
              ? "opacity-0 rotate-180 scale-0 pointer-events-none"
              : "opacity-100 rotate-0 scale-100 text-accent"
          )}
        />

        {/* Moon Icon (Night) */}
        <CelestialMoon
          className={cn(
            "absolute transition-all duration-[var(--motion-standard)] ease-smooth",
            isDark
              ? "opacity-100 rotate-0 scale-100 text-accent"
              : "opacity-0 -rotate-180 scale-0 pointer-events-none"
          )}
        />
      </span>
    </button>
  );
}
